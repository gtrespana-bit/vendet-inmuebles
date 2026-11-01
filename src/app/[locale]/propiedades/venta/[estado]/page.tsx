import { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import { createServerClient } from '@/lib/supabase-server'
import { fetchListingsByLocation, resolveStateByParam } from '@/lib/location-listings'
import { buildPageAlternates } from '@/lib/seo-metadata'
import PropertyCard from '@/components/PropertyCard'
import Breadcrumbs from '@/components/Breadcrumbs'

interface PageProps {
  params: Promise<{ locale: string; estado: string }>
}

const loadStateSaleData = cache(async function loadStateSaleData(estadoParam: string) {
  const supabase = createServerClient()
  const { state, serviceError: stateError } = await resolveStateByParam(supabase, estadoParam)
  if (!state) {
    return { state: null, ciudades: null, properties: [], hasError: stateError }
  }
  const [{ data: ciudades }, { properties, serviceError: listingsError }] = await Promise.all([
    supabase.from('cities').select('id, name, slug').eq('state_id', state.id).order('name'),
    fetchListingsByLocation(supabase, { operacion: 'venta', state, limit: 50 }),
  ])
  return { state, ciudades, properties, hasError: stateError || listingsError }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, estado } = await params
  const isEn = locale === 'en'
  const { state, properties, hasError } = await loadStateSaleData(estado)

  if (!state && !hasError) {
    return {
      title: isEn ? 'State not found' : 'Estado no encontrado',
      robots: { index: false, follow: false },
    }
  }

  const estadoName = state?.name || estado
  const slug = state?.slug || state?.id || estado
  const shouldIndex = properties.length > 0 || hasError

  const title = isEn
    ? `Properties for Sale in ${estadoName}`
    : `Propiedades en Venta en ${estadoName}`
  const description = isEn
    ? `Find houses, apartments, land and commercial spaces for sale in ${estadoName}, Venezuela.`
    : `Encuentra propiedades en venta en ${estadoName}: casas, apartamentos, terrenos y locales comerciales.`

  return {
    title,
    description,
    alternates: buildPageAlternates(locale, `/propiedades/venta/${slug}`),
    robots: { index: shouldIndex, follow: true },
  }
}

export default async function VentasPorEstadoPage({ params }: PageProps) {
  const { locale, estado } = await params
  const isEn = locale === 'en'
  const { state: stateData, ciudades, properties, hasError } = await loadStateSaleData(estado)

  if (!stateData && !hasError) {
    notFound()
  }

  const stateName = stateData?.name || estado
  const stateSlug = stateData?.slug || stateData?.id || estado

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: isEn ? 'For Sale' : 'Venta', href: '/propiedades/venta' },
          { label: stateName },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-6">
        {isEn ? `Properties for sale in ${stateName}` : `Propiedades en venta en ${stateName}`}
      </h1>

      {ciudades && ciudades.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {isEn ? 'Browse by City' : 'Buscar por Ciudad'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ciudades.map((ciudad: any) => (
              <LocalLink
                key={ciudad.id}
                href={`/propiedades/venta/${stateSlug}/${ciudad.slug || ciudad.id}`}
                className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-center transition-colors"
              >
                {ciudad.name}
              </LocalLink>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">
          {isEn ? 'Available Properties' : 'Propiedades Disponibles'}
        </h2>
        {hasError ? (
          <p role="alert" className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
            {isEn
              ? 'We could not load properties for this state right now. Please try again in a moment.'
              : 'No pudimos cargar las propiedades de este estado en este momento. Intenta nuevamente en unos instantes.'}
          </p>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((propiedad) => (
              <PropertyCard key={propiedad.id} property={propiedad} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">
            {isEn ? 'No properties available in this area.' : 'No hay propiedades disponibles en esta zona.'}
          </p>
        )}
      </div>
    </div>
  )
}
