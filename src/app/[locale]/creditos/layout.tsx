import type { Metadata } from 'next'
import { buildPageAlternates } from '@/lib/seo-metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const en = locale === 'en'
  return {
    title: en ? 'Promotional Credits' : 'Créditos promocionales',
    description: en
      ? 'Boost your listings to #1 or feature them for 12h, 24h or 48h with non-expiring credit packages.'
      : 'Sube tus anuncios al #1 o destácalos durante 12h, 24h o 48h con paquetes de créditos sin vencimiento.',
    alternates: buildPageAlternates(locale, '/creditos'),
  }
}

export default function CreditosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
