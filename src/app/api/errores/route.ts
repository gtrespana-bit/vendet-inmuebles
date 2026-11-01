import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { esBot, parseUserAgent, userIdDesdeCookie } from '@/lib/analytics-server'
import { registrarErrorEnBase } from '@/lib/error-monitor-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8192

function esMismoOrigen(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  if (!host) return true
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}

/**
 * POST /api/errores — Ingesta interna segura y ligera de errores sufridos por usuarios.
 *
 * Protecciones activas:
 *  - Verificación de mismo origen (`Origin` === `Host`)
 *  - Límite estricto de tamaño de payload (<= 8 KB)
 *  - Descarte de bots/crawlers
 *  - Rate-limit distribuido por IP (`errores:reportar`: máx 25 / 15 min)
 *  - Sanitización determinista de PII, tokens, URLs y agrupación SHA-256 en PostgreSQL
 */
export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' }

  try {
    if (!esMismoOrigen(req)) {
      return new NextResponse(null, { status: 204, headers })
    }

    const contentLength = Number(req.headers.get('content-length') || '0')
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'Payload excede límite' }, { status: 413, headers })
    }

    const ua = req.headers.get('user-agent') || ''
    if (esBot(ua)) {
      return new NextResponse(null, { status: 204, headers })
    }

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'desconocida'
    const rl = await checkRateLimit('errores:reportar', `ip:${ip}`, { ip })
    if (!rl.ok) {
      return new NextResponse(null, { status: 204, headers })
    }

    const rawText = await req.text()
    if (!rawText || rawText.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204, headers })
    }

    let body: Record<string, any>
    try {
      body = JSON.parse(rawText)
    } catch {
      return new NextResponse(null, { status: 204, headers })
    }

    if (!body || typeof body !== 'object') {
      return new NextResponse(null, { status: 204, headers })
    }

    const { dispositivo, navegador } = parseUserAgent(ua)
    const pais = req.headers.get('x-vercel-ip-country') || null
    const userId = userIdDesdeCookie(req)

    const res = await registrarErrorEnBase({
      origen: body.origen,
      severidad: body.severidad,
      nombre: body.nombre,
      mensaje: body.mensaje,
      codigoError: body.codigoError,
      ruta: body.ruta,
      endpoint: body.endpoint,
      accionPrevia: body.accionPrevia,
      stack: body.stack,
      userId,
      dispositivo,
      navegador,
      pais,
      viewport: body.viewport,
      statusHttp: typeof body.statusHttp === 'number' ? body.statusHttp : null,
    })

    return NextResponse.json(
      { ok: res.ok, codigoRef: res.codigoRef || null },
      { status: 200, headers },
    )
  } catch {
    return new NextResponse(null, { status: 204, headers })
  }
}
