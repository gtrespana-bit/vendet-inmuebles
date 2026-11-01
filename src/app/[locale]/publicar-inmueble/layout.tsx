import type { Metadata } from 'next'
import { NOINDEX_ROBOTS } from '@/lib/seo-metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const en = locale === 'en'
  return {
    title: en ? 'Publish a Property' : 'Publicar Inmueble',
    description: en
      ? 'Publish your house, apartment, land or commercial space on Venezuela Inmuebles.'
      : 'Publica tu casa, apartamento, terreno o local comercial en Venezuela Inmuebles.',
    robots: NOINDEX_ROBOTS,
  }
}

export default function PublicarInmuebleLayout({ children }: { children: React.ReactNode }) {
  return children
}
