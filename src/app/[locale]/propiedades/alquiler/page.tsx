import { Metadata } from 'next'
import LocalLink from '@/components/LocalLink'
import { createServerClient } from '@/lib/supabase-server'
import { fetchListingsByLocation } from '@/lib/location-listings'
import { buildPageAlternates } from '@/lib/seo-metadata'
import PropertyCard from '@/components/PropertyCard'
import Breadcrumbs from '@/components/Breadcrumbs'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const isEn = locale === 'en'
  const title = isEn ? 'Properties for Rent in Venezuela' : 'Propiedades en Alquiler en Venezuela'
  const description = isEn
    ? 'Find houses, apartments, commercial spaces and offices for rent across Venezuela with direct contact.'
    : 'Encuentra casas, apartamentos, locales y oficinas en alquiler en toda Venezuela con contacto directo.'

  return {
    title,
    description,
    alternates: buildPageAlternates(locale, '/propiedades/alquiler'),
  }
}

export default async function AlquilerPage({ params }: PageProps) {
  const { locale } = await params
  const isEn = locale === 'en'
  const supabase = createServerClient()

  const [{ data: estados }, { properties, serviceError }] = await Promise.all([
    supabase.from('states').select('id, name, slug').order('name'),
    fetchListingsByLocation(supabase, { operacion: 'alquiler', limit: 50 }),
  ])

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={[{ label: isEn ? 'For Rent' : 'Alquiler' }]} />

      <h1 className="text-3xl font-bold mt-4 mb-6">
        {isEn ? 'Properties for Rent in Venezuela' : 'Propiedades en Alquiler en Venezuela'}
      </h1>

      {estados && estados.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {isEn ? 'Browse by State' : 'Buscar por Estado'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {estados.map((estado: any) => (
              <LocalLink
                key={estado.id}
                href={`/propiedades/alquiler/${estado.slug || estado.id}`}
                className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-center transition-colors"
              >
                {estado.name}
              </LocalLink>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">
          {isEn ? 'Available Properties' : 'Propiedades Disponibles'}
        </h2>
        {serviceError ? (
          <p role="alert" className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
            {isEn
              ? 'We could not load properties right now. Please try again in a moment.'
              : 'No pudimos cargar las propiedades en este momento. Intenta nuevamente en unos instantes.'}
          </p>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((propiedad) => (
              <PropertyCard key={propiedad.id} property={propiedad} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">
            {isEn ? 'No properties available right now.' : 'No hay propiedades disponibles en este momento.'}
          </p>
        )}
      </div>
    </div>
  )
}
