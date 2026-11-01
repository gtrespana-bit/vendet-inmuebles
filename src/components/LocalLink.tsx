'use client'

import Link, { LinkProps } from 'next/link'
import { usePathname } from 'next/navigation'
import { routing } from '@/i18n/routing'

function getLocaleFromPathname(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return routing.defaultLocale
}

export function addLocaleToHref(href: string, locale: string): string {
  if (locale === routing.defaultLocale) return href
  if (href === `/${locale}` || href.startsWith(`/${locale}/`) || href.startsWith(`/${locale}?`) || href.startsWith(`/${locale}#`)) {
    return href
  }
  if (href.startsWith('#') || href.startsWith('?')) return href
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href
  if (href === '/') return `/${locale}`
  if (href.startsWith('/?') || href.startsWith('/#')) return `/${locale}${href.slice(1)}`
  return `/${locale}${href.startsWith('/') ? href : `/${href}`}`
}

function serializeQuery(query: Record<string, unknown> | string | null | undefined): string {
  if (!query) return ''
  if (typeof query === 'string') return query.startsWith('?') ? query : `?${query}`
  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item !== undefined && item !== null) params.append(key, String(item))
      }
    } else {
      params.set(key, String(raw))
    }
  }
  const str = params.toString()
  return str ? `?${str}` : ''
}

export function formatLocalizedHref(href: LinkProps['href'], locale: string): string {
  if (typeof href === 'string') {
    return addLocaleToHref(href, locale)
  }
  if (href && typeof href === 'object') {
    const obj = href as {
      pathname?: string | null
      search?: string | null
      query?: Record<string, unknown> | string | null
      hash?: string | null
    }
    const pathname = obj.pathname || '/'
    const search = obj.search
      ? (obj.search.startsWith('?') ? obj.search : `?${obj.search}`)
      : serializeQuery(obj.query)
    const hash = obj.hash
      ? (obj.hash.startsWith('#') ? obj.hash : `#${obj.hash}`)
      : ''
    return addLocaleToHref(`${pathname}${search}${hash}`, locale)
  }
  return addLocaleToHref('/', locale)
}

export default function LocalLink({ href, ...props }: LinkProps & React.ComponentPropsWithoutRef<'a'>) {
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  const localizedHref = formatLocalizedHref(href, locale)

  return <Link href={localizedHref} {...props} />
}
