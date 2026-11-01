import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import { createServerClient } from '@/lib/supabase-server'
import { fetchListingsByLocation, resolveStateByParam } from '@/lib/location-listings'
import PropertyCard from '@/components/PropertyCard'
import Breadcrumbs from '@/components/Breadcrumbs'

interface PageProps {
  params: Promise<{ locale: string; estado: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, estado } = await params
  const isEn = locale === 'en'
  const supabase = createServerClient()
  const { state } = await resolveStateByParam(supabase, estado)
  const estadoName = state?.name || estado
  const slug = state?.slug || state?.id || estado

  const title = isEn
    ? `Properties for rent in ${estadoName}`
    : `Propiedades en alquiler en ${estadoName}`
  const description = isEn
    ? `Find houses, apartments, commercial spaces and offices for rent in ${estadoName}, Venezuela.`
    : `Encuentra propiedades en alquiler en ${estadoName}. Casas, apartamentos, locales y más.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://venezuela-inmuebles.online${isEn ? '/en' : ''}/propiedades/alquiler/${slug}`,
      languages: {
        'es-VE': `https://venezuela-inmuebles.online/propiedades/alquiler/${slug}`,
        'en-US': `https://venezuela-inmuebles.online/en/propiedades/alquiler/${slug}`,
      },
    },
  }
}

export default async function AlquilerPorEstadoPage({ params }: PageProps) {
  const { locale, estado } = await params
  const isEn = locale === 'en'
  const supabase = createServerClient()

  const { state: stateData, serviceError: stateError } = await resolveStateByParam(supabase, estado)
  if (!stateData && !stateError) {
    notFound()
  }

  const stateName = stateData?.name || estado
  const stateSlug = stateData?.slug || stateData?.id || estado

  const [{ data: ciudades }, { properties, serviceError: listingsError }] = stateData
    ? await Promise.all([
        supabase.from('cities').select('id, name, slug').eq('state_id', stateData.id).order('name'),
        fetchListingsByLocation(supabase, { operacion: 'alquiler', state: stateData, limit: 50 }),
      ])
    : [{ data: null }, { properties: [], serviceError: true }]

  const hasError = stateError || listingsError

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs
        items={[
          { label: isEn ? 'For Rent' : 'Alquiler', href: '/propiedades/alquiler' },
          { label: stateName },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-6">
        {isEn ? `Properties for rent in ${stateName}` : `Propiedades en alquiler en ${stateName}`}
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
                href={`/propiedades/alquiler/${stateSlug}/${ciudad.slug || ciudad.id}`}
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
