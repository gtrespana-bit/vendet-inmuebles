/**
 * Analítica interna del sitio — lado cliente.
 * Envía eventos a /api/track con sendBeacon (sobrevive a la navegación).
 */

const SESSION_KEY = 'vi_sid'
const UTM_KEY = 'vi_utm'

function uuidLike(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* noop */ }
  return 's-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function getSessionId(): string {
  try {
    let sid = window.localStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = uuidLike()
      window.localStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  } catch {
    return uuidLike()
  }
}

/** Captura UTM de la URL actual y las guarda (first-touch) en localStorage. */
export function captureUtmFromLocation(): { source: string | null; medium: string | null; campaign: string | null } | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const source = params.get('utm_source')
    const medium = params.get('utm_medium')
    const campaign = params.get('utm_campaign')
    if (!source && !medium && !campaign) {
      const saved = window.localStorage.getItem(UTM_KEY)
      return saved ? JSON.parse(saved) : null
    }
    const utm = { source, medium, campaign }
    if (!window.localStorage.getItem(UTM_KEY)) {
      window.localStorage.setItem(UTM_KEY, JSON.stringify(utm))
    }
    return utm
  } catch {
    return null
  }
}

export interface TrackPayload {
  ruta?: string
  titulo?: string
  meta?: Record<string, unknown>
}

/**
 * Envía un evento de analítica. No bloquea: usa sendBeacon y cae a fetch keepalive.
 */
export function trackEvent(tipo: string, payload: TrackPayload = {}): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({
      tipo,
      ruta: payload.ruta || (window.location.pathname + window.location.search),
      titulo: payload.titulo,
      meta: payload.meta,
      sessionId: getSessionId(),
      utm: captureUtmFromLocation(),
    })
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', blob)) return
    fetch('/api/track', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => { /* silencio */ })
  } catch { /* silencio */ }
}
