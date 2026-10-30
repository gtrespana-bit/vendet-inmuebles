import type { Metadata } from 'next'
import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bath,
  BedDouble,
  Briefcase,
  Building2,
  Check,
  Home,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Store,
  TreePine,
  Warehouse,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import HomeSearch from '@/components/home/HomeSearch'
import ListingCard, { type HomeListing } from '@/components/home/ListingCard'
import styles from '@/components/home/home.module.css'

// Self-hosted variable fonts: no external requests, no layout shift.
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'

const SITE_URL = 'https://venezuela-inmuebles.online'
const LISTING_COLUMNS =
  'id, slug, titulo, precio, moneda, operacion_slug, tipo_nombre, ciudad, estado, main_image_url, habitaciones, banos, area_total, destacado, destacado_hasta, vendedor_verificado, creado_en'

async function getHomeListings(limit: number, featuredOnly = false): Promise<HomeListing[]> {
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
    const listings = data.map(
      (row: any): HomeListing => ({
        id: String(row.id),
        slug: row.slug || null,
        title: row.titulo || 'Inmueble',
        price: Number(row.precio) || 0,
        currency: row.moneda || 'USD',
        operation: row.operacion_slug || null,
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

    return featuredOnly ? listings.filter((listing) => listing.featured) : listings
  } catch {
    return []
  }
}

/**
 * Shown only while the inventory is empty, so the design can be reviewed
 * (and so visitors see what a listing looks like). Clearly labelled as samples.
 */
function sampleListings(locale: string): HomeListing[] {
  const english = locale === 'en'
  return [
    {
      id: 'sample-villa',
      slug: null,
      title: english ? 'Contemporary villa with garden, Los Chorros' : 'Villa contemporánea con jardín, Los Chorros',
      price: 890000,
      currency: 'USD',
      operation: 'Venta',
      city: 'Caracas',
      state: 'Miranda',
      image: '/demo/villa-caracas.jpg',
      bedrooms: 4,
      bathrooms: 5,
      area: 620,
      featured: true,
      verified: true,
      sample: true,
    },
    {
      id: 'sample-apartment',
      slug: null,
      title: english ? 'Bright apartment with hillside views' : 'Apartamento luminoso con vista a la montaña',
      price: 1250,
      currency: 'USD',
      operation: 'Alquiler',
      city: 'Caracas',
      state: 'Distrito Capital',
      image: '/demo/apartamento-salon.jpg',
      bedrooms: 3,
      bathrooms: 3,
      area: 185,
      featured: true,
      verified: true,
      sample: true,
    },
    {
      id: 'sample-terrace',
      slug: null,
      title: english ? 'Penthouse with private terrace' : 'Penthouse con terraza privada',
      price: 465000,
      currency: 'USD',
      operation: 'Venta',
      city: 'Lechería',
      state: 'Anzoátegui',
      image: '/demo/terraza-lecheria.jpg',
      bedrooms: 3,
      bathrooms: 4,
      area: 240,
      featured: true,
      verified: false,
      sample: true,
    },
  ]
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'homePage' })
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
      images: [
        {
          url: `${SITE_URL}/demo/villa-caracas.jpg`,
          width: 1448,
          height: 1086,
          alt: 'Venezuela Inmuebles',
        },
      ],
    },
  }
}

