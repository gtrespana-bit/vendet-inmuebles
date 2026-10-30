import Image from 'next/image'
import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
import LandingNav from '@/components/landing/LandingNav'
import PortalSearch from '@/components/landing/PortalSearch'
import PropertyTile, { type LandingListing } from '@/components/landing/PropertyTile'
import { landingCopy } from '@/components/landing/copy'
import styles from '@/components/landing/landing.module.css'

// Self-hosted typefaces (no external request, no layout shift)
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/inter/200.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/roboto-mono/300.css'
import '@fontsource/roboto-mono/400.css'

const SITE_URL = 'https://venezuela-inmuebles.online'
const LISTING_COLUMNS =
  'id, slug, titulo, precio, moneda, operacion_slug, operacion_nombre, tipo_nombre, ciudad, estado, main_image_url, habitaciones, banos, area_total, destacado, destacado_hasta, vendedor_verificado, creado_en'

async function getLandingListings(): Promise<{ listings: LandingListing[]; total: number | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { listings: [], total: null }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [recentResult, countResult] = await Promise.all([
      supabase
        .from('vw_propiedades_publicas')
        .select(LISTING_COLUMNS)
        .eq('activo', true)
        .order('destacado', { ascending: false })
        .order('creado_en', { ascending: false })
        .limit(6),
      supabase.from('vw_propiedades_publicas').select('id', { count: 'exact', head: true }).eq('activo', true),
    ])

    const now = Date.now()
    const rows = (recentResult.data || []) as any[]
    const listings = rows.map(
      (row): LandingListing => ({
        id: String(row.id),
        slug: row.slug || null,
        title: row.titulo || 'Inmueble',
        price: Number(row.precio) || 0,
        currency: row.moneda || 'USD',
        operation: row.operacion_slug || row.operacion_nombre || null,
        type: row.tipo_nombre || null,
        city: row.ciudad || null,
        state: row.estado || null,
        image: row.main_image_url || null,
        bedrooms: row.habitaciones == null ? null : Number(row.habitaciones),
        bathrooms: row.banos == null ? null : Number(row.banos),
        area: row.area_total == null ? null : Number(row.area_total),
        featured: Boolean(row.destacado && row.destacado_hasta && new Date(row.destacado_hasta).getTime() > now),
        verified: Boolean(row.vendedor_verificado),
      }),
    )

    return {
      listings: listings.slice(0, 3),
      total: typeof countResult.count === 'number' ? countResult.count : null,
    }
  } catch {
    return { listings: [], total: null }
  }
}

const SPECIMEN: LandingListing = {
  id: 'ejemplo',
  slug: null,
  title: 'Penthouse con terraza, Las Mercedes',
  price: 2500000,
  currency: 'USD',
  operation: 'Venta',
  type: 'Apartamento',
  city: 'Caracas',
  state: 'Miranda',
  image: '/landing/hero-penthouse.jpg',
  bedrooms: 4,
  bathrooms: 4,
  area: 650,
  featured: false,
  verified: true,
}

function listingSchema(listings: LandingListing[], locale: string) {
  const prefix = locale === 'en' ? '/en' : ''
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'Venezuela Inmuebles',
        inLanguage: locale,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}${prefix}/catalogo?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      ...(listings.length
        ? [
            {
              '@type': 'ItemList',
              name: locale === 'en' ? 'Featured listings' : 'Inmuebles destacados',
              numberOfItems: listings.length,
              itemListElement: listings.map((listing, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `${SITE_URL}${prefix}/inmueble/${listing.slug || listing.id}`,
                name: listing.title,
              })),
            },
          ]
        : []),
    ],
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const isEnglish = locale === 'en'

  return {
    title: isEnglish
      ? 'Venezuela Inmuebles | Houses, apartments and land for sale and rent'
      : 'Venezuela Inmuebles | Casas, apartamentos y terrenos en venta y alquiler',
    description: isEnglish
      ? 'Buy, sell or rent property in Venezuela. Houses, apartments, land, retail and offices with verified advertisers and direct contact.'
      : 'Compra, vende o alquila inmuebles en Venezuela. Casas, apartamentos, terrenos, locales y oficinas con anunciantes verificados y contacto directo.',
    alternates: {
      canonical: isEnglish ? `${SITE_URL}/en` : SITE_URL,
      languages: {
        'es-VE': SITE_URL,
        'en-US': `${SITE_URL}/en`,
      },
    },
    openGraph: {
      type: 'website',
      locale: isEnglish ? 'en_US' : 'es_VE',
      url: isEnglish ? `${SITE_URL}/en` : SITE_URL,
      siteName: 'Venezuela Inmuebles',
      title: isEnglish
        ? 'Venezuela Inmuebles | Property for sale and rent'
        : 'Venezuela Inmuebles | Inmuebles en venta y alquiler',
      description: isEnglish
        ? 'Buy, sell or rent property in Venezuela with verified advertisers.'
        : 'Compra, vende o alquila inmuebles en Venezuela con anunciantes verificados.',
      images: [{ url: `${SITE_URL}/landing/hero-penthouse.jpg`, width: 1672, height: 941 }],
    },
  }
}

