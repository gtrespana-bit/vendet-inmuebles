import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { requireAuthenticatedUser, isAdminUser } from '@/lib/api-auth'
import { isValidUUID, sanitizeString } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:noreply@vendet.online',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const targetUserId = body.targetUserId
    const titulo = sanitizeString(body.titulo, 120)
    const cuerpo = sanitizeString(typeof body.cuerpo === 'string' ? body.cuerpo : titulo, 300)
    const requestedPath = typeof body.click_url === 'string' ? body.click_url : '/chat'
    const clickUrl = requestedPath.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath.slice(0, 300)
      : '/chat'

    if (!isValidUUID(targetUserId) || !titulo) {
      return NextResponse.json({ error: 'targetUserId y titulo válidos son requeridos' }, { status: 400 })
    }

    if (!isAdminUser(auth.user)) {
      const { data: conversations, error } = await auth.supabaseAdmin
        .from('conversaciones')
        .select('id')
        .eq('user1_id', auth.user.id < targetUserId ? auth.user.id : targetUserId)
        .eq('user2_id', auth.user.id < targetUserId ? targetUserId : auth.user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const conversationIds = (conversations || []).map(conversation => conversation.id)
      if (conversationIds.length === 0) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

      const { count, error: messageError } = await auth.supabaseAdmin
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .in('conversacion_id', conversationIds)
        .eq('remitente_id', auth.user.id)
        .eq('destinatario_id', targetUserId)
        .gte('creado_en', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })
      if (!count) return NextResponse.json({ error: 'La notificación debe seguir a un mensaje enviado' }, { status: 403 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await checkRateLimit('push:send', auth.user.id, { ip })
    if (!rateLimit.ok) return NextResponse.json({ error: 'Demasiadas notificaciones' }, { status: 429 })

    const { data: subscriptions, error: subscriptionError } = await auth.supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', targetUserId)
    if (subscriptionError) return NextResponse.json({ error: subscriptionError.message }, { status: 500 })
    if (!subscriptions?.length) return NextResponse.json({ sent: 0, reason: 'no subscriptions' })

    const payload = {
      title: titulo,
      body: cuerpo || titulo,
      tag: `msg-${targetUserId.slice(0, 8)}`,
      icon: '/icon-192.png',
      click_url: clickUrl,
    }
    const deadSubscriptions: string[] = []

    await Promise.all(subscriptions.map(async (subscription: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          JSON.stringify(payload),
        )
      } catch (error: any) {
        if (error.statusCode === 410) deadSubscriptions.push(subscription.endpoint)
        console.error('Push send error:', error.statusCode, error.message)
      }
    }))

    if (deadSubscriptions.length > 0) {
      await auth.supabaseAdmin.from('push_subscriptions').delete().in('endpoint', deadSubscriptions)
    }

    return NextResponse.json({ sent: subscriptions.length - deadSubscriptions.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
