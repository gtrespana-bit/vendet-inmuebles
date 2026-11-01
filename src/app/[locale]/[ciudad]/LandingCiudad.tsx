import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { MapPin, ChevronRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { isOptimizableImageSrc } from '@/components/PropertyGallery'

interface Props {
  slug: string
  nombre: string
  estado: string
  descripcion: string
  initialProperties: any[]
  initialTotal: number
}

export default async function LandingCiudad({
  nombre,
  estado,
  initialProperties,
  initialTotal,
}: Props) {
  const t = await getTranslations('cityLanding')
  const properties = initialProperties
  const total = initialTotal

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
          {properties.map((property: any) => {
            const target = property.slug || property.id
            const imageSrc = property.main_image_url
            return (
              <LocalLink
                key={property.id}
                href={`/inmueble/${target}`}
                className="bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg transition group block"
              >
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {property.destacado && property.destacado_hasta && new Date(property.destacado_hasta) > new Date() && (
                    <div className="absolute top-2 left-2 z-10 bg-brand-accent text-[var(--on-gold)] text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ⭐ {t('featured')}
                    </div>
                  )}
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={property.titulo || nombre}
                      width={320}
                      height={320}
                      unoptimized={!isOptimizableImageSrc(imageSrc)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl" aria-hidden="true" />
                  )}
                </div>
                <div className="p-3">
                  <h2 className="font-semibold text-gray-900 text-sm truncate">{property.titulo}</h2>
                  <p className="text-lg font-black text-brand-primary mt-1">
                    ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(property.precio || 0))}
                  </p>
                  <p className="text-xs text-gray-500">{property.estado}</p>
                  {property.ciudad && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin size={10} aria-hidden="true" />{property.ciudad}
                    </p>
                  )}
                </div>
              </LocalLink>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">{t('noAds', { city: nombre })}</p>
          <p className="mb-4">{t('beFirst')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <LocalLink href="/publicar-inmueble" className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold">
              {t('postFree')}
            </LocalLink>
            <LocalLink href="/catalogo" className="inline-block bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition">
              Ver catálogo nacional
            </LocalLink>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="mt-8 flex justify-center">
          <LocalLink
            href={`/catalogo?ciudad=${encodeURIComponent(nombre)}`}
            className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
          >
            {t('seeMore', { city: nombre, count: total })}
          </LocalLink>
        </div>
      )}
    </div>
  )
}
