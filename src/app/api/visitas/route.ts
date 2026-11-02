import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import { emailEstadoSolicitudVisita, emailNuevaSolicitudVisita } from '@/lib/server-email'
import { notifyUser } from '@/lib/push-notify'
import { registrarEvento, rutaDesdeReferer } from '@/lib/analytics-server'
import { buildGoogleCalendarUrl } from '@/lib/visit-calendar'

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

  // Notificación inmediata por Push + Correo al asesor asignado o propietario (best effort)
  void notifyUser(supabaseAdmin, destinatarioPrincipalId, {
    title: '📅 Nueva solicitud de visita',
    body: `${nombreContacto} desea agendar (${modalidad}) para "${String(inmueble.titulo || 'tu inmueble')}"`,
    tag: `visita-${inserted.id}`,
    icon: '/icon-192.png',
    click_url: '/dashboard?tab=visitas',
  }).catch(() => undefined)

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
 * Devuelve:
 *  - `items`: solicitudes recibidas (como propietario, asesor asignado o titular/admin de agencia)
 *  - `sentItems`: visitas agendadas por el propio usuario como comprador (`solicitante_user_id`)
 *  - `pendingCount`: cantidad de leads recibidos pendientes de respuesta
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const userId = auth.user.id

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

  const [{ data: receivedRows, error: recErr }, { data: sentRows, error: sentErr }] = await Promise.all([
    auth.supabaseAdmin
      .from('solicitudes_visita')
      .select(
        'id, inmueble_id, propietario_id, agencia_id, agente_id, solicitante_user_id, nombre_contacto, telefono_contacto, email_contacto, modalidad, fecha_preferida, franja_horaria, mensaje, estado, nota_vendedor, creado_en, actualizado_en',
      )
      .or(orClauses.join(','))
      .order('creado_en', { ascending: false })
      .limit(100),
    auth.supabaseAdmin
      .from('solicitudes_visita')
      .select(
        'id, inmueble_id, propietario_id, agencia_id, agente_id, solicitante_user_id, nombre_contacto, telefono_contacto, email_contacto, modalidad, fecha_preferida, franja_horaria, mensaje, estado, nota_vendedor, creado_en, actualizado_en',
      )
      .eq('solicitante_user_id', userId)
      .order('creado_en', { ascending: false })
      .limit(50),
  ])

  if (recErr) {
    return NextResponse.json({ error: recErr.message }, { status: 500 })
  }
  if (sentErr) {
    return NextResponse.json({ error: sentErr.message }, { status: 500 })
  }

  const allRows = [...(receivedRows || []), ...(sentRows || [])]
  const propIds = Array.from(
    new Set(allRows.map((r: any) => String(r.inmueble_id)).filter(isValidUUID)),
  )
  const advisorIds = Array.from(
    new Set(
      allRows
        .map((r: any) => String(r.agente_id || r.propietario_id || ''))
        .filter(isValidUUID),
    ),
  )

  const propMap = new Map<string, any>()
  const advisorMap = new Map<string, { nombre: string | null; telefono: string | null }>()

  await Promise.all([
    propIds.length > 0
      ? auth.supabaseAdmin
          .from('inmuebles')
          .select('id, titulo, slug, imagen_url, precio, moneda, ciudad, estado, zona')
          .in('id', propIds)
          .then(({ data }) => {
            for (const p of data || []) propMap.set(String(p.id), p)
          })
      : Promise.resolve(),
    advisorIds.length > 0
      ? auth.supabaseAdmin
          .from('perfiles')
          .select('id, nombre, telefono')
          .in('id', advisorIds)
          .then(({ data }) => {
            for (const u of data || []) {
              advisorMap.set(String(u.id), {
                nombre: u.nombre ? String(u.nombre) : null,
                telefono: u.telefono ? String(u.telefono) : null,
              })
            }
          })
      : Promise.resolve(),
  ])

  const enrichRow = (r: any) => {
    const advisorKey = String(r.agente_id || r.propietario_id || '')
    const advisor = advisorMap.get(advisorKey) || null
    const agentOnly = r.agente_id ? advisorMap.get(String(r.agente_id)) || null : null
    return {
      ...r,
      inmueble: propMap.get(String(r.inmueble_id)) || null,
      agente_nombre: agentOnly?.nombre || null,
      asesor_contacto: advisor,
    }
  }

  const enrichedReceived = (receivedRows || []).map(enrichRow)
  const enrichedSent = (sentRows || []).map(enrichRow)
  const pendingCount = enrichedReceived.filter((r: any) => r.estado === 'pendiente').length

  return NextResponse.json({
    ok: true,
    items: enrichedReceived,
    sentItems: enrichedSent,
    pendingCount,
  })
}

