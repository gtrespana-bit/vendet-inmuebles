import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { subscription } = body
    console.log('[push-subscribe] Received subscription:', JSON.stringify(subscription?.endpoint, null, 2))
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 400 })
    }

    // Auth: need to be logged in
    const authHeader = req.headers.get('authorization')
    console.log('[push-subscribe] Auth header present:', !!authHeader)
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Get user from session token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    console.log('[push-subscribe] Auth result - user:', user?.id, 'error:', authError?.message)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Save subscription
    console.log('[push-subscribe] Upserting for user:', user.id, 'endpoint:', subscription.endpoint)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth_key: subscription.keys?.auth,
      }, { onConflict: 'user_id,endpoint' })
    console.log('[push-subscribe] Upsert result - error:', error?.message)

    if (error) {
      console.error('Error saving push subscription:', error)
      return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[push-subscribe] Internal error:', e?.message, e?.stack)
    return NextResponse.json({ error: 'Internal error: ' + (e?.message || 'unknown') }, { status: 500 })
  }
}
