import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { NOINDEX_ROBOTS } from '@/lib/seo-metadata'

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
}

export default async function LegacyPublicarLayout({
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  permanentRedirect(locale === 'en' ? '/en/publicar-inmueble' : '/publicar-inmueble')
}
