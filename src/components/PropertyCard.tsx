import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Bath, BedDouble, Camera, Compass, MapPin, Ruler, Video } from 'lucide-react'
import { isOptimizableImageSrc } from '@/lib/image-src'
import FavoriteCardButton from '@/components/FavoriteCardButton'
import { calculatePricePerM2 } from '@/lib/urbanizaciones'

export interface PropertyCardData {
  id: string
  slug?: string | null
  title: string
  price: number
  currency?: string | null
  operation_type: string
  city?: string | null
  state?: string | null
  zone?: string | null
  main_image_url: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  area_size?: number | null
  built_area?: number | null
  property_type?: string | null
  featured?: boolean
  verified?: boolean
  owner_id?: string | null
  photos_count?: number | null
  has_video?: boolean
  has_tour?: boolean
}

interface PropertyCardProps {
  property: PropertyCardData
  locale: string
  priority?: boolean
  labels?: {
    sale?: string
    rent?: string
    featured?: string
    priceOnRequest?: string
    bedroom?: string
    bathroom?: string
  }
}

const FALLBACK_IMAGE = '/sinimagen.webp'

function formatPropertyType(value: string | null | undefined, locale: string) {
  if (!value) return ''
  const key = value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const english: Record<string, string> = {
    casa: 'House', casas: 'Houses', apartamento: 'Apartment', apartamentos: 'Apartments',
    terreno: 'Land', terrenos: 'Land', local: 'Commercial space', locales: 'Commercial spaces', 'local comercial': 'Commercial space',
    oficina: 'Office', oficinas: 'Offices', galpon: 'Warehouse', galpones: 'Warehouses',
    quinta: 'Country house', townhouse: 'Townhouse', finca: 'Farm', edificio: 'Building', habitacion: 'Room', anexo: 'Annex',
  }
  const spanish: Record<string, string> = {
    casa: 'Casa', casas: 'Casas', apartamento: 'Apartamento', apartamentos: 'Apartamentos',
    terreno: 'Terreno', terrenos: 'Terrenos', local: 'Local comercial', locales: 'Locales comerciales', 'local comercial': 'Local comercial',
    oficina: 'Oficina', oficinas: 'Oficinas', galpon: 'Galpón', galpones: 'Galpones',
    quinta: 'Quinta', townhouse: 'Townhouse', finca: 'Finca', edificio: 'Edificio', habitacion: 'Habitación', anexo: 'Anexo',
  }
  return (locale === 'en' ? english[key] : spanish[key]) || value
}

export default function PropertyCard({ property, locale, priority = false, labels = {} }: PropertyCardProps) {
  const normalizedLocale = locale === 'en' ? 'en-US' : 'es-VE'
  const currency = property.currency || 'USD'
  const isRent = property.operation_type.toLowerCase().includes('alquiler') || property.operation_type.toLowerCase().includes('rent')
  const formattedPrice = property.price > 0
    ? new Intl.NumberFormat(normalizedLocale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(property.price)
    : labels.priceOnRequest || (locale === 'en' ? 'Price on request' : 'Consultar precio')

  const locationParts = property.zone
    ? [property.zone, property.city || property.state].filter(Boolean)
    : [property.city, property.state].filter(Boolean)
  const location = locationParts.join(', ')

  const operationLabel = isRent
    ? labels.rent || (locale === 'en' ? 'For rent' : 'Alquiler')
    : labels.sale || (locale === 'en' ? 'For sale' : 'En venta')

  const prefix = locale === 'en' ? '/en' : ''
  const href = `${prefix}/inmueble/${property.slug || property.id}`
  const imageUrl = property.main_image_url || FALLBACK_IMAGE
  const displayArea = property.built_area && property.built_area > 0 ? property.built_area : property.area_size
  const pricePerM2 = !isRent
    ? calculatePricePerM2(property.price, property.built_area, property.area_size)
    : null

  return (
    <article className="property-card">
      <FavoriteCardButton
        propertyId={property.id}
        propertySlug={property.slug}
        ownerId={property.owner_id}
        locale={locale}
      />
      <Link href={href} className="property-card__link group" aria-label={`${property.title} · ${location || 'Venezuela'}`}>
        <div className="property-card__media">
          <Image
            src={imageUrl}
            alt={property.title}
            fill
            unoptimized={!isOptimizableImageSrc(imageUrl)}
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 31vw"
            className="property-card__image"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            quality={78}
          />
          <div className="property-card__badges">
            <span className="property-card__operation">{operationLabel}</span>
            {property.featured && (
              <span className="property-card__featured">{labels.featured || (locale === 'en' ? 'Featured' : 'Destacada')}</span>
            )}
          </div>
          {(Boolean(property.photos_count && property.photos_count > 1) || property.has_video || property.has_tour) && (
            <div className="property-card__media-pills">
              {property.photos_count && property.photos_count > 1 ? (
                <span className="property-card__media-pill">
                  <Camera size={11} aria-hidden="true" /> {property.photos_count}
                </span>
              ) : null}
              {property.has_video ? (
                <span className="property-card__media-pill">
                  <Video size={11} aria-hidden="true" /> Video
                </span>
              ) : null}
              {property.has_tour ? (
                <span className="property-card__media-pill">
                  <Compass size={11} aria-hidden="true" /> 360°
                </span>
              ) : null}
            </div>
          )}
          <span className="property-card__arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
        </div>

        <div className="property-card__body">
          <p className="property-card__location">
            <MapPin size={13} aria-hidden="true" />
            <span>{location || 'Venezuela'}</span>
            {property.property_type && <><span className="property-card__dot">·</span><span>{formatPropertyType(property.property_type, locale)}</span></>}
          </p>
          <h3 className="property-card__title">{property.title}</h3>
          <div className="property-card__price-row">
            <div className="property-card__price-group">
              <p className="property-card__price">
                {formattedPrice}
                {isRent && property.price > 0 && (
                  <span className="property-card__price-period">{locale === 'en' ? '/mo' : '/mes'}</span>
                )}
              </p>
              {pricePerM2 != null && (
                <span className="property-card__unit-price">
                  ${new Intl.NumberFormat(normalizedLocale, { maximumFractionDigits: 0 }).format(pricePerM2)}/m²
                </span>
              )}
            </div>
            {property.verified && <span className="property-card__verified">{locale === 'en' ? 'Verified' : 'Verificado'}</span>}
          </div>
          <div className="property-card__specs" aria-label={locale === 'en' ? 'Property details' : 'Detalles del inmueble'}>
            {property.bedrooms != null && property.bedrooms > 0 && (
              <span><BedDouble size={15} aria-hidden="true" /> {property.bedrooms} <span className="sr-only">{labels.bedroom || (locale === 'en' ? 'bedrooms' : 'habitaciones')}</span></span>
            )}
            {property.bathrooms != null && property.bathrooms > 0 && (
              <span><Bath size={15} aria-hidden="true" /> {property.bathrooms} <span className="sr-only">{labels.bathroom || (locale === 'en' ? 'bathrooms' : 'baños')}</span></span>
            )}
            {displayArea != null && displayArea > 0 && (
              <span><Ruler size={15} aria-hidden="true" /> {new Intl.NumberFormat(normalizedLocale, { maximumFractionDigits: 0 }).format(displayArea)} m²</span>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
