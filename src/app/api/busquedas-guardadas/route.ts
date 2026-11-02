import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import {
  buildSavedSearchLabel,
  buildSavedSearchQueryString,
  computeSavedSearchFingerprint,
  hasMeaningfulSavedSearchFilters,
  MAX_SAVED_SEARCHES_PER_USER,
  normalizeSavedSearchFilters,
  type SavedSearchFrequency,
} from '@/lib/saved-searches'

export const dynamic = 'force-dynamic'

function sanitizeFrequency(value: unknown): SavedSearchFrequency {
  if (value === 'inmediata' || value === 'diaria' || value === 'pausada') return value
  return 'diaria'
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabaseAdmin
    .from('busquedas_guardadas')
    .select(
      'id, nombre, huella_filtros, query_string, filtros, alerta_email, frecuencia, ultimo_envio_en, creado_en, actualizado_en',
    )
    .eq('user_id', auth.user.id)
    .order('creado_en', { ascending: false })
    .limit(MAX_SAVED_SEARCHES_PER_USER)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, items: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('busqueda:guardar', auth.user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en unos minutos.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const rawFilters =
    body.filtros && typeof body.filtros === 'object'
      ? (body.filtros as Record<string, unknown>)
      : body

  const filtros = normalizeSavedSearchFilters(rawFilters)
  if (!hasMeaningfulSavedSearchFilters(filtros)) {
    return NextResponse.json(
      { error: 'Selecciona al menos un filtro (ubicación, operación, tipo o presupuesto) antes de guardar.' },
      { status: 400 },
    )
  }

  const locale = body.locale === 'en' ? 'en' : 'es'
  const huellaFiltros = computeSavedSearchFingerprint(filtros)
  const queryString = buildSavedSearchQueryString(filtros)
  const customName = typeof body.nombre === 'string' ? body.nombre.trim().slice(0, 140) : ''
  const nombre = customName.length >= 2 ? customName : buildSavedSearchLabel(filtros, locale)
  const frecuencia = sanitizeFrequency(body.frecuencia)
  const alertaEmail = body.alertaEmail !== false && frecuencia !== 'pausada'

  // Si ya existe con la misma huella para este usuario, reactivarla / actualizarla
  const { data: existing } = await auth.supabaseAdmin
    .from('busquedas_guardadas')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('huella_filtros', huellaFiltros)
    .maybeSingle()

  if (existing?.id) {
    const { data: updated, error: updErr } = await auth.supabaseAdmin
      .from('busquedas_guardadas')
      .update({
        nombre,
        query_string: queryString,
        filtros,
        alerta_email: alertaEmail,
        frecuencia,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', auth.user.id)
      .select(
        'id, nombre, huella_filtros, query_string, filtros, alerta_email, frecuencia, ultimo_envio_en, creado_en',
      )
      .single()

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'updated', item: updated })
  }

  const { count } = await auth.supabaseAdmin
    .from('busquedas_guardadas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)

  if ((count || 0) >= MAX_SAVED_SEARCHES_PER_USER) {
    return NextResponse.json(
      {
        error:
          locale === 'en'
            ? `You can save up to ${MAX_SAVED_SEARCHES_PER_USER} searches. Remove an older alert from your dashboard first.`
            : `Puedes guardar hasta ${MAX_SAVED_SEARCHES_PER_USER} búsquedas. Elimina una alerta anterior desde tu panel.`,
      },
      { status: 400 },
    )
  }

  const { data: inserted, error: insErr } = await auth.supabaseAdmin
    .from('busquedas_guardadas')
    .insert({
      user_id: auth.user.id,
      nombre,
      huella_filtros: huellaFiltros,
      query_string: queryString,
      filtros,
      alerta_email: alertaEmail,
      frecuencia,
    })
    .select(
      'id, nombre, huella_filtros, query_string, filtros, alerta_email, frecuencia, ultimo_envio_en, creado_en',
    )
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: 'created', item: inserted })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    actualizado_en: new Date().toISOString(),
  }

  if (typeof body.alerta_email === 'boolean') {
    updates.alerta_email = body.alerta_email
    if (!body.alerta_email) updates.frecuencia = 'pausada'
    else if (body.frecuencia === undefined) updates.frecuencia = 'diaria'
  }

  if (body.frecuencia === 'inmediata' || body.frecuencia === 'diaria' || body.frecuencia === 'pausada') {
    updates.frecuencia = body.frecuencia
    updates.alerta_email = body.frecuencia !== 'pausada'
  }

  if (typeof body.nombre === 'string' && body.nombre.trim().length >= 2) {
    updates.nombre = body.nombre.trim().slice(0, 140)
  }

  const { data, error } = await auth.supabaseAdmin
    .from('busquedas_guardadas')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select(
      'id, nombre, huella_filtros, query_string, filtros, alerta_email, frecuencia, ultimo_envio_en, creado_en',
    )
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Búsqueda no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const id = req.nextUrl.searchParams.get('id')?.trim() || ''
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const { error } = await auth.supabaseAdmin
    .from('busquedas_guardadas')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
