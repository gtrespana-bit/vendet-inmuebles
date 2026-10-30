import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import type { LandingCopy } from './copy'
import styles from './landing.module.css'

export type LandingListing = {
  id: string
  slug: string | null
  title: string
  price: number
  currency: string
  operation: string | null
  type: string | null
  city: string | null
  state: string | null
  image: string | null
  bedrooms: number | null
  bathrooms: number | null
  area: number | null
  featured: boolean
  verified: boolean
}

function formatPrice(listing: LandingListing, locale: string): string {
  if (!listing.price) return ''
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

function operationLabel(listing: LandingListing, copy: LandingCopy): string {
  const raw = (listing.operation || '').toLowerCase()
  if (raw.startsWith('alq') || raw.startsWith('rent')) return copy.featured.rent
  return copy.featured.sale
}

export default function PropertyTile({
  listing,
  copy,
  locale,
  specimen = false,
}: {
  listing: LandingListing
  copy: LandingCopy
  locale: string
  specimen?: boolean
}) {
  const specs = [
    listing.bedrooms ? `${listing.bedrooms} ${copy.featured.bedrooms}` : null,
    listing.bathrooms ? `${listing.bathrooms} ${copy.featured.bathrooms}` : null,
    listing.area ? `${listing.area.toLocaleString(locale === 'en' ? 'en-US' : 'es-VE')} ${copy.featured.area}` : null,
  ].filter(Boolean)

  const location = [listing.city, listing.state].filter(Boolean).join(' / ')
  const href = `/inmueble/${listing.slug || listing.id}`

  return (
    <article className={`${styles.tile} ${specimen ? styles.tileSpecimen : ''}`}>
      <LocalLink href={href} className={styles.tileLink}>
        <div className={styles.tileMedia}>
          {listing.image ? (
            <Image
              src={listing.image}
              alt={listing.title}
              fill
              sizes="(max-width: 900px) 100vw, 33vw"
              className={styles.tileImage}
            />
          ) : (
            <div className={styles.tileNoImage} aria-hidden="true">
              <span>Venezuela Inmuebles</span>
            </div>
          )}

          <span className={styles.tileOperation}>{operationLabel(listing, copy)}</span>
          {specimen ? <span className={styles.tileSpecimenTag}>{copy.featured.specimenTag}</span> : null}
          {!specimen && listing.featured ? <span className={styles.tileFeatured}>{copy.featured.featuredTag}</span> : null}
        </div>

        <div className={styles.tileBody}>
          <div className={styles.tileMeta}>
            <span>{location || 'Venezuela'}</span>
            {listing.verified ? <span className={styles.tileVerified}>{copy.featured.verified}</span> : null}
          </div>

          <h3 className={styles.tileTitle}>{listing.title}</h3>

          {specs.length > 0 && <p className={styles.tileSpecs}>{specs.join(' / ')}</p>}

          <div className={styles.tileFoot}>
            <span className={styles.tilePrice}>{formatPrice(listing, locale) || copy.featured.priceOnRequest}</span>
            <span className={styles.tileArrow} aria-hidden="true">
              ↗
            </span>
          </div>
        </div>
      </LocalLink>

      {specimen ? <p className={styles.tileSpecimenNote}>{copy.featured.specimenNote}</p> : null}
    </article>
  )
}
