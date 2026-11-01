import type { Metadata } from 'next'

export const SITE_URL = 'https://venezuela-inmuebles.online'

/**
 * Construye `alternates` (canonical + hreflang es-VE / en-US / x-default)
 * para una ruta pública concreta, evitando heredar la portada por accidente (F20).
 */
export function buildPageAlternates(locale: string, pathname = ''): NonNullable<Metadata['alternates']> {
  const clean = !pathname || pathname === '/'
    ? ''
    : pathname.startsWith('/')
      ? pathname
      : `/${pathname}`

  const esUrl = `${SITE_URL}${clean}`
  const enUrl = `${SITE_URL}/en${clean || ''}`

  return {
    canonical: locale === 'en' ? enUrl : esUrl,
    languages: {
      'es-VE': esUrl,
      'en-US': enUrl,
      'x-default': esUrl,
    },
  }
}

/**
 * Directiva uniforme para páginas de cuenta, autenticación, pagos y utilidades
 * que no deben indexarse en buscadores (F21).
 */
export const NOINDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
}
