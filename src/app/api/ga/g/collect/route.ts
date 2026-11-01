import { NextRequest, NextResponse } from 'next/server'
import { GA4_MEASUREMENT_ID } from '@/lib/ga4'

const COLLECT_TIMEOUT_MS = 4000
const IPV4_OR_IPV6_RE = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]{2,45}$/

function extractClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first && IPV4_OR_IPV6_RE.test(first) && first !== '127.0.0.1' && first !== '::1') {
      return first
    }
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp && IPV4_OR_IPV6_RE.test(realIp) && realIp !== '127.0.0.1' && realIp !== '::1') {
    return realIp
  }
  return null
}

function containsExpectedMeasurementId(searchParams: URLSearchParams, bodyText: string): boolean {
  const queryTid = searchParams.get('tid')?.trim()
  if (queryTid) return queryTid === GA4_MEASUREMENT_ID
  if (bodyText && bodyText.includes(`tid=${GA4_MEASUREMENT_ID}`)) return true
  return false
}

async function forwardCollect(request: NextRequest): Promise<NextResponse> {
  const bodyText = request.method === 'POST' ? await request.text().catch(() => '') : ''
  const upstreamParams = new URLSearchParams(request.nextUrl.searchParams)

  if (!containsExpectedMeasurementId(upstreamParams, bodyText)) {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const clientIp = extractClientIp(request)
  if (clientIp && !upstreamParams.has('_uip')) {
    upstreamParams.set('_uip', clientIp)
  }

  const headers: Record<string, string> = {
    'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
  }
  const acceptLang = request.headers.get('accept-language')
  if (acceptLang) headers['Accept-Language'] = acceptLang
  const contentType = request.headers.get('content-type')
  if (contentType && request.method === 'POST') headers['Content-Type'] = contentType
  if (clientIp) headers['X-Forwarded-For'] = clientIp

  try {
    const query = upstreamParams.toString()
    const targetUrl = `https://www.google-analytics.com/g/collect${query ? `?${query}` : ''}`
    await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === 'POST' && bodyText ? bodyText : undefined,
      signal: AbortSignal.timeout(COLLECT_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch {
    // Nunca propagar fallos de red de terceros hacia la consola del navegador
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}

export async function GET(request: NextRequest) {
  return forwardCollect(request)
}

export async function POST(request: NextRequest) {
  return forwardCollect(request)
}
