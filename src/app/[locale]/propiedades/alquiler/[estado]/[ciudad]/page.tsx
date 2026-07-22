import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/components/Breadcrumbs'
import PropertyCard from '@/components/PropertyCard'
import { getTranslations } from 'next-intl/server'

interface PageProps {
  params: Promise<{ locale: string; estado: string; ciudad: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, estado, ciudad } = await params
  
  return {
    title: `Propiedades en ${ciudad}, ${estado} - VendeT Inmuebles`,
    description: `Encuentra propiedades en alquiler en ${ciudad}, ${estado}. Casas, apartamentos, terrenos y más.`
  }
}

export default async function VentasPorCiudadPage({ params, searchParams }: PageProps) {
  const { locale, estado, ciudad } = await params
  const filters = await searchParams
  
  const t = await getTranslations({ locale, namespace: 'properties' })
  
  const supabase = createServerClient()
  
  const { data: propiedades, error } = await supabase
    .from('productos')
    .select(`
      *,
      property_images (url),
      states (name),
      cities (name)
    `)
    .eq('operacion_tipo', 'Alquiler')
    .eq('ubicacion_estado_id', estado)
    .eq('ubicacion_ciudad_id', ciudad)
    .eq('activo', true)
    .limit(50)
  
  if (error || !propiedades) {
    notFound()
  }
  
  const breadcrumbItems = [
    { label: t('breadcrumbs.home'), href: `/${locale}` },
    { label: t('breadcrumbs.for_rent'), href: `/${locale}/propiedades/venta` },
    { label: estado },
    { label: ciudad }
  ]
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbItems} />
      
      <h1 className="text-3xl font-bold mb-6">
        Propiedades en alquiler en {ciudad}, {estado}
      </h1>
      
      {propiedades.length === 0 ? (
        <p className="text-gray-500">No hay propiedades disponibles en esta zona.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {propiedades.map((propiedad: any) => (
            <PropertyCard key={propiedad.id} {...propiedad} />
          ))}
        </div>
      )}
    </div>
  )
}
