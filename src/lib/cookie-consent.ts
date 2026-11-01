export type CookieConsentChoice = 'accepted' | 'rejected'

export const COOKIE_CONSENT_KEY = 'cookie-consent'
export const COOKIE_CONSENT_EVENT = 'vi:cookie-consent-change'
export const COOKIE_SETTINGS_OPEN_EVENT = 'vi:cookie-settings-open'

export function parseCookieConsent(raw: string | null | undefined): CookieConsentChoice | null {
  if (raw === 'accepted' || raw === 'rejected') return raw
  return null
}

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    return parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_KEY))
  } catch {
    return null
  }
}

export function writeCookieConsent(choice: CookieConsentChoice): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, choice)
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: choice }))
  } catch {
    // localStorage bloqueado (modo privado estricto): no activar analítica.
  }
}

export function openCookieSettings(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_OPEN_EVENT))
}
