import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { fetchListingsByLocation, resolveCityByParam, resolveStateByParam } from '@/lib/location-listings'
import Breadcrumbs from '@/components/Breadcrumbs'
import PropertyCard from '@/components/PropertyCard'

interface PageProps {
  params: Promise<{ locale: string; estado: string; ciudad: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, estado, ciudad } = await params
  const isEn = locale === 'en'
  const supabase = createServerClient()
  const { state } = await resolveStateByParam(supabase, estado)
  const { city } = state ? await resolveCityByParam(supabase, state.id, ciudad) : { city: null }

  const stateName = state?.name || estado
  const cityName = city?.name || decodeURIComponent(ciudad)
  const stateSlug = state?.slug || state?.id || estado
  const citySlug = city?.slug || city?.id || ciudad

  const title = isEn
    ? `Properties for sale in ${cityName}, ${stateName}`
    : `Propiedades en venta en ${cityName}, ${stateName}`
  const description = isEn
    ? `Find houses, apartments, land and commercial spaces for sale in ${cityName}, ${stateName}.`
    : `Encuentra propiedades en venta en ${cityName}, ${stateName}. Casas, apartamentos, terrenos y más.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://venezuela-inmuebles.online${isEn ? '/en' : ''}/propiedades/venta/${stateSlug}/${citySlug}`,
      languages: {
        'es-VE': `https://venezuela-inmuebles.online/propiedades/venta/${stateSlug}/${citySlug}`,
        'en-US': `https://venezuela-inmuebles.online/en/propiedades/venta/${stateSlug}/${citySlug}`,
      },
    },
  }
}

export default async function VentasPorCiudadPage({ params }: PageProps) {
  const { locale, estado, ciudad } = await params
  const isEn = locale === 'en'
  const supabase = createServerClient()

  const { state, serviceError: stateError } = await resolveStateByParam(supabase, estado)
  if (!state && !stateError) {
    notFound()
  }

  const { city, serviceError: cityError } = state
    ? await resolveCityByParam(supabase, state.id, ciudad)
    : { city: null, serviceError: true }

  if (state && !city && !cityError) {
    notFound()
  }

  const { properties, serviceError: listingsError } = state && city
    ? await fetchListingsByLocation(supabase, { operacion: 'venta', state, city, limit: 50 })
    : { properties: [], serviceError: true }

  const stateName = state?.name || estado
  const stateSlug = state?.slug || state?.id || estado
  const cityName = city?.name || decodeURIComponent(ciudad)
  const hasError = stateError || cityError || listingsError

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: isEn ? 'For Sale' : 'Venta', href: '/propiedades/venta' },
          { label: stateName, href: `/propiedades/venta/${stateSlug}` },
          { label: cityName },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-6">
        {isEn
          ? `Properties for sale in ${cityName}, ${stateName}`
          : `Propiedades en venta en ${cityName}, ${stateName}`}
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
