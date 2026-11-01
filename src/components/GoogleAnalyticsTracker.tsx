'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { COOKIE_CONSENT_EVENT, readCookieConsent } from '@/lib/cookie-consent'
import { sendGa4PageView, updateGa4Consent } from '@/lib/ga4'

function GoogleAnalyticsInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isInitialLoadRef = useRef(true)

  // Mantener Google Consent Mode v2 sincronizado con el banner y entre pestañas
  useEffect(() => {
    const syncConsent = () => {
      const current = readCookieConsent()
      if (current === 'accepted' || current === 'rejected') {
        updateGa4Consent(current)
      }
    }
    syncConsent()
    window.addEventListener(COOKIE_CONSENT_EVENT, syncConsent)
    window.addEventListener('storage', syncConsent)
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, syncConsent)
      window.removeEventListener('storage', syncConsent)
    }
  }, [])

  // Registrar navegaciones SPA del App Router sin duplicar el primer page_view de <head>
  const search = searchParams?.toString() || ''
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }
    if (!pathname) return
    sendGa4PageView(pathname, search)
  }, [pathname, search])

  return null
}

export default function GoogleAnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsInner />
    </Suspense>
  )
}
