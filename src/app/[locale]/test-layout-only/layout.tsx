import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NOINDEX_ROBOTS } from '@/lib/seo-metadata'

export const metadata: Metadata = { robots: NOINDEX_ROBOTS }

export default function TestRouteLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
