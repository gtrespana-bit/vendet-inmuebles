import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import PropertyCard from '@/components/PropertyCard'
import Breadcrumbs from '@/components/Breadcrumbs'
import { getTranslations } from 'next-intl/server'

interface PageProps {
  params: Promise<{ locale: string; estado: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, estado } = await params
  
  const supabase = createServerClient()
  const { data: stateData } = await supabase
    .from('states')
    .select('name')
    .eq('id', estado)
    .single()
  
  const estadoName = stateData?.name || estado
  
  return {
    title: `Propiedades en venta en ${estadoName} - VendeT Inmuebles`,
    description: `Encuentra propiedades en venta en ${estadoName}. Casas, apartamentos, terrenos y más.`
  }
}

export default async function VentasPorEstadoPage({ params, searchParams }: PageProps) {
  const { locale, estado } = await params
  const filters = await searchParams
  
  const t = await getTranslations({ locale, namespace: 'properties' })
  
  const supabase = createServerClient()
  
  // Obtener información del estado
  const { data: stateData } = await supabase
    .from('states')
    .select('id, name')
    .eq('id', estado)
    .single()
  
  if (!stateData) {
    notFound()
  }
  
  // Obtener ciudades de este estado
  const { data: ciudades } = await supabase
    .from('cities')
    .select('id, name')
    .eq('state_id', estado)
    .order('name')
  
  // Obtener propiedades de venta en este estado
  const { data: propiedades } = await supabase
    .from('properties')
    .select(`
      *,
      property_images (url),
      states (name),
      cities (name)
    `)
    .eq('operation_type', 'venta')
    .eq('state_id', estado)
    .eq('status', 'active')
    .limit(50)
    .order('created_at', { ascending: false })
  
  const breadcrumbItems = [
    { label: t('breadcrumbs.home'), href: `/${locale}` },
    { label: t('breadcrumbs.for_sale'), href: `/${locale}/propiedades/venta` },
    { label: stateData.name }
  ]
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbItems} />
      
      <h1 className="text-3xl font-bold mb-6">
        Propiedades en venta en {stateData.name}
      </h1>
      
      {/* Filtro por ciudades */}
      {ciudades && ciudades.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Buscar por Ciudad</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ciudades.map((ciudad: any) => (
              <Link
                key={ciudad.id}
                href={`/${locale}/propiedades/venta/${estado}/${ciudad.id}`}
                className="p-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-center transition-colors"
              >
                {ciudad.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      
      {/* Listado de propiedades */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Propiedades Disponibles</h2>
        {propiedades && propiedades.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {propiedades.map((propiedad: any) => (
              <PropertyCard key={propiedad.id} {...propiedad} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No hay propiedades disponibles en esta zona.</p>
        )}
      </div>
    </div>
  )
}