/**
 * PATCH /api/visitas
 * - El asesor/propietario/admin de agencia actualiza `estado` o `nota_vendedor`
 *   (y notifica por correo/push al comprador cuando confirma o cancela).
 * - El comprador autenticado (`solicitante_user_id`) puede cancelar su propia solicitud pendiente/confirmada.
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
    .select(
      'id, inmueble_id, propietario_id, agente_id, agencia_id, solicitante_user_id, nombre_contacto, email_contacto, modalidad, fecha_preferida, franja_horaria, estado, nota_vendedor',
    )
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  const userId = auth.user.id
  let isRecipient =
    current.propietario_id === userId || Boolean(current.agente_id && current.agente_id === userId)

  if (!isRecipient && current.agencia_id) {
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
    isRecipient = Boolean(ownerRow || adminRow)
  }

  const isRequesterCancelling =
    !isRecipient &&
    Boolean(current.solicitante_user_id && current.solicitante_user_id === userId) &&
    body.estado === 'cancelada' &&
    (current.estado === 'pendiente' || current.estado === 'confirmada')

  if (!isRecipient && !isRequesterCancelling) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {
    actualizado_en: new Date().toISOString(),
  }

  if (isRequesterCancelling) {
    updates.estado = 'cancelada'
  } else {
    if (typeof body.estado === 'string' && ESTADOS_VALIDOS.has(body.estado)) {
      updates.estado = body.estado
    }
    if (body.nota_vendedor !== undefined) {
      updates.nota_vendedor = sanitizePlainText(body.nota_vendedor, 500) || null
    }
  }

  const { data: updated, error: updErr } = await auth.supabaseAdmin
    .from('solicitudes_visita')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const nuevoEstado = String(updated.estado || '')
  const cambioEstado = nuevoEstado !== String(current.estado || '')

  // Si el comprador canceló su propia cita, avisar por push al asesor
  if (isRequesterCancelling && cambioEstado) {
    const advisorDestId = String(current.agente_id || current.propietario_id)
    void notifyUser(auth.supabaseAdmin, advisorDestId, {
      title: 'Visita cancelada por el interesado',
      body: `${String(current.nombre_contacto || 'El interesado')} canceló su solicitud de visita.`,
      tag: `visita-cancel-${current.id}`,
      icon: '/icon-192.png',
      click_url: '/dashboard?tab=visitas',
    }).catch(() => undefined)
  }

  // Si el asesor confirmó o canceló la cita, avisar al comprador por Push y Correo
  if (
    isRecipient &&
    cambioEstado &&
    (nuevoEstado === 'confirmada' || nuevoEstado === 'cancelada')
  ) {
    void (async () => {
      try {
        const [{ data: prop }, { data: advisor }] = await Promise.all([
          auth.supabaseAdmin
            .from('inmuebles')
            .select('id, titulo, slug, ciudad, estado, zona')
            .eq('id', current.inmueble_id)
            .maybeSingle(),
          auth.supabaseAdmin
            .from('perfiles')
            .select('nombre, telefono')
            .eq('id', userId)
            .maybeSingle(),
        ])

        const tituloInmueble = String(prop?.titulo || 'Inmueble en Venezuela')
        const slugOrId = String(prop?.slug || current.inmueble_id)
        const baseSite =
          process.env.NEXT_PUBLIC_SITE_URL || 'https://venezuela-inmuebles.online'
        const propertyUrl = `${baseSite}/inmueble/${encodeURIComponent(slugOrId)}`
        const ubicacionInmueble = [prop?.zona, prop?.ciudad, prop?.estado]
          .filter(Boolean)
          .join(', ')

        if (current.solicitante_user_id) {
          await notifyUser(auth.supabaseAdmin, String(current.solicitante_user_id), {
            title:
              nuevoEstado === 'confirmada'
                ? '✅ Tu visita fue confirmada'
                : 'Actualización de tu solicitud de visita',
            body:
              nuevoEstado === 'confirmada'
                ? `Confirmada tu solicitud para "${tituloInmueble}".`
                : `Revisa el estado de tu solicitud para "${tituloInmueble}".`,
            tag: `visita-estado-${current.id}`,
            icon: '/icon-192.png',
            click_url: '/dashboard?tab=visitas',
          }).catch(() => undefined)
        }

        const emailComp = current.email_contacto ? String(current.email_contacto).trim() : ''
        if (emailComp && EMAIL_SIMPLE_RX.test(emailComp)) {
          const calendarUrl = current.fecha_preferida
            ? buildGoogleCalendarUrl({
                id: String(current.id),
                propertyTitle: tituloInmueble,
                propertyUrl,
                location: ubicacionInmueble || 'Venezuela',
                modalidad: current.modalidad as 'presencial' | 'videollamada' | 'llamada',
                fechaPreferida: String(current.fecha_preferida),
                franjaHoraria: current.franja_horaria,
                counterpartyName: advisor?.nombre ? String(advisor.nombre) : undefined,
                notes: updated.nota_vendedor ? String(updated.nota_vendedor) : undefined,
                locale: 'es',
              })
            : null

          await emailEstadoSolicitudVisita({
            emailComprador: emailComp,
            nombreComprador: String(current.nombre_contacto || 'interesado'),
            nombreAsesor: String(advisor?.nombre || 'Asesor inmobiliario'),
            telefonoAsesor: advisor?.telefono ? String(advisor.telefono) : null,
            tituloInmueble,
            slugInmueble: prop?.slug ? String(prop.slug) : null,
            inmuebleId: String(current.inmueble_id),
            ubicacionInmueble: ubicacionInmueble || null,
            estado: nuevoEstado as 'confirmada' | 'cancelada',
            modalidad: current.modalidad as 'presencial' | 'videollamada' | 'llamada',
            fechaPreferida: current.fecha_preferida ? String(current.fecha_preferida) : null,
            franjaHoraria: current.franja_horaria ? String(current.franja_horaria) : null,
            notaVendedor: updated.nota_vendedor ? String(updated.nota_vendedor) : null,
            calendarUrl,
          })
        }
      } catch (err) {
        console.error('Aviso comprador cambio estado visita:', err)
      }
    })()
  }

  return NextResponse.json({ ok: true, item: updated })
}
