import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import FavoriteCardButton from '@/components/FavoriteCardButton'
import { Bath, BedDouble, Compass, MapPin, Ruler, Video } from 'lucide-react'
import { calculatePricePerM2 } from '@/lib/urbanizaciones'
import styles from './home.module.css'

export type HomeListing = {
  id: string
  slug: string | null
  title: string
  price: number
  currency: string
  operation: string | null
  city: string | null
  state: string | null
  zone?: string | null
  image: string | null
  bedrooms: number | null
  bathrooms: number | null
  area: number | null
  builtArea?: number | null
  featured: boolean
  verified: boolean
  ownerId?: string | null
  hasVideo?: boolean
  hasTour?: boolean
  sample?: boolean
}

export type ListingCardLabels = {
  sale: string
  rent: string
  featured: string
  verified: string
  sample: string
  priceOnRequest: string
  bedrooms: string
  bathrooms: string
}

function isRentListing(listing: HomeListing): boolean {
  const raw = (listing.operation || '').toLowerCase()
  return raw.startsWith('alq') || raw.startsWith('rent')
}

function operationLabel(listing: HomeListing, labels: ListingCardLabels) {
  return isRentListing(listing) ? labels.rent : labels.sale
}

function formatPrice(listing: HomeListing, locale: string, labels: ListingCardLabels) {
  if (!listing.price) return labels.priceOnRequest
  const currency = (listing.currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-VE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(listing.price)
  } catch {
    return `$${Math.round(listing.price).toLocaleString('en-US')}`
  }
}

export default function ListingCard({
  listing,
  locale,
  labels,
  priority = false,
}: {
  listing: HomeListing
  locale: string
  labels: ListingCardLabels
  priority?: boolean
}) {
  const href = `/inmueble/${listing.slug || listing.id}`
  const locationParts = listing.zone
    ? [listing.zone, listing.city || listing.state].filter(Boolean)
    : [listing.city, listing.state].filter(Boolean)
  const location = locationParts.join(', ')
  const isRent = isRentListing(listing)
  const displayArea = listing.builtArea && listing.builtArea > 0 ? listing.builtArea : listing.area
  const pricePerM2 = !isRent
    ? calculatePricePerM2(listing.price, listing.builtArea, listing.area)
    : null
  const normalizedLocale = locale === 'en' ? 'en-US' : 'es-VE'

  return (
    <article className={styles.card}>
      {!listing.sample ? (
        <FavoriteCardButton
          propertyId={listing.id}
          propertySlug={listing.slug}
          ownerId={listing.ownerId}
          locale={locale}
          className={styles.cardFav}
        />
      ) : null}
      <div className={styles.cardMedia}>
        <Image
          src={listing.image || '/sinimagen.webp'}
          alt={listing.title}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw"
        />
        <div className={styles.cardBadges}>
          <span className={styles.badge}>{operationLabel(listing, labels)}</span>
          {listing.sample ? (
            <span className={`${styles.badge} ${styles.badgeGhost}`}>{labels.sample}</span>
          ) : listing.featured ? (
            <span className={`${styles.badge} ${styles.badgeGold}`}>{labels.featured}</span>
          ) : null}
        </div>
        {(listing.hasVideo || listing.hasTour) && (
          <div className={styles.cardMediaPills}>
            {listing.hasVideo ? (
              <span className={styles.cardMediaPill}>
                <Video size={11} aria-hidden="true" /> Video
              </span>
            ) : null}
            {listing.hasTour ? (
              <span className={styles.cardMediaPill}>
                <Compass size={11} aria-hidden="true" /> 360°
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardLocation}>
          <MapPin size={13} aria-hidden="true" />
          {location || 'Venezuela'}
        </p>

        <h3 className={styles.cardTitle}>{listing.title}</h3>

        <div className={styles.cardPriceRow}>
          <p className={styles.cardPrice}>
            {formatPrice(listing, locale, labels)}
            {isRent && listing.price > 0 ? (
              <small>{locale === 'en' ? '/mo' : '/mes'}</small>
            ) : null}
            {listing.verified ? <small>{labels.verified}</small> : null}
          </p>
          {pricePerM2 != null ? (
            <span className={styles.cardUnitPrice}>
              ${pricePerM2.toLocaleString(normalizedLocale)}/m²
            </span>
          ) : null}
        </div>

        <div className={styles.cardSpecs}>
          {listing.bedrooms ? (
            <span>
              <BedDouble size={14} aria-hidden="true" />
              {listing.bedrooms} {labels.bedrooms}
            </span>
          ) : null}
          {listing.bathrooms ? (
            <span>
              <Bath size={14} aria-hidden="true" />
              {listing.bathrooms} {labels.bathrooms}
            </span>
          ) : null}
          {displayArea ? (
            <span>
              <Ruler size={14} aria-hidden="true" />
              {displayArea.toLocaleString(normalizedLocale)} m²
            </span>
          ) : null}
        </div>
      </div>

      {!listing.sample ? (
        <LocalLink href={href} className={styles.cardStretched} aria-label={listing.title}>
          <span className="sr-only">{listing.title}</span>
        </LocalLink>
      ) : null}
    </article>
  )
}
