'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import TrackPageView from '@/components/TrackPageView'
import { COOKIE_CONSENT_EVENT, readCookieConsent } from '@/lib/cookie-consent'

/**
 * Monta la telemetría de tráfico únicamente cuando la persona usuaria otorgó
 * consentimiento explícito (`cookie-consent === 'accepted'`) — F26.
 */
export default function AnalyticsGate() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    setAllowed(readCookieConsent() === 'accepted')
    const onConsentChange = () => setAllowed(readCookieConsent() === 'accepted')
    window.addEventListener(COOKIE_CONSENT_EVENT, onConsentChange)
    window.addEventListener('storage', onConsentChange)
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, onConsentChange)
      window.removeEventListener('storage', onConsentChange)
    }
  }, [])

  if (!allowed) return null

  return (
    <>
      <Analytics />
      <SpeedInsights />
      <TrackPageView />
    </>
  )
}
