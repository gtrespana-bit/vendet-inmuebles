import { Metadata } from 'next'
import Link from 'next/link'
import { getProperties } from '@/lib/properties'
import PropertyCard from '@/components/PropertyCard'
import { getTranslations } from 'next-intl/server'
import { supabase } from '@/lib/supabase'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'properties' })
  
  return {
    title: `Propiedades en Venta - VendeT Inmuebles`,
    description: `Encuentra propiedades en venta. Casas, apartamentos, terrenos y más.`
  }
}

export default async function VentasPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const filters = await searchParams
  
  const t = await getTranslations({ locale, namespace: 'properties' })
  
  // Obtener estados disponibles
  const { data: estados } = await supabase
    .from('states')
    .select('id, name')
    .order('name')
  
  // Obtener propiedades recientes de venta usando el nuevo sistema
  const { data: propiedadesData } = await getProperties({
    operation_type: 'venta',
    limit: 50,
    sort_by: 'newest'
  })
  
  // Transformar datos para PropertyCard
  const propiedades = (propiedadesData ?? []).map(p => ({
    id: p.id,
    titulo: p.titulo || p.title || 'Sin título',
    slug: p.slug || '',
    precio: p.price ?? p.precio_usd ?? 0,
    tipo_operacion: (p.operation_type ?? p.operacion_tipo ?? 'venta') as ('venta' | 'alquiler'),
    ciudad: p.city ?? p.ubicacion_ciudad ?? 'Ciudad no especificada',
    estado: p.state ?? p.ubicacion_estado ?? 'Estado no especificado',
    imagen_destacada_url: p.main_image_url ?? p.imagen_url ?? p.imagenes_urls?.[0] ?? null,
    habitaciones: p.bedrooms ?? (p.caracteristicas as any)?.habitaciones ?? 0,
    banos: p.bathrooms ?? (p.caracteristicas as any)?.banos ?? 0,
    area: p.area_size ?? p.area_total ?? (p.caracteristicas as any)?.area_m2 ?? 0
  }))
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        Propiedades en Venta
      </h1>
      
      {/* Filtro por estados */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Buscar por Estado</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {estados?.map((estado: any) => (
            <Link
              key={estado.id}
              href={`/${locale}/propiedades/venta/${estado.id}`}
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
            {propiedades.map((propiedad) => (
              <PropertyCard 
                key={propiedad.id} 
                property={propiedad} 
                locale={locale} 
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No hay propiedades disponibles en este momento.</p>
        )}
      </div>
    </div>
  )
}
