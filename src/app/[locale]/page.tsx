import Image from 'next/image'
import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, ArrowUpRight, Building2, Home, MapPin, Store, TreePine } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import PropertySearch from '@/components/PropertySearch'
import PropertyCard, { type PropertyCardData } from '@/components/PropertyCard'

const SITE_URL = 'https://venezuela-inmuebles.online'
const LISTING_COLUMNS = 'id, slug, titulo, precio, moneda, operacion_slug, tipo_nombre, ciudad, estado, main_image_url, habitaciones, banos, area_total, destacado, destacado_hasta, vendedor_verificado, creado_en'

async function getHomeListings(limit: number, featuredOnly = false): Promise<PropertyCardData[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    let query = supabase
      .from('vw_propiedades_publicas')
      .select(LISTING_COLUMNS)
      .eq('activo', true)
      .order('creado_en', { ascending: false })

    if (featuredOnly) query = query.eq('destacado', true)

    const { data, error } = await query.limit(limit)
    if (error || !data) return []

    const now = Date.now()
    const listings = data.map((row: any): PropertyCardData => ({
      id: row.id,
      slug: row.slug || null,
      title: row.titulo || 'Inmueble',
      price: Number(row.precio) || 0,
      currency: row.moneda || 'USD',
      operation_type: row.operacion_slug || 'venta',
      city: row.ciudad || null,
      state: row.estado || null,
      main_image_url: row.main_image_url || null,
      bedrooms: row.habitaciones == null ? null : Number(row.habitaciones),
      bathrooms: row.banos == null ? null : Number(row.banos),
      area_size: row.area_total == null ? null : Number(row.area_total),
      property_type: row.tipo_nombre || null,
      featured: Boolean(row.destacado && row.destacado_hasta && new Date(row.destacado_hasta).getTime() > now),
      verified: Boolean(row.vendedor_verificado),
    }))

    return featuredOnly ? listings.filter((listing) => listing.featured) : listings
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'landing' })
  const localePrefix = params.locale === 'es' ? '' : `/${params.locale}`

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `${SITE_URL}${localePrefix || '/'}`,
      languages: {
        'es-VE': SITE_URL,
        'en-US': `${SITE_URL}/en`,
      },
    },
    openGraph: {
      type: 'website',
      locale: params.locale === 'es' ? 'es_VE' : 'en_US',
      url: `${SITE_URL}${localePrefix || '/'}`,
      siteName: 'Venezuela Inmuebles',
      title: t('metaTitle'),
      description: t('metaDescription'),
      images: [{
        url: `${SITE_URL}/home-hero-caracas.jpg`,
        width: 1600,
        height: 1067,
        alt: 'Venezuela Inmuebles',
      }],
    },
  }
}

