'use client'

import { usePathname } from 'next/navigation'
import { routing } from '@/i18n/routing'

// Static imports - webpack bundles these so they're available synchronously
import esMessages from '@/i18n/dictionaries/es.json'
import enMessages from '@/i18n/dictionaries/en.json'

type Messages = Record<string, any>

function getLocaleFromPathname(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return routing.defaultLocale
}

// Pre-populated message cache (synchronous, available on first render)
const messageCache: Record<string, Messages> = {
  es: esMessages as unknown as Messages,
  en: enMessages as unknown as Messages,
}

export function useLocalizedMessages() {
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  
  // Cached messages are available synchronously (prevents hydration mismatch)
  const cachedMessages = messageCache[locale] || messageCache[routing.defaultLocale] || {}

  const t = (key: string): string => {
    const parts = key.split('.')
    let result: any = cachedMessages
    for (const part of parts) {
      if (result == null) return key
      result = result[part]
    }
    return typeof result === 'string' ? result : key
  }

  return { locale, messages: cachedMessages, t }
}
