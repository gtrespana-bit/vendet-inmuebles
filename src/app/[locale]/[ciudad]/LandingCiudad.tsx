import { supabase } from '@/lib/supabase'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { MapPin, ChevronRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

interface Props {
  slug: string
  nombre: string
  estado: string
  descripcion: string
}

async function getProperties(city: string) {
  try {
    const { data, count } = await supabase
      .from('vw_propiedades_publicas')
      .select('id, titulo, precio, estado, main_image_url, ciudad, destacado, destacado_hasta', { count: 'exact' })
      .eq('activo', true)
      .eq('ciudad', city)
      .order('creado_en', { ascending: false })
      .limit(24)

    return { properties: data || [], total: count || 0 }
  } catch (error) {
    console.error('Error fetching properties for city:', error)
    return { properties: [], total: 0 }
  }
}

export default async function LandingCiudad({ nombre, estado }: Props) {
  const [t, { properties, total }] = await Promise.all([
    getTranslations('cityLanding'),
    getProperties(nombre),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6" aria-label={t('breadcrumb')}>
        <LocalLink href="/" className="hover:text-brand-primary">{t('breadcrumb')}</LocalLink>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="text-gray-800 font-medium">{nombre}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
        {t('title', { city: nombre, state: estado })}
      </h1>
      <p className="text-gray-500 mb-8">
        {t('desc', { city: nombre, state: estado })}
      </p>

      {properties.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {properties.map((property: any) => (
            <LocalLink key={property.id} href={`/inmueble/${property.id}`} className="bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg transition group block">
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {property.destacado && new Date(property.destacado_hasta) > new Date() && (
                  <div className="absolute top-2 left-2 z-10 bg-brand-accent text-[var(--on-gold)] text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ {t('featured')}</div>
                )}
                {property.main_image_url ? (
                  <Image src={property.main_image_url} alt={property.titulo} width={300} height={300} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl" aria-hidden="true" />
                )}
              </div>
              <div className="p-3">
                <h2 className="font-semibold text-gray-900 text-sm truncate">{property.titulo}</h2>
                <p className="text-lg font-black text-brand-primary mt-1">${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(property.precio || 0))}</p>
                <p className="text-xs text-gray-500">{property.estado}</p>
                {property.ciudad && (
                  <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} aria-hidden="true" />{property.ciudad}</p>
                )}
              </div>
            </LocalLink>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">{t('noAds', { city: nombre })}</p>
          <p className="mb-4">{t('beFirst')}</p>
          <LocalLink href="/publicar-inmueble" className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold">{t('postFree')}</LocalLink>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <LocalLink href={`/catalogo?ciudad=${encodeURIComponent(nombre)}`} className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition">
          {t('seeMore', { city: nombre, count: total })}
        </LocalLink>
      </div>
    </div>
  )
}
