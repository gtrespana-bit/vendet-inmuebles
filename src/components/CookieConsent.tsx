'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import {
  COOKIE_SETTINGS_OPEN_EVENT,
  readCookieConsent,
  writeCookieConsent,
} from '@/lib/cookie-consent'

export default function CookieConsent() {
  const en = useLocale() === 'en'
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!readCookieConsent()) {
      setShowBanner(true)
    }
    const handleOpen = () => setShowBanner(true)
    window.addEventListener(COOKIE_SETTINGS_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(COOKIE_SETTINGS_OPEN_EVENT, handleOpen)
  }, [])

  const choose = (choice: 'accepted' | 'rejected') => {
    writeCookieConsent(choice)
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <section
      role="region"
      aria-label={en ? 'Cookie preferences' : 'Preferencias de cookies'}
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur text-white p-4 shadow-2xl border-t border-gray-700"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 text-sm">
          <p className="mb-1 font-semibold">
            {en ? 'Privacy & Cookies' : 'Privacidad y uso de cookies'}
          </p>
          <p className="text-gray-300">
            {en
              ? 'We use strictly necessary storage for sign-in and security, plus optional analytics to measure site performance. Analytics only run if you accept. Read our '
              : 'Usamos almacenamiento estrictamente necesario para tu sesión y seguridad, y analítica opcional para medir el rendimiento del portal. La analítica solo se activa si aceptas. Consulta nuestra '}
            <LocalLink href="/politica-de-privacidad" className="text-[var(--gold-text)] underline hover:brightness-110">
              {en ? 'privacy policy' : 'política de privacidad'}
            </LocalLink>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            type="button"
            onClick={() => choose('rejected')}
            className="px-4 py-2 text-sm font-medium text-gray-200 hover:text-white border border-gray-500 rounded-lg hover:border-gray-300 transition"
          >
            {en ? 'Essential only' : 'Solo esenciales'}
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="px-4 py-2 text-sm font-bold text-[var(--on-gold)] bg-brand-accent rounded-lg hover:brightness-105 transition"
          >
            {en ? 'Accept analytics' : 'Aceptar analítica'}
          </button>
        </div>
      </div>
    </section>
  )
}
