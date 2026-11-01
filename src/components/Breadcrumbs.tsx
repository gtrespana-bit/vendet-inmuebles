'use client'

import { useLocale } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import { ChevronRight, Home } from 'lucide-react'
import { SITE_URL } from '@/lib/seo-metadata'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const locale = useLocale()
  const prefix = locale === 'en' ? '/en' : ''

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'en' ? 'Home' : 'Inicio',
        item: `${SITE_URL}${prefix}`,
      },
      ...items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 2,
        name: item.label,
        ...(item.href ? { item: `${SITE_URL}${prefix}${item.href}` } : {}),
      })),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <nav aria-label="Breadcrumb" className="py-3 px-4 bg-gray-50 border-b">
        <ol className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-gray-600 flex-wrap">
          <li>
            <LocalLink href="/" className="hover:text-brand-primary transition flex items-center" aria-label={locale === 'en' ? 'Home' : 'Inicio'}>
              <Home size={14} aria-hidden="true" />
            </LocalLink>
          </li>
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <ChevronRight size={12} className="text-gray-400" aria-hidden="true" />
              {item.href ? (
                <LocalLink
                  href={item.href}
                  className="hover:text-brand-primary transition truncate max-w-[200px]"
                >
                  {item.label}
                </LocalLink>
              ) : (
                <span className="text-gray-900 font-medium truncate max-w-[200px]">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
