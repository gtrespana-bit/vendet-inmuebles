export const DEFAULT_GA4_MEASUREMENT_ID = 'G-BSE60G6TX4'
export const GA4_SCRIPT_PATH = '/api/ga/js'
export const GA4_TRANSPORT_PATH = '/api/ga'

export const GA4_MEASUREMENT_ID =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()) ||
  DEFAULT_GA4_MEASUREMENT_ID

const GA_MEASUREMENT_ID_RE = /^G-[A-Z0-9]{6,16}$/

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'token_hash',
  'code',
  'access_token',
  'refresh_token',
  'email',
  'secret',
  'password',
])

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function isValidGaMeasurementId(value: string | null | undefined): value is string {
  return typeof value === 'string' && GA_MEASUREMENT_ID_RE.test(value.trim())
}

/**
 * Excluye paneles de administración, rutas internas de diagnóstico y endpoints API
 * para no contaminar métricas comerciales ni exponer rutas internas en GA4.
 */
export function shouldTrackGaPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const clean = pathname.trim()
  if (!clean.startsWith('/')) return false

  const withoutLocale = clean === '/en' ? '/' : clean.startsWith('/en/') ? clean.slice(3) : clean
  if (
    withoutLocale === '/admin' ||
    withoutLocale.startsWith('/admin/') ||
    withoutLocale === '/api' ||
    withoutLocale.startsWith('/api/') ||
    withoutLocale === '/diagnostico' ||
    withoutLocale.startsWith('/diagnostico/') ||
    withoutLocale.startsWith('/test-')
  ) {
    return false
  }
  return true
}

/**
 * Enmascara tokens privados en rutas dinámicas (`/invitacion/<token>`) y elimina
 * parámetros sensibles de query string antes de enviarlos a Google Analytics 4.
 */
export function sanitizeGaPagePath(pathname: string, search?: string | null): string {
  const safePathname = pathname
    .replace(/^(\/en)?\/invitacion\/[^/?#]+/i, (_match, prefix = '') => `${prefix}/invitacion/[token]`)
    .replace(/^(\/en)?\/reset-password\/[^/?#]+/i, (_match, prefix = '') => `${prefix}/reset-password`)

  if (!search) return safePathname
  const rawQuery = search.startsWith('?') ? search.slice(1) : search
  if (!rawQuery) return safePathname

  const params = new URLSearchParams(rawQuery)
  for (const key of Array.from(params.keys())) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.delete(key)
    }
  }

  const serialized = params.toString()
  return serialized ? `${safePathname}?${serialized}` : safePathname
}

/**
 * Genera el script inicial de Google Analytics 4 con Google Consent Mode v2:
 * - Por defecto arranca con `analytics_storage: 'denied'` salvo que la persona
 *   usuaria ya haya aceptado explícitamente en `cookie-consent`.
 * - Desactiva señales publicitarias (`allow_google_signals: false`).
 * - Redacta rutas con tokens de invitación y omite `/admin` en el arranque.
 */
export function buildGa4BootstrapScript(measurementId: string = GA4_MEASUREMENT_ID): string {
  if (!isValidGaMeasurementId(measurementId)) return ''
  const id = measurementId.trim()
  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){window.dataLayer.push(arguments);}',
    'var __viGranted=false;',
    "try{__viGranted=window.localStorage.getItem('cookie-consent')==='accepted';}catch(e){}",
    "gtag('consent','default',{analytics_storage:__viGranted?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});",
    "gtag('js',new Date());",
    '(function(){',
    'var p=window.location.pathname||"/";',
    'var clean=p==="/en"?"/":(p.indexOf("/en/")===0?p.slice(3):p);',
    'var skip=clean==="/admin"||clean.indexOf("/admin/")===0||clean==="/diagnostico"||clean.indexOf("/diagnostico/")===0||clean.indexOf("/test-")===0;',
    'var masked=p.replace(/^(\\/en)?\\/invitacion\\/[^/?#]+/i,function(_,pr){return (pr||"")+"/invitacion/[token]";}).replace(/^(\\/en)?\\/reset-password\\/[^/?#]+/i,function(_,pr){return (pr||"")+"/reset-password";});',
    'var q="";',
    'try{if(window.location.search){var sp=new URLSearchParams(window.location.search);["token","token_hash","code","access_token","refresh_token","email","secret","password"].forEach(function(k){sp.delete(k);});var s=sp.toString();if(s)q="?"+s;}}catch(e){}',
    'var safePath=masked+q;',
    'var transportUrl=window.location.origin+"/api/ga";',
    `gtag('config','${id}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false,transport_url:transportUrl,first_party_collection:true,page_path:safePath,page_location:window.location.origin+safePath,send_page_view:!skip});`,
    '})();',
  ].join('')
}

function clearGaCookies(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const cookies = document.cookie ? document.cookie.split(';') : []
  const hostParts = window.location.hostname.split('.')
  const rootDomain = hostParts.length >= 2 ? `.${hostParts.slice(-2).join('.')}` : ''

  for (const raw of cookies) {
    const name = raw.split('=')[0]?.trim()
    if (!name || (!name.startsWith('_ga') && !name.startsWith('_gid'))) continue
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
    if (rootDomain) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${rootDomain}; SameSite=Lax`
    }
  }
}

export function updateGa4Consent(choice: 'accepted' | 'rejected'): void {
  if (typeof window === 'undefined') return
  const granted = choice === 'accepted'
  window.gtag?.('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  if (!granted) {
    clearGaCookies()
  }
}

export function sendGa4PageView(pathname: string, search?: string | null): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (!isValidGaMeasurementId(GA4_MEASUREMENT_ID)) return
  if (!shouldTrackGaPath(pathname)) return

  const pagePath = sanitizeGaPagePath(pathname, search)
  window.gtag('event', 'page_view', {
    send_to: GA4_MEASUREMENT_ID,
    page_path: pagePath,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
    page_location:
      typeof window !== 'undefined' ? `${window.location.origin}${pagePath}` : undefined,
  })
}

export function trackGa4Event(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (!isValidGaMeasurementId(GA4_MEASUREMENT_ID)) return
  if (typeof window.location?.pathname === 'string' && !shouldTrackGaPath(window.location.pathname)) {
    return
  }
  window.gtag('event', eventName, params || {})
}
