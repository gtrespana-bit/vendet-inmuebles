import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Máximo de características por anuncio. El catálogo de ambientes y servicios
 * tiene más de 40 opciones, así que el límite debe dejar marcar todas sin que
 * el guardado falle.
 */
export const MAX_CARACTERISTICAS = 60

/** Resolve all selected names before changing a listing's existing features. */
export async function resolvePropertyFeatures(supabase: SupabaseClient, values: unknown[]): Promise<number[]> {
  const names = new Map<string, string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const name = value.trim().slice(0, 60)
    const key = name.toLocaleLowerCase('es')
    if (name.length >= 2 && !names.has(key)) names.set(key, name)
  }
  if (names.size > MAX_CARACTERISTICAS) throw new Error('Demasiadas características')

  const catalog = new Map<string, number>()
  // PostgREST limits result sets, so read all pages rather than silently missing entries.
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from('caracteristicas').select('id, nombre').order('id').range(start, start + 999)
    if (error) throw error
    for (const row of data || []) catalog.set(String(row.nombre).trim().toLocaleLowerCase('es'), row.id)
    if (!data || data.length < 1000) break
  }

  const ids: number[] = []
  for (const [key, name] of Array.from(names)) {
    let id = catalog.get(key)
    if (id === undefined) {
      const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'caracteristica'
      const suffix = createHash('sha256').update(key).digest('hex').slice(0, 12)
      const { data, error } = await supabase.from('caracteristicas')
        .insert({ nombre: name, slug: `${base}-${suffix}` }).select('id').single()
      if (error) {
        // Another request may have created the same name concurrently.
        if (error.code !== '23505') throw error
        const { data: existing, error: lookupError } = await supabase.from('caracteristicas')
          .select('id, nombre').eq('nombre', name).maybeSingle()
        if (lookupError) throw lookupError
        if (!existing || String(existing.nombre).trim().toLocaleLowerCase('es') !== key) throw error
        id = existing.id
      } else {
        if (!data) throw new Error('No se pudo crear la característica')
        id = data.id
      }
      catalog.set(key, id as number)
    }
    ids.push(id as number)
  }
  return Array.from(new Set(ids))
}

/** Insert additions before removing obsolete links; failures never erase old selections. */
export async function savePropertyFeatures(supabase: SupabaseClient, propertyId: string, values: unknown[]): Promise<void> {
  const ids = await resolvePropertyFeatures(supabase, values)
  const { data: current, error: readError } = await supabase.from('inmueble_caracteristicas')
    .select('caracteristica_id').eq('inmueble_id', propertyId)
  if (readError) throw readError
  const currentIds = new Set((current || []).map((row) => row.caracteristica_id))
  const additions = ids.filter((id) => !currentIds.has(id))
  if (additions.length) {
    const { error } = await supabase.from('inmueble_caracteristicas')
      .insert(additions.map((id) => ({ inmueble_id: propertyId, caracteristica_id: id })))
    if (error) throw error
  }
  const wanted = new Set(ids)
  const removals = Array.from(currentIds).filter((id) => !wanted.has(id))
  if (removals.length) {
    const { error } = await supabase.from('inmueble_caracteristicas').delete()
      .eq('inmueble_id', propertyId).in('caracteristica_id', removals)
    if (error) throw error
  }
}