function listingSchema(listings: HomeListing[], locale: string) {
  const prefix = locale === 'es' ? '' : `/${locale}`
  const items = listings.filter((listing) => !listing.sample)
  if (!items.length) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((property, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}${prefix}/inmueble/${property.slug || property.id}`,
      name: property.title,
      image: property.image || `${SITE_URL}/sinimagen.webp`,
      offers: {
        '@type': 'Offer',
        price: property.price,
        priceCurrency: property.currency || 'USD',
        availability: 'https://schema.org/InStock',
      },
    })),
  }
}

const CATEGORIES = [
  { slug: 'casas', icon: Home, titleKey: 'typeHouse', noteKey: 'typeHouseNote' },
  { slug: 'apartamentos', icon: Building2, titleKey: 'typeApartment', noteKey: 'typeApartmentNote' },
  { slug: 'terrenos', icon: TreePine, titleKey: 'typeLand', noteKey: 'typeLandNote' },
  { slug: 'locales', icon: Store, titleKey: 'typeCommercial', noteKey: 'typeCommercialNote' },
  { slug: 'oficinas', icon: Briefcase, titleKey: 'typeOffice', noteKey: 'typeOfficeNote' },
  { slug: 'galpones', icon: Warehouse, titleKey: 'typeWarehouse', noteKey: 'typeWarehouseNote' },
] as const

const CITIES = ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay', 'Lechería', 'Mérida', 'Porlamar']

const PLANS = [
  { nameKey: 'planFree', price: '$0', periodKey: 'planFreePeriod', features: ['planFreeFeature1', 'planFreeFeature2', 'planFreeFeature3'], featured: false },
  { nameKey: 'planPro', price: '$9,99', periodKey: 'planProPeriod', features: ['planProFeature1', 'planProFeature2', 'planProFeature3'], featured: true },
  { nameKey: 'planAgency', price: '$39,99', periodKey: 'planAgencyPeriod', features: ['planAgencyFeature1', 'planAgencyFeature2', 'planAgencyFeature3'], featured: false },
] as const

export default async function HomePage() {
  const locale = await getLocale()
  const t = await getTranslations('homePage')

  const [featuredListings, recentListings] = await Promise.all([
    getHomeListings(6, true),
    getHomeListings(6),
  ])

  const featuredIds = new Set(featuredListings.map((listing) => listing.id))
  const recent = recentListings.filter((listing) => !featuredIds.has(listing.id)).slice(0, 3)
  const hasInventory = featuredListings.length + recent.length > 0
  const showcase = hasInventory ? (featuredListings.length ? featuredListings.slice(0, 3) : recent) : sampleListings(locale)
  const schema = listingSchema([...featuredListings, ...recent], locale)

  const cardLabels = {
    sale: t('cardSale'),
    rent: t('cardRent'),
    featured: t('cardFeatured'),
    verified: t('cardVerified'),
    sample: t('cardSample'),
    priceOnRequest: t('cardPriceOnRequest'),
    bedrooms: t('cardBedrooms'),
    bathrooms: t('cardBathrooms'),
  }

  return (
    <div className={styles.page}>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}

      {/* ------------------------------------------------------------ Hero */}
      <section className={styles.hero}>
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{t('heroEyebrow')}</p>

              <h1 className={styles.heroTitle}>
                {t('heroTitleA')} <em>{t('heroTitleB')}</em>
              </h1>

              <p className={styles.heroLead}>{t('heroLead')}</p>

              <div className={styles.heroActions}>
                <LocalLink href="/catalogo" className={`${styles.button} ${styles.buttonPrimary}`}>
                  {t('heroBrowse')}
                  <ArrowRight size={17} aria-hidden="true" />
                </LocalLink>
                <LocalLink href="/publicar-inmueble" className={`${styles.button} ${styles.buttonGhost}`}>
                  {t('heroPublish')}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </LocalLink>
              </div>

              <div className={styles.heroProof}>
                <span>
                  <BadgeCheck size={15} aria-hidden="true" />
                  {t('proofVerified')}
                </span>
                <span>
                  <ShieldCheck size={15} aria-hidden="true" />
                  {t('proofFree')}
                </span>
                <span>
                  <MessagesSquare size={15} aria-hidden="true" />
                  {t('proofDirect')}
                </span>
              </div>
            </div>

            <div className={styles.heroMedia}>
              <div className={styles.heroFrame}>
                <Image
                  src="/demo/villa-caracas.jpg"
                  alt={t('previewTitle')}
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 46vw"
                />
              </div>

              <div className={styles.heroPreview}>
                <span className={styles.heroPreviewTag}>{t('previewTag')}</span>
                <div className={styles.heroPreviewBody}>
                  <p className={styles.heroPreviewTitle}>{t('previewTitle')}</p>
                  <p className={styles.heroPreviewMeta}>{t('previewMeta')}</p>
                </div>
                <span className={styles.heroPreviewPrice}>{t('previewPrice')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Search dock */}
      <section className={styles.searchDock} aria-label={t('heroBrowse')}>
        <div className={styles.shell}>
          <HomeSearch
            locale={locale}
            labels={{
              buy: t('searchBuy'),
              rent: t('searchRent'),
              city: t('searchCity'),
              cityPlaceholder: t('searchCityPlaceholder'),
              state: t('searchState'),
              allStates: t('searchAllStates'),
              type: t('searchType'),
              anyType: t('searchAnyType'),
              price: t('searchPrice'),
              anyPrice: t('searchAnyPrice'),
              submit: t('searchSubmit'),
              hint: t('searchHint'),
              quick: t('searchQuick'),
              quickLinks: [
                { label: t('quickHousesCaracas'), href: '/catalogo?categoria=casas&ciudad=Caracas' },
                { label: t('quickRentApartments'), href: '/catalogo?categoria=apartamentos&operacion=Alquiler' },
                { label: t('quickLand'), href: '/catalogo?categoria=terrenos' },
                { label: t('quickOffices'), href: '/catalogo?categoria=oficinas' },
              ],
            }}
          />

          {/* Values */}
          <div className={styles.values}>
            <div className={styles.value}>
              <span className={styles.valueIcon}>
                <Home size={17} aria-hidden="true" />
              </span>
              <div>
                <h3>{t('valueOneTitle')}</h3>
                <p>{t('valueOneText')}</p>
              </div>
            </div>
            <div className={styles.value}>
              <span className={styles.valueIcon}>
                <ShieldCheck size={17} aria-hidden="true" />
              </span>
              <div>
                <h3>{t('valueTwoTitle')}</h3>
                <p>{t('valueTwoText')}</p>
              </div>
            </div>
            <div className={styles.value}>
              <span className={styles.valueIcon}>
                <MessagesSquare size={17} aria-hidden="true" />
              </span>
              <div>
                <h3>{t('valueThreeTitle')}</h3>
                <p>{t('valueThreeText')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Featured */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>{t('featuredEyebrow')}</p>
              <h2>{t('featuredTitle')}</h2>
              <p className={styles.sectionLead}>{hasInventory ? t('featuredLead') : t('featuredEmptyText')}</p>
            </div>
            <LocalLink href="/catalogo" className={styles.sectionLink}>
              {t('viewAll')}
              <ArrowUpRight size={16} aria-hidden="true" />
            </LocalLink>
          </div>

          {!hasInventory && (
            <p className={styles.sampleNote}>
              <strong>{t('sampleNoteTitle')}</strong> {t('sampleNoteText')}
              <LocalLink href="/publicar-inmueble">{t('heroPublish')}</LocalLink>
            </p>
          )}

          <div className={styles.grid}>
            {showcase.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                locale={locale}
                labels={cardLabels}
                priority={index === 0}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Types */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>{t('typesEyebrow')}</p>
              <h2>{t('typesTitle')}</h2>
            </div>
            <LocalLink href="/catalogo" className={styles.sectionLink}>
              {t('viewAll')}
              <ArrowUpRight size={16} aria-hidden="true" />
            </LocalLink>
          </div>

          <div className={styles.typeGrid}>
            {CATEGORIES.map(({ slug, icon: Icon, titleKey, noteKey }) => (
              <LocalLink key={slug} href={`/catalogo?categoria=${slug}`} className={styles.typeTile}>
                <span className={styles.typeTileIcon}>
                  <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span>
                  <span className={styles.typeTileName}>{t(titleKey)}</span>
                  <span className={styles.typeTileNote}>{t(noteKey)}</span>
                </span>
              </LocalLink>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Cities */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>{t('citiesEyebrow')}</p>
              <h2>{t('citiesTitle')}</h2>
              <p className={styles.sectionLead}>{t('citiesLead')}</p>
            </div>
            <LocalLink href="/catalogo" className={styles.sectionLink}>
              {t('citiesAll')}
              <ArrowUpRight size={16} aria-hidden="true" />
            </LocalLink>
          </div>

          <div className={styles.cityGrid}>
            {CITIES.map((city) => (
              <LocalLink key={city} href={`/catalogo?ciudad=${encodeURIComponent(city)}`} className={styles.cityLink}>
                <span>{city}</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </LocalLink>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Owner */}
      <section className={styles.owner}>
        <div className={styles.shell}>
          <div className={styles.ownerGrid}>
            <div>
              <p className={`${styles.eyebrow} ${styles.ownerEyebrow}`}>{t('ownerEyebrow')}</p>
              <h2 className={styles.ownerTitle}>
                {t('ownerTitleA')} <em>{t('ownerTitleB')}</em>
              </h2>
              <p className={styles.ownerLead}>{t('ownerLead')}</p>
              <div className={styles.ownerActions}>
                <LocalLink href="/publicar-inmueble" className={`${styles.button} ${styles.buttonGold}`}>
                  {t('ownerCta')}
                  <ArrowRight size={17} aria-hidden="true" />
                </LocalLink>
                <LocalLink href="/planes" className={`${styles.button} ${styles.buttonGhost} ${styles.ownerSecondary}`}>
                  {t('ownerSecondary')}
                </LocalLink>
              </div>
            </div>

            <div className={styles.steps}>
              {[
                { index: '01', title: t('stepOneTitle'), text: t('stepOneText') },
                { index: '02', title: t('stepTwoTitle'), text: t('stepTwoText') },
                { index: '03', title: t('stepThreeTitle'), text: t('stepThreeText') },
              ].map((step) => (
                <div key={step.index} className={styles.step}>
                  <span className={styles.stepIndex}>{step.index}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Plans */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>{t('plansEyebrow')}</p>
              <h2>{t('plansTitle')}</h2>
              <p className={styles.sectionLead}>{t('plansLead')}</p>
            </div>
            <LocalLink href="/planes" className={styles.sectionLink}>
              {t('plansCta')}
              <ArrowUpRight size={16} aria-hidden="true" />
            </LocalLink>
          </div>

          <div className={styles.planGrid}>
            {PLANS.map((plan) => (
              <div key={plan.nameKey} className={`${styles.plan} ${plan.featured ? styles.planFeatured : ''}`}>
                <div className={styles.planHead}>
                  <span className={styles.planName}>{t(plan.nameKey)}</span>
                  <span className={styles.planPrice}>
                    {plan.price}
                    <small>{t(plan.periodKey)}</small>
                  </span>
                </div>
                <ul className={styles.planFeatures}>
                  {plan.features.map((featureKey) => (
                    <li key={featureKey}>
                      <Check size={14} aria-hidden="true" />
                      {t(featureKey)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className={styles.planNote}>{t('plansNote')}</p>
        </div>
      </section>

      {/* --------------------------------------------------------- Closing */}
      <section className={styles.closing}>
        <div className={styles.shell}>
          <div className={styles.closingInner}>
            <div>
              <p className={`${styles.eyebrow} ${styles.closingEyebrow}`}>{t('closingEyebrow')}</p>
              <h2 className={styles.closingTitle}>{t('closingTitle')}</h2>
            </div>
            <LocalLink href="/catalogo" className={`${styles.button} ${styles.buttonPrimary}`}>
              {t('closingCta')}
              <ArrowRight size={17} aria-hidden="true" />
            </LocalLink>
          </div>
        </div>
      </section>
    </div>
  )
}

export const revalidate = 120
