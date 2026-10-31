import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * Analítica interna del sitio.
 *
 * Todos los eventos van a public.eventos_web (ver supabase/migrations/007).
 * Esta capa es "best-effort": NUNCA lanza errores hacia la request principal.
 */

export const EVENTOS_VALIDOS = new Set([
  'pageview', 'vista_inmueble', 'registro', 'login', 'logout',
  'publicacion_creada', 'mensaje_enviado', 'inicio_chat',
  'favorito', 'busqueda', 'contacto', 'compra_creditos',
  'click_contacto', 'compartir',
])

const UA_BOT = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|linkedinbot|headless/i

export function sanitizeRuta(ruta: unknown): string {
  const r = typeof ruta === 'string' ? ruta : '/'
  const clean = r.startsWith('/') ? r : `/${r}`
  return clean.slice(0, 500)
}

function sliceText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const t = value.slice(0, max).trim()
  return t === '' ? null : t
}

function sanitizeMeta(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object') return null
  try {
    const json = JSON.stringify(meta)
    if (json.length > 2000) return { truncado: true }
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function parseUserAgent(ua: string | null | undefined): { dispositivo: string; navegador: string } {
  const agent = (ua || '').toLowerCase()
  let dispositivo = 'escritorio'
  if (/ipad|tablet|playbook|silk/.test(agent)) dispositivo = 'tablet'
  else if (/mobile|iphone|android|windows phone/.test(agent)) dispositivo = 'movil'

  let navegador = 'otro'
  if (/edg\//.test(agent)) navegador = 'Edge'
  else if (/chrome\//.test(agent) || /crios\//.test(agent)) navegador = 'Chrome'
  else if (/firefox\//.test(agent) || /fxios\//.test(agent)) navegador = 'Firefox'
  else if (/safari\//.test(agent) && !/chrome/.test(agent)) navegador = 'Safari'
  else if (/opera|opr\//.test(agent)) navegador = 'Opera'

  return { dispositivo, navegador }
}

export function esBot(ua: string | null | undefined): boolean {
  return UA_BOT.test(ua || '')
}

let clienteAdmin: SupabaseClient | null = null
function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!clienteAdmin) {
    clienteAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return clienteAdmin
}

export interface EventoOpts {
  ruta: string
  titulo?: string | null
  meta?: Record<string, unknown> | null
  userId?: string | null
  sessionId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null
  req?: NextRequest
}

/**
 * Inserta un evento en eventos_web usando la service role key.
 * Extrae dispositivo/navegador/pais/ip de los headers de la request.
 */
export async function registrarEvento(tipo: string, opts: EventoOpts): Promise<void> {
  try {
    if (!EVENTOS_VALIDOS.has(tipo)) return
    const sb = getAdminClient()
    if (!sb) return

    const headers = opts.req?.headers
    const ua = headers?.get('user-agent') || ''
    if (esBot(ua)) return

    const { dispositivo, navegador } = parseUserAgent(ua)
    const pais = sliceText(headers?.get('x-vercel-ip-country'), 8)
    const ip = (headers?.get('x-forwarded-for') || '').split(',')[0]?.trim().slice(0, 45) || null
    const referrer = sliceText(headers?.get('referer'), 500)

    await sb.from('eventos_web').insert({
      tipo,
      ruta: sanitizeRuta(opts.ruta),
      titulo: sliceText(opts.titulo, 200),
      referrer,
      utm_source: sliceText(opts.utm?.source, 100),
      utm_medium: sliceText(opts.utm?.medium, 100),
      utm_campaign: sliceText(opts.utm?.campaign, 100),
      session_id: sliceText(opts.sessionId, 64),
      user_id: opts.userId || null,
      pais,
      dispositivo,
      navegador,
      ip,
      meta: sanitizeMeta(opts.meta),
    })
  } catch (e) {
    // Nunca interrumpir la operación principal por un fallo de analítica
    console.warn('analytics: no se pudo registrar el evento', tipo, e)
  }
}

/** Ruta (pathname) del referer si es del mismo sitio; si no, '/'. */
export function rutaDesdeReferer(req: NextRequest): string {
  try {
    const referer = req.headers.get('referer')
    if (!referer) return '/'
    const url = new URL(referer)
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://venezuela-inmuebles.online').origin) return '/'
    return sanitizeRuta(url.pathname + url.search)
  } catch {
    return '/'
  }
}

/**
 * Extrae el user id del JWT de sesión guardado en cookies (SOLO para analítica;
 * no sirve para autorización: no verifica la firma, igual que getServerUser).
 */
export function userIdDesdeCookie(req: NextRequest): string | null {
  try {
    const cookie = req.cookies.getAll().find((c) => c.name.includes('auth-token'))
    if (!cookie?.value) return null
    let parsed: any = null
    try {
      parsed = JSON.parse(cookie.value)
    } catch {
      parsed = JSON.parse(decodeURIComponent(cookie.value))
    }
    const token: string | undefined = parsed?.access_token
    if (!token) return null
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'))
    return typeof payload?.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}
