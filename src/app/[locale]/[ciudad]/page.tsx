import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingCiudad from './LandingCiudad'
import { getCiudadBySlug, generateCityParams } from '@/lib/ubicaciones-seo'
import Breadcrumbs from '@/components/Breadcrumbs'
import { routing } from '@/i18n/routing'

type Props = {
  params: Promise<{ locale: string; ciudad: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)

  if (!ciudadSEO) {
    return {
      title: locale === 'en' ? 'City not found' : 'Ciudad no encontrada',
      robots: { index: false, follow: false },
    }
  }

  const isEnglish = locale === 'en'
  const title = isEnglish
    ? `Properties in ${ciudadSEO.nombre}, ${ciudadSEO.estado}`
    : `Inmuebles en ${ciudadSEO.nombre}, ${ciudadSEO.estado}`
  const description = isEnglish
    ? `Explore properties for sale or rent in ${ciudadSEO.nombre}, ${ciudadSEO.estado}. Browse current real estate listings in Venezuela.`
    : `Explora inmuebles en venta o alquiler en ${ciudadSEO.nombre}, ${ciudadSEO.estado}. Consulta anuncios inmobiliarios en Venezuela.`

  return {
    title,
    description,
    keywords: ciudadSEO.keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: isEnglish ? 'en_US' : 'es_VE',
    },
    alternates: {
      canonical: `https://venezuela-inmuebles.online${isEnglish ? '/en' : ''}/${ciudad}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// Generar rutas estáticas para TODAS las ciudades de Venezuela
export async function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    generateCityParams().map((cityParams) => ({ locale, ...cityParams }))
  )
}

export default async function CiudadPage({ params }: Props) {
  const { ciudad, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)

  if (!ciudadSEO) notFound()

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
    sameAs: `https://venezuela-inmuebles.online${locale === 'en' ? '/en' : ''}/${ciudad}`
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJsonLd).replace(/</g, '\\u003c') }}
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
export const dynamicParams = false