function listingSchema(properties: PropertyCardData[], locale: string) {
  if (!properties.length) return null
  const prefix = locale === 'es' ? '' : `/${locale}`

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: properties.length,
    itemListElement: properties.map((property, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}${prefix}/inmueble/${property.slug || property.id}`,
      name: property.title,
      image: property.main_image_url || `${SITE_URL}/sinimagen.webp`,
      offers: {
        '@type': 'Offer',
        price: property.price,
        priceCurrency: property.currency || 'USD',
        availability: 'https://schema.org/InStock',
      },
    })),
  }
}

export default async function HomePage() {
  const locale = await getLocale()
  const t = await getTranslations('landing')
  const [featuredListings, recentListings] = await Promise.all([
    getHomeListings(6, true),
    getHomeListings(8),
  ])
  const featuredIds = new Set(featuredListings.map((listing) => listing.id))
  const recent = recentListings.filter((listing) => !featuredIds.has(listing.id)).slice(0, 4)
  const schema = listingSchema([...featuredListings, ...recent].slice(0, 10), locale)

  const categories = [
    { slug: 'casas', number: '01', title: t('typeHouse'), description: t('typeHouseNote'), icon: Home },
    { slug: 'apartamentos', number: '02', title: t('typeApartment'), description: t('typeApartmentNote'), icon: Building2 },
    { slug: 'terrenos', number: '03', title: t('typeLand'), description: t('typeLandNote'), icon: TreePine },
    { slug: 'locales', number: '04', title: t('typeCommercial'), description: t('typeCommercialNote'), icon: Store },
  ]

  const states = ['Distrito Capital', 'Miranda', 'Zulia', 'Carabobo', 'Lara', 'Nueva Esparta']
  const cardLabels = {
    sale: t('cardSale'),
    rent: t('cardRent'),
    featured: t('cardFeatured'),
    priceOnRequest: t('cardPriceOnRequest'),
    bedroom: t('cardBedrooms'),
    bathroom: t('cardBathrooms'),
  }

  return (
    <div className="home-page">
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}

      <section className="home-hero">
        <Image
          src="/home-hero-caracas.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="home-hero__image"
        />
        <div className="home-hero__scrim" aria-hidden="true" />
        <div className="home-shell home-hero__inner">
          <div className="home-hero__copy">
            <p className="home-eyebrow home-hero__eyebrow"><span />{t('heroEyebrow')}</p>
            <h1>{t('heroTitle')}<br /><em>{t('heroAccent')}</em></h1>
            <p className="home-hero__description">{t('heroDescription')}</p>
            <div className="home-hero__actions">
              <LocalLink href="/catalogo" className="home-button home-button--gold">
                {t('heroBrowse')} <ArrowRight size={17} aria-hidden="true" />
              </LocalLink>
              <LocalLink href="/publicar-inmueble" className="home-hero__text-link">
                {t('heroPublish')} <ArrowUpRight size={16} aria-hidden="true" />
              </LocalLink>
            </div>
          </div>
          <p className="home-hero__caption"><span>01</span>{t('heroCaption')}</p>
        </div>
      </section>

      <section className="home-search-band" aria-label={t('searchEyebrow')}>
        <div className="home-shell">
          <PropertySearch locale={locale} />
        </div>
      </section>

      <section className="home-trust home-shell" aria-label={t('trustHeading')}>
        <div className="home-trust__item">
          <span className="home-trust__index">01</span>
          <div><h2>{t('trustSearchTitle')}</h2><p>{t('trustSearchText')}</p></div>
        </div>
        <div className="home-trust__item">
          <span className="home-trust__index">02</span>
          <div><h2>{t('trustContactTitle')}</h2><p>{t('trustContactText')}</p></div>
        </div>
        <div className="home-trust__item">
          <span className="home-trust__index">03</span>
          <div><h2>{t('trustPublishTitle')}</h2><p>{t('trustPublishText')}</p></div>
        </div>
      </section>

      <section className="home-section home-section--featured">
        <div className="home-shell">
          <header className="home-section__heading">
            <div>
              <p className="home-eyebrow">{t('featuredEyebrow')}</p>
              <h2>{t('featuredTitle')}</h2>
              <p className="home-section__description">{t('featuredDescription')}</p>
            </div>
            <LocalLink href="/catalogo" className="home-section__link">
              {t('viewAll')} <ArrowUpRight size={17} aria-hidden="true" />
            </LocalLink>
          </header>

          {featuredListings.length ? (
            <div className="property-grid property-grid--featured">
              {featuredListings.slice(0, 3).map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  locale={locale}
                  priority={index === 0}
                  labels={cardLabels}
                />
              ))}
            </div>
          ) : (
            <div className="home-empty-note">
              <span className="home-empty-note__mark"><Home size={20} aria-hidden="true" /></span>
              <p>{t('featuredEmpty')}</p>
              <LocalLink href="/publicar-inmueble">{t('publishFirst')} <ArrowRight size={15} aria-hidden="true" /></LocalLink>
            </div>
          )}
        </div>
      </section>

      <section className="home-section home-section--types">
        <div className="home-shell">
          <header className="home-section__heading home-section__heading--types">
            <div>
              <p className="home-eyebrow">{t('typesEyebrow')}</p>
              <h2>{t('typesTitle')}</h2>
            </div>
            <p className="home-section__description">{t('typesDescription')}</p>
          </header>
          <div className="home-category-grid">
            {categories.map(({ slug, number, title, description, icon: Icon }) => (
              <LocalLink key={slug} href={`/catalogo?categoria=${slug}`} className="home-category">
                <div className="home-category__top"><span>{number}</span><Icon size={22} strokeWidth={1.5} aria-hidden="true" /></div>
                <div className="home-category__bottom">
                  <div><h3>{title}</h3><p>{description}</p></div>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </div>
              </LocalLink>
            ))}
          </div>
          <div className="home-types-more">
            <LocalLink href="/catalogo?categoria=oficinas">{t('typeOffice')}</LocalLink>
            <span>·</span>
            <LocalLink href="/catalogo?categoria=galpones">{t('typeWarehouse')}</LocalLink>
            <span>·</span>
            <LocalLink href="/catalogo">{t('viewAllTypes')}</LocalLink>
          </div>
        </div>
      </section>

      <section className="home-section home-section--states">
        <div className="home-shell home-states-layout">
          <div>
            <p className="home-eyebrow">{t('statesEyebrow')}</p>
            <h2>{t('statesTitle')}</h2>
            <p className="home-section__description">{t('statesDescription')}</p>
          </div>
          <div className="home-state-list">
            {states.map((state) => (
              <LocalLink key={state} href={`/catalogo?estado=${encodeURIComponent(state)}`}>
                <MapPin size={14} aria-hidden="true" />{state}<ArrowUpRight size={14} aria-hidden="true" />
              </LocalLink>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-section--recent">
        <div className="home-shell">
          <header className="home-section__heading">
            <div>
              <p className="home-eyebrow">{t('recentEyebrow')}</p>
              <h2>{t('recentTitle')}</h2>
              <p className="home-section__description">{t('recentDescription')}</p>
            </div>
            <LocalLink href="/catalogo" className="home-section__link">
              {t('viewAll')} <ArrowUpRight size={17} aria-hidden="true" />
            </LocalLink>
          </header>
          {recent.length ? (
            <div className="property-grid">
              {recent.map((property, index) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  locale={locale}
                  priority={index === 0}
                  labels={cardLabels}
                />
              ))}
            </div>
          ) : (
            <div className="home-empty-note home-empty-note--wide">
              <span className="home-empty-note__mark"><MapPin size={20} aria-hidden="true" /></span>
              <div><strong>{t('recentEmptyTitle')}</strong><p>{t('recentEmptyText')}</p></div>
              <LocalLink href="/publicar-inmueble">{t('publishFirst')} <ArrowRight size={15} aria-hidden="true" /></LocalLink>
            </div>
          )}
        </div>
      </section>

      <section className="home-owner-section">
        <div className="home-shell home-owner-layout">
          <div className="home-owner-intro">
            <p className="home-eyebrow">{t('ownerEyebrow')}</p>
            <h2>{t('ownerTitle')}</h2>
            <p>{t('ownerDescription')}</p>
            <LocalLink href="/publicar-inmueble" className="home-button home-button--light">
              {t('ownerCta')} <ArrowRight size={17} aria-hidden="true" />
            </LocalLink>
          </div>
          <div className="home-owner-steps">
            <article><span>01</span><div><h3>{t('ownerStepOneTitle')}</h3><p>{t('ownerStepOneText')}</p></div></article>
            <article><span>02</span><div><h3>{t('ownerStepTwoTitle')}</h3><p>{t('ownerStepTwoText')}</p></div></article>
            <article><span>03</span><div><h3>{t('ownerStepThreeTitle')}</h3><p>{t('ownerStepThreeText')}</p></div></article>
          </div>
        </div>
      </section>

      <section className="home-closing">
        <div className="home-shell home-closing__inner">
          <div><p className="home-eyebrow">{t('closingEyebrow')}</p><h2>{t('closingTitle')}</h2></div>
          <LocalLink href="/catalogo" className="home-button home-button--gold">
            {t('closingCta')} <ArrowRight size={17} aria-hidden="true" />
          </LocalLink>
        </div>
      </section>
    </div>
  )
}

export const revalidate = 120
