'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Bath, BedDouble, MapPin, Ruler } from 'lucide-react'
import LocalLink from './LocalLink'
import type { CatalogPropertyRecord } from '@/types/property'

interface ProductCardLazyProps {
  p: CatalogPropertyRecord
  t: (key: string) => string
  priority?: boolean
}

const PLACEHOLDER_IMAGE = '/sinimagen.webp'

function localizedType(value: string | null | undefined, locale: string) {
  if (!value) return ''
  const key = value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const types: Record<string, { es: string; en: string }> = {
    casa: { es: 'Casa', en: 'House' },
    apartamento: { es: 'Apartamento', en: 'Apartment' },
    terreno: { es: 'Terreno', en: 'Land' },
    local: { es: 'Local comercial', en: 'Commercial space' },
    'local comercial': { es: 'Local comercial', en: 'Commercial space' },
    oficina: { es: 'Oficina', en: 'Office' },
    galpon: { es: 'Galpón', en: 'Warehouse' },
    townhouse: { es: 'Townhouse', en: 'Townhouse' },
    finca: { es: 'Finca', en: 'Farm' },
    habitacion: { es: 'Habitación', en: 'Room' },
    quinta: { es: 'Quinta', en: 'Country house' },
    edificio: { es: 'Edificio', en: 'Building' },
  }
  return types[key]?.[locale === 'en' ? 'en' : 'es'] || value
}

export const ProductCardLazy = ({ p, t, priority = false }: ProductCardLazyProps) => {
  const pathname = usePathname()
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es'
  const title = p.titulo || p.title || (locale === 'en' ? 'Property' : 'Inmueble')
  const price = Number(p.precio_usd ?? p.precio ?? p.price ?? 0)
  const currency = p.moneda || p.currency || 'USD'
  const city = p.ciudad || p.city || ''
  const state = p.estado || p.state || ''
  const location = [city, state].filter(Boolean).join(', ') || 'Venezuela'
  const operation = `${p.operacion_slug || p.operation_type || p.operacion_nombre || ''}`.toLowerCase()
  const operationLabel = operation.includes('alquiler') || operation.includes('rent')
    ? t('product.forRent')
    : t('product.forSale')
  const propertyType = localizedType(p.tipo_nombre || p.property_type || p.tipo_slug || p.subcategoria, locale)
  const isFeatured = p._isFeatured ?? Boolean(p.destacado && p.destacado_hasta)
  const isBoosted = Boolean(p.boosteado_en)
  const imageUrl = p.main_image_url || p.imagen_portada || PLACEHOLDER_IMAGE
  const bedrooms = p.habitaciones ?? p.bedrooms
  const bathrooms = p.banos ?? p.bathrooms
  const area = p.area_total ?? p.area_size
  const formattedPrice = price > 0
    ? new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-VE', {
        style: 'currency', currency, maximumFractionDigits: 0,
      }).format(price)
    : t('product.priceOnRequest')

  return (
    <article className="property-card">
      <LocalLink href={`/inmueble/${p.slug || p.id}`} className="property-card__link group" aria-label={`${title} · ${location}`}>
        <div className="property-card__media">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 31vw"
            className="property-card__image"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            quality={78}
            onError={(event) => {
              const target = event.currentTarget
              if (!target.src.includes(PLACEHOLDER_IMAGE)) target.src = PLACEHOLDER_IMAGE
            }}
          />
          <div className="property-card__badges">
            <span className="property-card__operation">{operationLabel}</span>
            {isFeatured && <span className="property-card__featured">{t('product.featured')}</span>}
            {isBoosted && !isFeatured && <span className="property-card__featured">{t('product.boost')}</span>}
          </div>
          <span className="property-card__arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
        </div>

        <div className="property-card__body">
          <p className="property-card__location">
            <MapPin size={13} aria-hidden="true" />
            <span>{location}</span>
            {propertyType && <><span className="property-card__dot">·</span><span>{propertyType}</span></>}
          </p>
          <h3 className="property-card__title">{title}</h3>
          <div className="property-card__price-row">
            <p className="property-card__price">{formattedPrice}</p>
            {(p.vendedor_verificado || p.propietario_verificado) && <span className="property-card__verified">{t('product.verified')}</span>}
          </div>
          <div className="property-card__specs" aria-label={locale === 'en' ? 'Property details' : 'Características del inmueble'}>
            {bedrooms != null && bedrooms > 0 && <span><BedDouble size={15} aria-hidden="true" />{bedrooms}</span>}
            {bathrooms != null && bathrooms > 0 && <span><Bath size={15} aria-hidden="true" />{bathrooms}</span>}
            {area != null && area > 0 && <span><Ruler size={15} aria-hidden="true" />{area} m²</span>}
          </div>
        </div>
      </LocalLink>
    </article>
  )
}
