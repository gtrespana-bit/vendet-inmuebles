import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const subscription = body.subscription
    const endpoint = subscription?.endpoint
    const p256dh = subscription?.keys?.p256dh
    const authKey = subscription?.keys?.auth

    if (
      typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 2048 ||
      typeof p256dh !== 'string' || p256dh.length > 500 ||
      typeof authKey !== 'string' || authKey.length > 500
    ) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
    }

    const { error } = await auth.supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: auth.user.id,
        endpoint,
        p256dh,
        auth_key: authKey,
      }, { onConflict: 'endpoint' })

    if (error) return NextResponse.json({ error: 'No se pudo guardar la suscripción' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
