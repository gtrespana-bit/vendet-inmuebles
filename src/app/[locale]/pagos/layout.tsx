import type { Metadata } from 'next'
import { NOINDEX_ROBOTS } from '@/lib/seo-metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Payments & Receipts' : 'Pagos y justificantes',
    robots: NOINDEX_ROBOTS,
  }
}

export default function PagosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
