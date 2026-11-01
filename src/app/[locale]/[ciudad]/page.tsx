import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingCiudad from './LandingCiudad'
import { getCiudadBySlug, generateCityParams } from '@/lib/ubicaciones-seo'
import Breadcrumbs from '@/components/Breadcrumbs'
import { routing } from '@/i18n/routing'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { buildPageAlternates, SITE_URL } from '@/lib/seo-metadata'

type Props = {
  params: Promise<{ locale: string; ciudad: string }>
}

const getCityInventory = cache(async function getCityInventory(cityName: string) {
  if (!isSupabaseConfigured()) {
    return { properties: [], total: 0, serviceError: true }
  }
  try {
    const { data, count, error } = await supabase
      .from('vw_propiedades_publicas')
      .select('id, slug, titulo, precio, moneda, estado, main_image_url, ciudad, destacado, destacado_hasta', { count: 'exact' })
      .eq('activo', true)
      .ilike('ciudad', cityName)
      .order('creado_en', { ascending: false })
      .limit(24)

    if (error) {
      return { properties: [], total: 0, serviceError: true }
    }
    return { properties: data || [], total: count || 0, serviceError: false }
  } catch {
    return { properties: [], total: 0, serviceError: true }
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)

  if (!ciudadSEO) {
    return {
      title: locale === 'en' ? 'City not found' : 'Ciudad no encontrada',
      robots: { index: false, follow: false },
    }
  }

  const { total, serviceError } = await getCityInventory(ciudadSEO.nombre)
  const shouldIndex = total > 0 || serviceError
  const isEnglish = locale === 'en'
  const alternates = buildPageAlternates(locale, `/${ciudadSEO.slug}`)

  const title = isEnglish
    ? `Properties for Sale & Rent in ${ciudadSEO.nombre}, ${ciudadSEO.estado}`
    : `Inmuebles en Venta y Alquiler en ${ciudadSEO.nombre}, ${ciudadSEO.estado}`
  const description = isEnglish
    ? `Explore houses, apartments, land and commercial spaces for sale or rent in ${ciudadSEO.nombre}, ${ciudadSEO.estado}, Venezuela.`
    : `Explora casas, apartamentos, terrenos y locales en venta o alquiler en ${ciudadSEO.nombre}, ${ciudadSEO.estado}. Contacto directo en Venezuela Inmuebles.`

  return {
    title,
    description,
    keywords: ciudadSEO.keywords,
    openGraph: {
      title,
      description,
      url: String(alternates.canonical),
      siteName: 'Venezuela Inmuebles',
      type: 'website',
      locale: isEnglish ? 'en_US' : 'es_VE',
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: title }],
    },
    alternates,
    robots: {
      index: shouldIndex,
      follow: true,
    },
  }
}

export const revalidate = 3600
export const dynamicParams = true

const CORE_PREBUILT_CITY_SLUGS = new Set([
  'caracas',
  'valencia',
  'san-diego',
  'maracaibo',
  'barquisimeto',
  'maracay',
  'lecherias',
  'merida',
  'san-cristobal',
  'puerto-ordaz',
])

export async function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    generateCityParams()
      .filter((cityParams) => CORE_PREBUILT_CITY_SLUGS.has(cityParams.ciudad))
      .map((cityParams) => ({ locale, ...cityParams }))
  )
}

export default async function CiudadPage({ params }: Props) {
  const { ciudad, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)

  if (!ciudadSEO) notFound()

  const { properties, total } = await getCityInventory(ciudadSEO.nombre)
  const breadcrumbItems = [{ label: ciudadSEO.nombre, href: undefined }]

  const cityJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: locale === 'en'
      ? `Properties in ${ciudadSEO.nombre}, ${ciudadSEO.estado}`
      : `Inmuebles en ${ciudadSEO.nombre}, ${ciudadSEO.estado}`,
    description: ciudadSEO.descripcion,
    url: `${SITE_URL}${locale === 'en' ? '/en' : ''}/${ciudadSEO.slug}`,
    about: {
      '@type': 'City',
      name: ciudadSEO.nombre,
      containedInPlace: {
        '@type': 'State',
        name: ciudadSEO.estado,
        containedInPlace: {
          '@type': 'Country',
          name: 'Venezuela',
          addressCountry: 'VE',
        },
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJsonLd).replace(/</g, '\\u003c') }}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <LandingCiudad
        slug={ciudadSEO.slug}
        nombre={ciudadSEO.nombre}
        estado={ciudadSEO.estado}
        descripcion={ciudadSEO.descripcion}
        initialProperties={properties}
        initialTotal={total}
      />
    </>
  )
}
