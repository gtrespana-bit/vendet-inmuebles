import { supabase } from '@/lib/supabase'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { MapPin, ChevronRight } from 'lucide-react'
import { getCiudadBySlug } from '@/lib/ubicaciones-seo'

interface Props {
  slug: string
  nombre: string
  estado: string
  descripcion: string
}

async function getProductos(ciudad: string) {
  try {
    const { data, count } = await supabase
      .from('productos')
      .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, destacado, destacado_hasta', { count: 'exact' })
      .eq('activo', true)
      .eq('ubicacion_ciudad', ciudad)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .order('creado_en', { ascending: false })
      .limit(24)
    
    return { productos: data || [], total: count || 0 }
  } catch (error) {
    console.error('Error fetching productos:', error)
    return { productos: [], total: 0 }
  }
}

export default async function LandingCiudad({ slug, nombre, estado, descripcion }: Props) {
  const { productos, total } = await getProductos(nombre)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <LocalLink href="/" className="hover:text-brand-primary">Inicio</LocalLink>
        <ChevronRight size={14} />
        <span className="text-gray-800 font-medium">{nombre}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
        Clasificados en {nombre}, {estado} - Compra y Venta en Venezuela
      </h1>
      <p className="text-gray-500 mb-8">
        {descripcion} Encuentra miles de productos nuevos y usados en {nombre}. Publica gratis tu anuncio.
      </p>

      {productos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {productos.map((p: any) => (
            <LocalLink key={p.id} href={`/inmueble/${p.id}`} className="bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg transition group block">
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {p.destacado && new Date(p.destacado_hasta) > new Date() && (
                  <div className="absolute top-2 left-2 z-10 bg-brand-accent text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ Destacado</div>
                )}
                {p.imagen_url ? (
                  <Image src={p.imagen_url} alt={p.titulo} width={300} height={300} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl"></div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-gray-900 text-sm truncate">{p.titulo}</h3>
                <p className="text-lg font-black text-brand-primary mt-1">${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd || 0))}</p>
                <p className="text-xs text-gray-500">{p.estado}</p>
                {p.ubicacion_ciudad && (
                  <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{p.ubicacion_ciudad}</p>
                )}
              </div>
            </LocalLink>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">Aún no hay anuncios en {nombre}</p>
          <p className="mb-4">¡Sé el primero en publicar!</p>
          <LocalLink href="/publicar" className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold">Publicar Gratis</LocalLink>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <LocalLink href={`/catalogo?ciudad=${nombre}`} className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition">
          Ver todos los anuncios en {nombre} ({total})
        </LocalLink>
      </div>
    </div>
  )
}
