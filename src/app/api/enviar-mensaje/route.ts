import { registrarEvento, rutaDesdeReferer } from '@/lib/analytics-server'

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID, sanitizeString } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { conversacion_id, remitente_id, destinatario_id } = body
    const contenido = sanitizeString(typeof body.contenido === 'string' ? body.contenido : '', 5000)
    if (!isValidUUID(conversacion_id) || remitente_id !== auth.user.id || !isValidUUID(destinatario_id) || !contenido) {
      return NextResponse.json({ error: 'Datos de mensaje inválidos o no autorizados' }, { status: 400 })
    }

    const { data: conversation, error: conversationError } = await auth.supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id, producto_id')
      .eq('id', conversacion_id)
      .maybeSingle()
    if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 })
    if (!conversation || ![conversation.user1_id, conversation.user2_id].includes(auth.user.id) ||
        ![conversation.user1_id, conversation.user2_id].includes(destinatario_id) ||
        destinatario_id === auth.user.id) {
      return NextResponse.json({ error: 'No perteneces a esta conversación' }, { status: 403 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await checkRateLimit('mensaje:create', auth.user.id, { ip })
    if (!rateLimit.ok) {
      return NextResponse.json({ error: `Demasiados mensajes. Espera ${Math.ceil(rateLimit.resetIn / 60000)} min` }, { status: 429 })
    }

    const { data: message, error } = await auth.supabaseAdmin.from('mensajes').insert({
      conversacion_id,
      remitente_id: auth.user.id,
      destinatario_id,
      producto_id: conversation.producto_id,
      contenido,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: sender } = await auth.supabaseAdmin
      .from('perfiles')
      .select('nombre')
      .eq('id', auth.user.id)
      .maybeSingle()
    await auth.supabaseAdmin.from('notificaciones_push').insert({
      target_user_id: destinatario_id,
      tipo: 'mensaje',
      titulo: `💬 ${sender?.nombre || 'Alguien'} te escribió`,
      cuerpo: contenido.slice(0, 100),
      click_url: `/chat?conversation=${conversacion_id}`,
    })

    void registrarEvento('mensaje_enviado', {
      ruta: '/chat',
      meta: { conversacion_id, destinatario_id },
      userId: auth.user.id,
      req,
    })

    return NextResponse.json({ ok: true, data: message }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
