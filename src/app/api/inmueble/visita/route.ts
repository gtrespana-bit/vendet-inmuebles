import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import { registrarEvento, userIdDesdeCookie, sanitizeRuta } from '@/lib/analytics-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/inmueble/visita — { id }
 * Incrementa el contador `visitas` del inmueble (RPC registrar_visita_inmueble)
 * y registra el evento 'vista_inmueble' para la analítica del panel admin.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'desconocida'
    const rl = await checkRateLimit('inmueble:visita', `ip:${ip}`, { ip })
    if (!rl.ok) return new NextResponse(null, { status: 204 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return new NextResponse(null, { status: 204 })
    }

    const id = String(body?.id || '')
    if (!isValidUUID(id)) return new NextResponse(null, { status: 204 })
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.slice(0, 64) : null

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
      await sb.rpc('registrar_visita_inmueble', { p_inmueble_id: id })
      void registrarEvento('vista_inmueble', {
        ruta: sanitizeRuta(`/inmueble/${id}`),
        meta: { inmueble_id: id },
        sessionId,
        userId: userIdDesdeCookie(req),
        req,
      })
    }
  } catch {
    // silencio intencional
  }
  return new NextResponse(null, { status: 204 })
}
