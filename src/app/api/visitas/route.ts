import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import { emailNuevaSolicitudVisita } from '@/lib/server-email'
import { registrarEvento, rutaDesdeReferer } from '@/lib/analytics-server'

export const dynamic = 'force-dynamic'

const MODALIDADES_VALIDAS = new Set(['presencial', 'videollamada', 'llamada'])
const FRANJAS_VALIDAS = new Set(['manana', 'tarde', 'fin_de_semana', 'flexible'])
const ESTADOS_VALIDOS = new Set(['pendiente', 'confirmada', 'atendida', 'cancelada'])
const EMAIL_SIMPLE_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function sanitizePlainText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, maxLen)
}

function sanitizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/[^\d+\-() ]/g, '').trim().slice(0, 30)
  const digits = clean.replace(/[^\d]/g, '')
  if (digits.length < 7 || digits.length > 16) return null
  return clean
}

function sanitizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = Date.parse(`${trimmed}T00:00:00Z`)
  if (!Number.isFinite(parsed)) return null
  return trimmed
}

/**
 * POST /api/visitas
 * Permite tanto a visitantes como a usuarios autenticados agendar una visita
 * presencial, videollamada o llamada sobre un inmueble publicado.
 * Protegido con honeypot anti-bots, rate limit por IP y sanitización estricta.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  // Honeypot silencioso contra bots automatizados
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  const inmuebleId = typeof body.inmuebleId === 'string' ? body.inmuebleId.trim() : ''
  if (!isValidUUID(inmuebleId)) {
    return NextResponse.json({ error: 'Inmueble inválido' }, { status: 400 })
  }

  const nombreContacto = sanitizePlainText(body.nombre, 100)
  if (nombreContacto.length < 2) {
    return NextResponse.json({ error: 'Indica tu nombre completo.' }, { status: 400 })
  }

  const telefonoContacto = sanitizePhone(body.telefono)
  if (!telefonoContacto) {
    return NextResponse.json(
      { error: 'Indica un número de teléfono o WhatsApp válido.' },
      { status: 400 },
    )
  }

  const emailRaw = sanitizePlainText(body.email, 160).toLowerCase()
  if (emailRaw && !EMAIL_SIMPLE_RX.test(emailRaw)) {
    return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 })
  }

  const modalidad = MODALIDADES_VALIDAS.has(String(body.modalidad || ''))
    ? (String(body.modalidad) as 'presencial' | 'videollamada' | 'llamada')
    : 'presencial'

  const franjaHoraria = FRANJAS_VALIDAS.has(String(body.franjaHoraria || ''))
    ? String(body.franjaHoraria)
    : 'flexible'

  const fechaPreferida = sanitizeIsoDate(body.fechaPreferida)
  const mensaje = sanitizePlainText(body.mensaje, 800) || null

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const rl = await checkRateLimit('visita:solicitar', ip, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Has enviado varias solicitudes seguidas. Intenta nuevamente más tarde.' },
      { status: 429 },
    )
  }

  const supabaseAdmin = createServerClient()

  // Identificar opcionalmente al usuario autenticado si envió sesión
  let solicitanteUserId: string | null = null
  const authAttempt = await requireAuthenticatedUser(req).catch(() => null)
  if (authAttempt && authAttempt.ok) {
    solicitanteUserId = authAttempt.user.id
  }

  const { data: inmueble, error: propErr } = await supabaseAdmin
    .from('inmuebles')
    .select(
      'id, titulo, slug, usuario_id, agencia_id, agente_asignado_id, activo, vendido, estado_moderacion',
    )
    .eq('id', inmuebleId)
    .maybeSingle()

  if (propErr) {
    return NextResponse.json({ error: propErr.message }, { status: 500 })
  }
  if (!inmueble || !inmueble.activo || inmueble.vendido || inmueble.estado_moderacion !== 'aprobado') {
    return NextResponse.json({ error: 'Este inmueble ya no está disponible.' }, { status: 404 })
  }

  if (solicitanteUserId && solicitanteUserId === inmueble.usuario_id) {
    return NextResponse.json(
      { error: 'No puedes agendar una visita sobre tu propio anuncio.' },
      { status: 400 },
    )
  }

  const destinatarioPrincipalId: string = String(
    inmueble.agente_asignado_id || inmueble.usuario_id,
  )

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('solicitudes_visita')
    .insert({
      inmueble_id: inmueble.id,
      propietario_id: inmueble.usuario_id,
      agencia_id: inmueble.agencia_id || null,
      agente_id: inmueble.agente_asignado_id || null,
      solicitante_user_id: solicitanteUserId,
      nombre_contacto: nombreContacto,
      telefono_contacto: telefonoContacto,
      email_contacto: emailRaw || null,
      modalidad,
      fecha_preferida: fechaPreferida,
      franja_horaria: franjaHoraria,
      mensaje,
      estado: 'pendiente',
    })
    .select('id, estado, creado_en')
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Notificación inmediata por correo al asesor asignado o propietario (best effort)
  void (async () => {
    try {
      const { data: perfilDest } = await supabaseAdmin
        .from('perfiles')
        .select('nombre, email, email_notificaciones')
        .eq('id', destinatarioPrincipalId)
        .maybeSingle()

      if (perfilDest && perfilDest.email_notificaciones === false) return

      let emailDestino = perfilDest?.email ? String(perfilDest.email).trim() : ''
      if (!emailDestino) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(destinatarioPrincipalId)
        emailDestino = u?.user?.email || ''
      }
      if (!emailDestino) return

      await emailNuevaSolicitudVisita({
        emailDestino,
        nombreDestino: String(perfilDest?.nombre || 'anunciante'),
        tituloInmueble: String(inmueble.titulo || 'Inmueble'),
        slugInmueble: inmueble.slug ? String(inmueble.slug) : null,
        inmuebleId: String(inmueble.id),
        nombreContacto,
        telefonoContacto,
        emailContacto: emailRaw || null,
        modalidad,
        fechaPreferida,
        franjaHoraria,
        mensaje,
      })
    } catch (err) {
      console.error('Aviso email solicitud visita:', err)
    }
  })()

  void registrarEvento('contacto_visita', {
    ruta: rutaDesdeReferer(req),
    meta: { inmueble_id: inmueble.id, modalidad },
    userId: solicitanteUserId || undefined,
    req,
  })

  return NextResponse.json({ ok: true, id: inserted.id })
}

/**
 * GET /api/visitas
 * Lista las solicitudes de visita recibidas por el usuario autenticado
 * (como propietario, asesor asignado o titular/admin de agencia).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const userId = auth.user.id

  // Verificar si administra alguna agencia para incluir los leads de su cartera
  const [{ data: ownedAgencies }, { data: adminMemberships }] = await Promise.all([
    auth.supabaseAdmin.from('agencias').select('id').eq('owner_id', userId),
    auth.supabaseAdmin
      .from('agencia_miembros')
      .select('agencia_id')
      .eq('user_id', userId)
      .eq('estado', 'activo')
      .in('rol', ['owner', 'admin']),
  ])

  const managedAgencyIds = Array.from(
    new Set([
      ...(ownedAgencies || []).map((a: any) => String(a.id)),
      ...(adminMemberships || []).map((m: any) => String(m.agencia_id)),
    ]),
  ).filter((id) => isValidUUID(id))

  const orClauses = [`propietario_id.eq.${userId}`, `agente_id.eq.${userId}`]
  if (managedAgencyIds.length > 0) {
    orClauses.push(`agencia_id.in.(${managedAgencyIds.join(',')})`)
  }

  const { data: rows, error } = await auth.supabaseAdmin
    .from('solicitudes_visita')
    .select(
      'id, inmueble_id, propietario_id, agencia_id, agente_id, nombre_contacto, telefono_contacto, email_contacto, modalidad, fecha_preferida, franja_horaria, mensaje, estado, nota_vendedor, creado_en, actualizado_en',
    )
    .or(orClauses.join(','))
    .order('creado_en', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const propIds = Array.from(
    new Set((rows || []).map((r: any) => String(r.inmueble_id)).filter(isValidUUID)),
  )

  const propMap = new Map<string, any>()
  if (propIds.length > 0) {
    const { data: props } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, titulo, slug, imagen_url, precio, moneda, ciudad, estado, zona')
      .in('id', propIds)

    for (const p of props || []) {
      propMap.set(String(p.id), p)
    }
  }

  const enriched = (rows || []).map((r: any) => ({
    ...r,
    inmueble: propMap.get(String(r.inmueble_id)) || null,
  }))

  return NextResponse.json({ ok: true, items: enriched })
}

/**
 * PATCH /api/visitas
 * Actualiza el estado (`pendiente`, `confirmada`, `atendida`, `cancelada`)
 * o la nota interna del vendedor sobre una solicitud de visita.
 */
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

  const { data: current, error: fetchErr } = await auth.supabaseAdmin
    .from('solicitudes_visita')
    .select('id, propietario_id, agente_id, agencia_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  const userId = auth.user.id
  let authorized =
    current.propietario_id === userId || (current.agente_id && current.agente_id === userId)

  if (!authorized && current.agencia_id) {
    const [{ data: ownerRow }, { data: adminRow }] = await Promise.all([
      auth.supabaseAdmin
        .from('agencias')
        .select('id')
        .eq('id', current.agencia_id)
        .eq('owner_id', userId)
        .maybeSingle(),
      auth.supabaseAdmin
        .from('agencia_miembros')
        .select('id')
        .eq('agencia_id', current.agencia_id)
        .eq('user_id', userId)
        .eq('estado', 'activo')
        .in('rol', ['owner', 'admin'])
        .maybeSingle(),
    ])
    authorized = Boolean(ownerRow || adminRow)
  }

  if (!authorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {
    actualizado_en: new Date().toISOString(),
  }

  if (typeof body.estado === 'string' && ESTADOS_VALIDOS.has(body.estado)) {
    updates.estado = body.estado
  }

  if (body.nota_vendedor !== undefined) {
    updates.nota_vendedor = sanitizePlainText(body.nota_vendedor, 500) || null
  }

  const { data: updated, error: updErr } = await auth.supabaseAdmin
    .from('solicitudes_visita')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: updated })
}
