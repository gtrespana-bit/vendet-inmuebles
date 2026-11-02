import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { MapPin, ChevronRight } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { isOptimizableImageSrc } from '@/lib/image-src'
import { calculatePricePerM2 } from '@/lib/urbanizaciones'
import FavoriteCardButton from '@/components/FavoriteCardButton'
import CompareCardButton from '@/components/CompareCardButton'
import SaveSearchButton from '@/components/SaveSearchButton'

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
  const [t, locale] = await Promise.all([getTranslations('cityLanding'), getLocale()])
  const isEn = locale === 'en'
  const properties = initialProperties
  const total = initialTotal

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6" aria-label={t('breadcrumb')}>
        <LocalLink href="/" className="hover:text-brand-primary">{t('breadcrumb')}</LocalLink>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="text-gray-800 font-medium">{nombre}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
            {t('title', { city: nombre, state: estado })}
          </h1>
          <p className="text-gray-500 m-0">
            {t('desc', { city: nombre, state: estado })}
          </p>
        </div>

        <SaveSearchButton
          presetFilters={{ ciudad: nombre, estado }}
          label={isEn ? `Alert me in ${nombre}` : `Crear alerta en ${nombre}`}
        />
      </div>

      {properties.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {properties.map((property: any) => {
            const target = property.slug || property.id
            const imageSrc = property.main_image_url
            const priceNum = Number(property.precio_usd ?? property.precio ?? 0)
            const opStr = String(property.operacion_slug || property.operacion_nombre || '').toLowerCase()
            const isRent = opStr.includes('alquiler') || opStr.includes('rent')
            const ppm2 = !isRent
              ? calculatePricePerM2(priceNum, property.area_construida, property.area_total)
              : null
            const locText = [property.zona, property.ciudad || nombre, property.estado || estado]
              .filter(Boolean)
              .join(', ')

            return (
              <article
                key={property.id}
                className="relative bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg transition group"
              >
                <FavoriteCardButton
                  propertyId={String(property.id)}
                  propertySlug={property.slug}
                  ownerId={property.usuario_id || null}
                  locale={locale}
                />
                <CompareCardButton
                  propertyId={String(property.id)}
                  propertySlug={property.slug}
                  title={String(property.titulo || nombre)}
                  price={priceNum}
                  image={imageSrc || null}
                  location={locText}
                  operation={isRent ? 'alquiler' : 'venta'}
                  locale={locale}
                />
                <LocalLink
                  href={`/inmueble/${target}`}
                  className="block no-underline"
                >
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {property.destacado &&
                      property.destacado_hasta &&
                      new Date(property.destacado_hasta) > new Date() && (
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
                      <div
                        className="w-full h-full flex items-center justify-center text-gray-300 text-4xl"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="font-semibold text-gray-900 text-sm truncate">
                      {property.titulo}
                    </h2>
                    <div className="flex items-baseline justify-between gap-2 mt-1">
                      <p className="text-lg font-black text-brand-primary m-0">
                        $
                        {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
                          priceNum,
                        )}
                        {isRent ? (
                          <span className="text-xs font-medium text-gray-500">
                            {isEn ? '/mo' : '/mes'}
                          </span>
                        ) : null}
                      </p>
                      {ppm2 && (
                        <span className="text-[11px] font-semibold text-gray-500">
                          ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(ppm2)}/m²
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 mb-0">{property.estado}</p>
                    {(property.zona || property.ciudad) && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 mb-0 truncate">
                        <MapPin size={10} aria-hidden="true" />
                        {[property.zona, property.ciudad].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </LocalLink>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl mb-2">{t('noAds', { city: nombre })}</p>
          <p className="mb-4">{t('beFirst')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <LocalLink
              href="/publicar-inmueble"
              className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold"
            >
              {t('postFree')}
            </LocalLink>
            <LocalLink
              href="/catalogo"
              className="inline-block bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
            >
              {isEn ? 'Browse national catalog' : 'Ver catálogo nacional'}
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
