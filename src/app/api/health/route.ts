import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Health check ligero y sin datos sensibles para monitorización externa (F28).
 * Comprueba que el proceso responde y que Supabase responde en < 3 s.
 */
export async function GET() {
  const startedAt = Date.now()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        status: 'degraded',
        checks: { app: 'up', database: 'unconfigured' },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(3000) }),
      },
    })

    const { error } = await supabase.from('states').select('id', { head: true, count: 'exact' })
    const latencyMs = Date.now() - startedAt

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          status: 'degraded',
          checks: { app: 'up', database: 'down' },
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        status: 'healthy',
        checks: { app: 'up', database: 'up' },
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: 'degraded',
        checks: { app: 'up', database: 'down' },
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
