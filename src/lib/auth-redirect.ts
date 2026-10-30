const APP_ORIGIN = 'https://venezuela-inmuebles.online'

/** Accept only same-origin paths so auth redirects cannot send users off-site. */
export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null

  try {
    const url = new URL(value, APP_ORIGIN)
    if (url.origin !== APP_ORIGIN) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function localizePath(path: string, locale: string): string {
  if (path === '/' || path.startsWith('/en/') || path === '/en') return path
  return locale === 'en' ? `/en${path}` : path
}
