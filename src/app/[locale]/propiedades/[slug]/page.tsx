import { permanentRedirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * Ruta legacy de detalle de propiedad.
 * El canonical es /inmueble/[id]; redirigimos permanentemente (308) para
 * consolidar el SEO y evitar contenido duplicado.
 */
export default async function PropiedadesSlugRedirect({ params }: PageProps) {
  const { locale, slug } = await params
  const prefix = locale === 'en' ? '/en' : ''
  permanentRedirect(`${prefix}/inmueble/${slug}`)
}
