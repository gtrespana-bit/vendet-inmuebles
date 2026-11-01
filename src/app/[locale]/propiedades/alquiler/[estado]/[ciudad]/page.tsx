import { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { fetchListingsByLocation, resolveCityByParam, resolveStateByParam } from '@/lib/location-listings'
import { buildPageAlternates } from '@/lib/seo-metadata'
import Breadcrumbs from '@/components/Breadcrumbs'
import PropertyCard from '@/components/PropertyCard'

interface PageProps {
  params: Promise<{ locale: string; estado: string; ciudad: string }>
}

const loadCityRentData = cache(async function loadCityRentData(estadoParam: string, ciudadParam: string) {
  const supabase = createServerClient()
  const { state, serviceError: stateError } = await resolveStateByParam(supabase, estadoParam)
  if (!state) {
    return { state: null, city: null, properties: [], hasError: stateError }
  }
  const { city, serviceError: cityError } = await resolveCityByParam(supabase, state.id, ciudadParam)
  if (!city) {
    return { state, city: null, properties: [], hasError: stateError || cityError }
  }
  const { properties, serviceError: listingsError } = await fetchListingsByLocation(supabase, {
    operacion: 'alquiler',
    state,
    city,
    limit: 50,
  })
  return { state, city, properties, hasError: stateError || cityError || listingsError }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, estado, ciudad } = await params
  const isEn = locale === 'en'
  const { state, city, properties, hasError } = await loadCityRentData(estado, ciudad)

  if ((!state || !city) && !hasError) {
    return {
      title: isEn ? 'City not found' : 'Ciudad no encontrada',
      robots: { index: false, follow: false },
    }
  }

  const stateName = state?.name || estado
  const cityName = city?.name || decodeURIComponent(ciudad)
  const stateSlug = state?.slug || state?.id || estado
  const citySlug = city?.slug || city?.id || ciudad
  const shouldIndex = properties.length > 0 || hasError

  const title = isEn
    ? `Properties for Rent in ${cityName}, ${stateName}`
    : `Propiedades en Alquiler en ${cityName}, ${stateName}`
  const description = isEn
    ? `Find houses, apartments, commercial spaces and offices for rent in ${cityName}, ${stateName}, Venezuela.`
    : `Encuentra propiedades en alquiler en ${cityName}, ${stateName}: casas, apartamentos, locales y oficinas.`

  return {
    title,
    description,
    alternates: buildPageAlternates(locale, `/propiedades/alquiler/${stateSlug}/${citySlug}`),
    robots: { index: shouldIndex, follow: true },
  }
}

export default async function AlquilerPorCiudadPage({ params }: PageProps) {
  const { locale, estado, ciudad } = await params
  const isEn = locale === 'en'
  const { state, city, properties, hasError } = await loadCityRentData(estado, ciudad)

  if ((!state || !city) && !hasError) {
    notFound()
  }

  const stateName = state?.name || estado
  const stateSlug = state?.slug || state?.id || estado
  const cityName = city?.name || decodeURIComponent(ciudad)

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: isEn ? 'For Rent' : 'Alquiler', href: '/propiedades/alquiler' },
          { label: stateName, href: `/propiedades/alquiler/${stateSlug}` },
          { label: cityName },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-6">
        {isEn
          ? `Properties for rent in ${cityName}, ${stateName}`
          : `Propiedades en alquiler en ${cityName}, ${stateName}`}
      </h1>

      {hasError ? (
        <p role="alert" className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
          {isEn
            ? 'We could not load properties for this city right now. Please try again in a moment.'
            : 'No pudimos cargar las propiedades de esta ciudad en este momento. Intenta nuevamente en unos instantes.'}
        </p>
      ) : properties.length === 0 ? (
        <p className="text-gray-500">
          {isEn ? 'No properties available in this area.' : 'No hay propiedades disponibles en esta zona.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((propiedad) => (
            <PropertyCard key={propiedad.id} property={propiedad} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}