export default async function LandingPage() {
  const locale = await getLocale()
  const copy = landingCopy[locale] ?? landingCopy.es
  const { listings, total } = await getLandingListings()
  const schema = listingSchema(listings, locale)
  const totalLabel = total == null ? '—' : total.toLocaleString(locale === 'en' ? 'en-US' : 'es-VE')

  return (
    <div className={`editorialLanding ${styles.page}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <div className={styles.guides} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <LandingNav copy={copy} />

      {/* ---------------------------------------------------------------- Hero */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.watermark} aria-hidden="true">
          01
        </div>

        <p className={styles.kicker}>{copy.hero.kicker}</p>

        <div className={styles.heroCopy}>
          <div className={styles.heroIntro}>
            <h1 className={styles.headline} id="hero-title">
              {copy.hero.title.map((line, index) => (
                <span key={line} className={index === copy.hero.title.length - 1 ? styles.headlineLast : undefined}>
                  {line}
                </span>
              ))}
            </h1>
            <p className={styles.heroLead}>{copy.hero.lead}</p>
          </div>

          <ul className={styles.heroFacts}>
            {copy.hero.facts.map((fact) => (
              <li key={fact.title}>
                <span className={styles.heroFactTitle}>{fact.title}</span>
                <span className={styles.heroFactBody}>{fact.body}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure className={styles.figure}>
          <div className={styles.figureFrame}>
            <Image
              src="/landing/hero-penthouse.jpg"
              alt={copy.hero.figureCaption}
              fill
              priority
              sizes="(max-width: 960px) 100vw, 42vw"
            />
          </div>

          <PortalSearch copy={copy} locale={locale} />

          <figcaption className={styles.caption}>
            <span>{copy.hero.figureCaption}</span>
            <span>{copy.hero.figureNote}</span>
          </figcaption>
        </figure>

        <div className={styles.rail}>
          <LocalLink href="/catalogo" className={styles.scrollCue}>
            {copy.featured.seeAll} <span aria-hidden="true">↗</span>
          </LocalLink>
          <div className={styles.railMeta}>
            <span>{total == null ? copy.hero.railStates : `${totalLabel} ${copy.hero.railSuffix}`}</span>
            <span>{copy.hero.railOps}</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Featured */}
      <section className={styles.featured} aria-labelledby="featured-title">
        <div className={styles.sectionRow}>
          <span className={styles.sectionIndex}>{copy.featured.label}</span>
          <LocalLink href="/catalogo" className={styles.sectionLink}>
            {copy.featured.seeAll} <span aria-hidden="true">↗</span>
          </LocalLink>
        </div>

        <h2 className={styles.sectionTitle} id="featured-title">
          {copy.featured.title}
        </h2>

        {listings.length > 0 ? (
          <div className={styles.tileGrid}>
            {listings.map((listing) => (
              <PropertyTile key={listing.id} listing={listing} copy={copy} locale={locale} />
            ))}
          </div>
        ) : (
          <>
            <div className={styles.emptyState}>
              <div className={styles.emptyCopy}>
                <h3>{copy.featured.emptyTitle}</h3>
                <p className={styles.emptyBody}>{copy.featured.emptyBody}</p>
                <LocalLink href="/publicar-inmueble" className={styles.emptyCta}>
                  {copy.featured.emptyCta} <span aria-hidden="true">↗</span>
                </LocalLink>
              </div>
              <div className={styles.emptySpecimen}>
                <PropertyTile listing={SPECIMEN} copy={copy} locale={locale} specimen />
              </div>
            </div>
          </>
        )}
      </section>

      {/* --------------------------------------------------------------- Types */}
      <section className={styles.types} aria-labelledby="types-title">
        <div className={styles.sectionRow}>
          <span className={styles.sectionIndex}>{copy.types.label}</span>
          <LocalLink href="/catalogo" className={styles.sectionLink}>
            {copy.featured.seeAll} <span aria-hidden="true">↗</span>
          </LocalLink>
        </div>

        <h2 className={styles.sectionTitle} id="types-title">
          {copy.types.title}
        </h2>

        <ul className={styles.rows}>
          {copy.types.items.map((item, index) => (
            <li key={item.href}>
              <LocalLink href={item.href} className={styles.row}>
                <span className={styles.rowNum}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.rowName}>{item.name}</span>
                <span className={styles.rowPlace}>{item.note}</span>
                <span className={styles.rowArrow} aria-hidden="true">
                  ↗
                </span>
              </LocalLink>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------------- Cities */}
      <section className={styles.cities} aria-labelledby="cities-title">
        <div className={styles.sectionRow}>
          <span className={styles.sectionIndex}>{copy.cities.label}</span>
          <span className={styles.sectionNote}>{copy.cities.note}</span>
        </div>

        <h2 className={styles.sectionTitle} id="cities-title">
          {copy.cities.title}
        </h2>

        <ul className={styles.cityList}>
          {copy.cities.items.map((city) => (
            <li key={city}>
              <LocalLink href={`/catalogo?ciudad=${encodeURIComponent(city)}`} className={styles.cityChip}>
                {city}
              </LocalLink>
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------------------------- Trust */}
      <section className={styles.trust} aria-labelledby="trust-title">
        <div className={styles.sectionRow}>
          <span className={styles.sectionIndex}>{copy.trust.label}</span>
          <span className={styles.sectionNote}>Venezuela Inmuebles</span>
        </div>

        <h2 className={styles.trustTitle} id="trust-title">
          {copy.trust.title}
        </h2>

        <ol className={styles.steps}>
          {copy.trust.steps.map((step) => (
            <li key={step.index} className={styles.step}>
              <span className={styles.stepIndex}>{step.index}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------------- Plans */}
      <section className={styles.plans} aria-labelledby="plans-title">
        <div className={styles.sectionRow}>
          <span className={styles.sectionIndex}>{copy.plans.label}</span>
          <LocalLink href="/planes" className={styles.sectionLink}>
            {copy.plans.cta} <span aria-hidden="true">↗</span>
          </LocalLink>
        </div>

        <h2 className={styles.sectionTitle} id="plans-title">
          {copy.plans.title}
        </h2>

        <div className={styles.planGrid}>
          {copy.plans.items.map((plan) => (
            <div key={plan.name} className={styles.plan}>
              <div className={styles.planHead}>
                <span className={styles.planName}>{plan.name}</span>
                <span className={styles.planPrice}>
                  {plan.price}
                  <small>{plan.period}</small>
                </span>
              </div>
              <ul className={styles.planFeatures}>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className={styles.plansNote}>{copy.plans.note}</p>
      </section>

      {/* ------------------------------------------------------------- Closing */}
      <section className={styles.closing} aria-labelledby="closing-title">
        <h2 className={styles.closingTitle} id="closing-title">
          {copy.closing.title}
        </h2>
        <p className={styles.closingBody}>{copy.closing.body}</p>
        <div className={styles.closingActions}>
          <LocalLink href="/publicar-inmueble" className={styles.closingPrimary}>
            {copy.closing.primary} <span aria-hidden="true">↗</span>
          </LocalLink>
          <LocalLink href="/catalogo" className={styles.closingSecondary}>
            {copy.closing.secondary}
          </LocalLink>
        </div>
      </section>

      {/* -------------------------------------------------------------- Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <span className={styles.brandName}>
            <span>Venezuela</span>
            <span>Inmuebles</span>
          </span>
          <p>{copy.footer.note}</p>
          <a href="mailto:contacto@venezuelainmuebles.online" className={styles.footerMail}>
            contacto@venezuelainmuebles.online
          </a>
        </div>

        <div className={styles.footerColumns}>
          {copy.footer.columns.map((column) => (
            <div key={column.title} className={styles.footerColumn}>
              <span className={styles.footerColumnTitle}>{column.title}</span>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <LocalLink href={link.href}>{link.label}</LocalLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.colophon}>
          <span>{copy.footer.rightsPrefix} {new Date().getFullYear()} Venezuela Inmuebles</span>
          <span>Caracas · Maracaibo · Valencia · Lechería</span>
          <span>{copy.footer.coords}</span>
        </div>
      </footer>
    </div>
  )
}
