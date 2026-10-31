import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { registrarEvento, userIdDesdeCookie, sanitizeRuta, EVENTOS_VALIDOS } from '@/lib/analytics-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/track — endpoint público de analítica interna.
 *
 * Body: { tipo, ruta, titulo?, meta?, sessionId?, utm? }
 * Responde siempre 204 (fire-and-forget); nunca bloquea ni filtra errores al cliente.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'desconocida'
    const rl = await checkRateLimit('track:evento', `ip:${ip}`, { ip })
    if (!rl.ok) return new NextResponse(null, { status: 204 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return new NextResponse(null, { status: 204 })
    }

    const tipo = String(body?.tipo || '')
    if (!EVENTOS_VALIDOS.has(tipo)) return new NextResponse(null, { status: 204 })

    void registrarEvento(tipo, {
      ruta: sanitizeRuta(body?.ruta || '/'),
      titulo: body?.titulo,
      meta: body?.meta && typeof body.meta === 'object' ? body.meta : null,
      sessionId: body?.sessionId,
      utm: body?.utm,
      userId: userIdDesdeCookie(req),
      req,
    })
  } catch {
    // silencio intencional: el tracking nunca debe romper la experiencia
  }
  return new NextResponse(null, { status: 204 })
}
