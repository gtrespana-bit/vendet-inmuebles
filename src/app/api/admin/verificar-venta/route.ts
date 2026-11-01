import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID, requireUUIDs } from '@/lib/validation'
import { notifyUser } from '@/lib/push-notify'
import { notificarVerificacion, notificarVerificacionRechazada } from '@/lib/email-eventos'

/** Procesa la aprobación o rechazo de una solicitud de verificación de identidad desde Admin. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const {
      accion = 'aprobar',
      solicitudId,
      userId,
      cedula_numero,
      pago_movil_telefono,
      pago_movil_cedula,
      pago_movil_banco,
      rechazoMotivo,
    } = body

    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    if (solicitudId && !isValidUUID(solicitudId)) {
      return NextResponse.json({ error: 'Identificador de solicitud inválido' }, { status: 400 })
    }

    if (accion === 'rechazar') {
      const motivoLimpio = typeof rechazoMotivo === 'string' ? rechazoMotivo.trim().slice(0, 500) : ''
      if (!motivoLimpio) {
        return NextResponse.json({ error: 'Escribe el motivo del rechazo' }, { status: 400 })
      }

      if (solicitudId) {
        const { error: solErr } = await auth.supabaseAdmin
          .from('solicitudes_verificacion')
          .update({
            estado: 'rechazada',
            rechazo_motivo: motivoLimpio,
            revisada_en: new Date().toISOString(),
          })
          .eq('id', solicitudId)
        if (solErr) return NextResponse.json({ error: solErr.message }, { status: 500 })
      }

      await notifyUser(auth.supabaseAdmin, userId, {
        title: '⚠️ Revisión de tu verificación',
        body: `Tu solicitud requiere un ajuste: ${motivoLimpio}`,
        tag: 'verified-rejected',
        icon: '/icon-192.png',
        click_url: '/dashboard?tab=perfil',
      })
      await notificarVerificacionRechazada(auth.supabaseAdmin, userId, motivoLimpio)

      return NextResponse.json({ ok: true })
    }

    if (solicitudId) {
      const { error: solErr } = await auth.supabaseAdmin
        .from('solicitudes_verificacion')
        .update({
          estado: 'aprobada',
          revisada_en: new Date().toISOString(),
        })
        .eq('id', solicitudId)
      if (solErr) return NextResponse.json({ error: solErr.message }, { status: 500 })
    }

    const updateData: Record<string, any> = {
      verificado: true,
      verificado_desde: new Date().toISOString(),
    }
    for (const [field, value] of Object.entries({ cedula_numero, pago_movil_telefono, pago_movil_cedula, pago_movil_banco })) {
      if (typeof value === 'string' && value.trim()) updateData[field] = value.trim().slice(0, 100)
    }

    const { error } = await auth.supabaseAdmin
      .from('perfiles')
      .update(updateData)
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await notifyUser(auth.supabaseAdmin, userId, {
      title: '✅ Perfil verificado',
      body: 'Tu perfil ya cuenta con la insignia oficial de verificación en Venezuela Inmuebles.',
      tag: 'verified',
      icon: '/icon-192.png',
      click_url: '/dashboard',
    })
    await notificarVerificacion(auth.supabaseAdmin, userId, true)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
