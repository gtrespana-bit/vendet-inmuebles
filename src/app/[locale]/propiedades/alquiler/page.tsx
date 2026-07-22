import { Metadata } from 'next'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import PropertyCard from '@/components/PropertyCard'
import { getTranslations } from 'next-intl/server'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'properties' })
  
  return {
    title: `Propiedades en Alquiler - VendeT Inmuebles`,
    description: `Encuentra propiedades en alquiler. Casas, apartamentos, locales y más.`
  }
}

export default async function AlquilerPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const filters = await searchParams
  
  const t = await getTranslations({ locale, namespace: 'properties' })
  
  const supabase = createServerClient()
  
  // Obtener estados disponibles
  const { data: estados } = await supabase
    .from('states')
    .select('id, name')
    .order('name')
  
  // Obtener propiedades recientes de alquiler
  const { data: propiedades } = await supabase
    .from('properties')
    .select(`
      *,
      property_images (url),
      states (name),
      cities (name)
    `)
    .eq('operation_type', 'alquiler')
    .eq('status', 'active')
    .limit(50)
    .order('created_at', { ascending: false })
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        Propiedades en Alquiler
      </h1>
      
      {/* Filtro por estados */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Buscar por Estado</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {estados?.map((estado: any) => (
            <Link
              key={estado.id}
              href={`/${locale}/propiedades/alquiler/${estado.id}`}
              className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-center transition-colors"
            >
              {estado.name}
            </Link>
          ))}
        </div>
      </div>
      
      {/* Propiedades destacadas */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Propiedades Destacadas</h2>
        {propiedades && propiedades.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {propiedades.map((propiedad: any) => (
              <PropertyCard key={propiedad.id} {...propiedad} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No hay propiedades disponibles en este momento.</p>
        )}
      </div>
    </div>
  )
}
