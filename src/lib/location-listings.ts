/**
 * Consultas compartidas de listados públicos por operación, estado y ciudad (F16).
 *
 * Usa exclusivamente las columnas reales de `vw_propiedades_publicas`, `states` y
 * `cities` (sin joins heredados inexistentes como `property_images`) y distingue
 * explícitamente un fallo del servicio de la ausencia real de anuncios.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type OperacionSlug = 'venta' | 'alquiler'

export interface StateRecord {
  id: string
  name: string
  slug: string
}

export interface CityRecord {
  id: string
  name: string
  slug: string
  state_id: string
}

export interface CardPropertyItem {
  id: string
  title: string
  slug: string
  price: number
  operation_type: OperacionSlug
  city: string
  state: string
  main_image_url: string | null
  bedrooms: number
  bathrooms: number
  area_size: number
}

const PUBLIC_LISTING_SELECT = [
  'id',
  'titulo',
  'slug',
  'precio',
  'ciudad',
  'estado',
  'ubicacion_estado_id',
  'ubicacion_ciudad_id',
  'main_image_url',
  'habitaciones',
  'banos',
  'area_total',
  'tipo_operacion',
  'destacado',
  'boosteado_en',
  'creado_en',
].join(', ')

/** Escapa valores usados dentro de expresiones `.or(...)` de PostgREST. */
export function sanitizePostgrestFilterValue(raw: string): string {
  return raw.replace(/[,()"'\\]/g, '').trim()
}

export function mapViewRowToCardProperty(row: any, fallbackOp: OperacionSlug): CardPropertyItem {
  const op: OperacionSlug = row?.tipo_operacion === 'alquiler'
    ? 'alquiler'
    : row?.tipo_operacion === 'venta'
    ? 'venta'
    : fallbackOp

  return {
    id: String(row.id),
    title: row.titulo || 'Sin título',
    slug: row.slug || String(row.id),
    price: Number(row.precio) || 0,
    operation_type: op,
    city: row.ciudad || 'Ciudad no especificada',
    state: row.estado || 'Estado no especificado',
    main_image_url: row.main_image_url || null,
    bedrooms: Number(row.habitaciones) || 0,
    bathrooms: Number(row.banos) || 0,
    area_size: Number(row.area_total) || 0,
  }
}

export async function resolveStateByParam(
  supabase: SupabaseClient,
  estadoParam: string
): Promise<{ state: StateRecord | null; serviceError: boolean }> {
  const clean = sanitizePostgrestFilterValue(decodeURIComponent(estadoParam || '').toLowerCase())
  if (!clean) return { state: null, serviceError: false }

  const { data, error } = await supabase
    .from('states')
    .select('id, name, slug')
    .or(`id.eq.${clean},slug.eq.${clean}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error resolviendo estado:', error)
    return { state: null, serviceError: true }
  }
  return { state: (data as StateRecord | null) ?? null, serviceError: false }
}

export async function resolveCityByParam(
  supabase: SupabaseClient,
  stateId: string,
  ciudadParam: string
): Promise<{ city: CityRecord | null; serviceError: boolean }> {
  const decoded = sanitizePostgrestFilterValue(decodeURIComponent(ciudadParam || ''))
  if (!decoded) return { city: null, serviceError: false }
  const lower = decoded.toLowerCase()

  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, state_id')
    .eq('state_id', stateId)
    .or(`id.eq.${lower},slug.eq.${lower},name.ilike."${decoded}"`)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error resolviendo ciudad:', error)
    return { city: null, serviceError: true }
  }
  return { city: (data as CityRecord | null) ?? null, serviceError: false }
}

export async function fetchListingsByLocation(
  supabase: SupabaseClient,
  opts: {
    operacion: OperacionSlug
    state?: StateRecord | null
    city?: CityRecord | null
    rawCityName?: string
    limit?: number
  }
): Promise<{ properties: CardPropertyItem[]; serviceError: boolean }> {
  const limit = opts.limit ?? 50

  let query = supabase
    .from('vw_propiedades_publicas')
    .select(PUBLIC_LISTING_SELECT)
    .eq('tipo_operacion', opts.operacion)
    .eq('activo', true)

  if (opts.state) {
    const safeStateId = sanitizePostgrestFilterValue(opts.state.id)
    const safeStateName = sanitizePostgrestFilterValue(opts.state.name)
    query = query.or(`ubicacion_estado_id.eq.${safeStateId},estado.ilike."${safeStateName}"`)
  }

  if (opts.city) {
    const safeCityId = sanitizePostgrestFilterValue(opts.city.id)
    const safeCityName = sanitizePostgrestFilterValue(opts.city.name)
    query = query.or(`ubicacion_ciudad_id.eq.${safeCityId},ciudad.ilike."${safeCityName}"`)
  } else if (opts.rawCityName) {
    const safeRaw = sanitizePostgrestFilterValue(opts.rawCityName)
    if (safeRaw) {
      query = query.ilike('ciudad', safeRaw)
    }
  }

  const { data, error } = await query
    .order('destacado', { ascending: false })
    .order('boosteado_en', { ascending: false, nullsFirst: false })
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error consultando inmuebles por ubicación:', error)
    return { properties: [], serviceError: true }
  }

  return {
    properties: (data || []).map((row) => mapViewRowToCardProperty(row, opts.operacion)),
    serviceError: false,
  }
}
