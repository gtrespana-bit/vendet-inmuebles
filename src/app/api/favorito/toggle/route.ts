import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:noreply@venezuela-inmuebles.online',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { productId, isFavorited } = body
    if (!isValidUUID(productId) || typeof isFavorited !== 'boolean') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await checkRateLimit('favorito:toggle', auth.user.id, { ip })
    if (!rateLimit.ok) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })

    const { data: product, error: productError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('usuario_id, titulo, activo, vendido, estado_moderacion')
      .eq('id', productId)
      .maybeSingle()
    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Inmueble no encontrado' }, { status: 404 })

    if (isFavorited) {
      const { error } = await auth.supabaseAdmin.from('favoritos')
        .delete().eq('user_id', auth.user.id).eq('producto_id', productId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, action: 'removed' })
    }

    if (product.usuario_id === auth.user.id) {
      return NextResponse.json({ error: 'No puedes guardar tu propio inmueble' }, { status: 400 })
    }
    if (!product.activo || product.vendido || product.estado_moderacion !== 'aprobado') {
      return NextResponse.json({ error: 'Inmueble no disponible' }, { status: 404 })
    }

    const { error: insertError } = await auth.supabaseAdmin.from('favoritos').insert({
      user_id: auth.user.id,
      producto_id: productId,
    })
    if (insertError?.code === '23505') return NextResponse.json({ ok: true, action: 'added' })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    const { data: subscriptions } = await auth.supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', product.usuario_id)

    const deadEndpoints: string[] = []
    await Promise.all((subscriptions || []).map(async (subscription: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          JSON.stringify({
            title: '❤️ Inmueble guardado',
            body: `A alguien le gustó "${product.titulo}"`,
            tag: `fav-${productId.slice(0, 8)}`,
            icon: '/icon-192.png',
            click_url: `/inmueble/${productId}`,
          }),
        )
      } catch (error: any) {
        if (error.statusCode === 410) deadEndpoints.push(subscription.endpoint)
      }
    }))

    if (deadEndpoints.length > 0) {
      await auth.supabaseAdmin.from('push_subscriptions').delete().in('endpoint', deadEndpoints)
    }

    return NextResponse.json({ ok: true, action: 'added' })
  } catch (error: any) {
    console.error('[favorito/toggle] Error:', error.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
