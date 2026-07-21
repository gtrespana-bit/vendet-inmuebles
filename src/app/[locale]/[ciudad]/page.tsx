import { Metadata } from 'next'
import LandingCiudad from './LandingCiudad'
import { getCiudadBySlug, generateCityParams } from '@/lib/ubicaciones-seo'
import Breadcrumbs from '@/components/Breadcrumbs'

type Props = {
  params: Promise<{ ciudad: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)
  
  if (!ciudadSEO) {
    return {
      title: 'Ciudad no encontrada | VendeT.online',
      description: 'La ciudad solicitada no existe en nuestro directorio de clasificados.',
    }
  }

  const title = ciudadSEO.titulo
  const description = ciudadSEO.descripcion
  const keywords = ciudadSEO.keywords.join(', ')

  return {
    title,
    description,
    keywords: ciudadSEO.keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_VE',
    },
    alternates: {
      canonical: `https://vendet.online/${ciudad}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// Generar rutas estáticas para TODAS las ciudades de Venezuela
export async function generateStaticParams() {
  return generateCityParams()
}

export default async function CiudadPage({ params }: Props) {
  const { ciudad } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)
  
  if (!ciudadSEO) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Ciudad no encontrada</h1>
        <p className="text-gray-600">La ciudad que buscas no está disponible aún.</p>
      </div>
    )
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { label: ciudadSEO.nombre, href: undefined }
  ]

  // JSON-LD City Schema
  const cityJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'City',
    name: ciudadSEO.nombre,
    containedInPlace: {
      '@type': 'State',
      name: ciudadSEO.estado,
      containedInPlace: {
        '@type': 'Country',
        name: 'Venezuela',
        addressCountry: 'VE'
      }
    },
    description: ciudadSEO.descripcion,
    sameAs: `https://vendet.online/${ciudad}`
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJsonLd) }}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <LandingCiudad 
        slug={ciudad} 
        nombre={ciudadSEO.nombre}
        estado={ciudadSEO.estado}
        descripcion={ciudadSEO.descripcion}
      />
    </>
  )
}

// ISR: cache city landing pages for 5 minutes
export const revalidate = 300
