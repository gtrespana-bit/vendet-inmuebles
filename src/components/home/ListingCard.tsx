import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { Bath, BedDouble, MapPin, Ruler } from 'lucide-react'
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
  image: string | null
  bedrooms: number | null
  bathrooms: number | null
  area: number | null
  featured: boolean
  verified: boolean
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

function operationLabel(listing: HomeListing, labels: ListingCardLabels) {
  const raw = (listing.operation || '').toLowerCase()
  return raw.startsWith('alq') || raw.startsWith('rent') ? labels.rent : labels.sale
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
  const location = [listing.city, listing.state].filter(Boolean).join(', ')

  return (
    <article className={styles.card}>
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
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardLocation}>
          <MapPin size={13} aria-hidden="true" />
          {location || 'Venezuela'}
        </p>

        <h3 className={styles.cardTitle}>{listing.title}</h3>

        <p className={styles.cardPrice}>
          {formatPrice(listing, locale, labels)}
          {listing.verified ? <small>{labels.verified}</small> : null}
        </p>

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
          {listing.area ? (
            <span>
              <Ruler size={14} aria-hidden="true" />
              {listing.area.toLocaleString(locale === 'en' ? 'en-US' : 'es-VE')} m²
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
