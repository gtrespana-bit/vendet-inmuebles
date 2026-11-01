import { permanentRedirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ locale: string }>
}

/**
 * Redirección permanente (308) al hub principal de propiedades en venta,
 * evitando páginas puente en el índice y consolidando autoridad SEO.
 */
export default async function PropiedadesPage({ params }: PageProps) {
  const { locale } = await params
  permanentRedirect(locale === 'en' ? '/en/propiedades/venta' : '/propiedades/venta')
}
