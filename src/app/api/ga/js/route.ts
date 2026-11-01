import { NextRequest, NextResponse } from 'next/server'
import { GA4_MEASUREMENT_ID, isValidGaMeasurementId } from '@/lib/ga4'

const UPSTREAM_TIMEOUT_MS = 5000

/**
 * Proxy first-party para `gtag.js` (`/api/ga/js?id=G-BSE60G6TX4`).
 * Evita `net::ERR_CONNECTION_TIMED_OUT` hacia `www.googletagmanager.com` en
 * operadoras ISP de Venezuela que bloquean o degradan rutas hacia dominios de GTM,
 * sirviendo el script desde el propio dominio con caché en CDN.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')?.trim() || GA4_MEASUREMENT_ID

  // Solo permitimos el Measurement ID configurado del portal (evita open-proxy)
  if (!isValidGaMeasurementId(id) || id !== GA4_MEASUREMENT_ID) {
    return new NextResponse('/* invalid measurement id */', {
      status: 400,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  try {
    const upstream = await fetch(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
      {
        headers: {
          Accept: 'application/javascript, */*;q=0.8',
          'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        next: { revalidate: 3600 },
      }
    )

    if (upstream.ok) {
      const script = await upstream.text()
      return new NextResponse(script, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
      })
    }
  } catch {
    // Si el entorno no tiene salida hacia googletagmanager.com (p. ej. CI offline),
    // devolvemos un no-op limpio (200) para no generar errores en consola.
  }

  return new NextResponse('/* ga4 upstream unavailable */', {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
