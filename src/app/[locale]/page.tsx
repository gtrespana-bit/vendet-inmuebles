import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { ArrowRight, Star, Zap, Eye, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BotonDescargarApp } from '@/components/BotonDescargarApp'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

function generateItemListSchema(properties: any[], baseUrl: string) {
  if (!properties || properties.length === 0) return null
  
  const itemListElements = properties.map((prop, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${baseUrl}/inmueble/${prop.id}`,
    name: prop.titulo,
    description: prop.descripcion || `${prop.operacion_tipo?.toLowerCase() === 'venta' ? 'Venta' : 'Alquiler'} de ${prop.tipo_propiedad} en ${prop.ubicacion_ciudad}`,
    image: prop.imagen_url || `${baseUrl}/placeholder-property.webp`,
    offers: {
      '@type': 'Offer',
      price: prop.precio_usd || 0,
      priceCurrency: 'USD',
      availability: prop.activo ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    }
  }))

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: itemListElements,
    numberOfItems: properties.length,
    description: 'Lista de propiedades inmobiliarias en Vent-Inmuebles'
  }
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Home' })
  
  return {
    title: {
      default: 'Clasificados Venezuela | VendeT.online - Compra y Venta en Venezuela',
      template: `%s | VendeT.online`
    },
    description: 'VendeT.online es el marketplace líder de clasificados en Venezuela. Publica gratis, compra y vende productos nuevos y usados en todo el país. Únete a miles de usuarios.',
    keywords: ['clasificados venezuela', 'compra venta venezuela', 'marketplace venezuela', 'vender en venezuela', 'clasificados online', 'tienda online venezuela', 'productos venezuela', 'mercado libre venezuela'],
    authors: [{ name: 'VendeT.online' }],
    creator: 'VendeT.online',
    publisher: 'VendeT.online',
    alternates: {
      canonical: 'https://vende-t.com/',
      languages: {
        es: 'https://vende-t.com/',
        en: 'https://vende-t.com/en/',
      },
    },
    openGraph: {
      title: 'Clasificados Venezuela | VendeT.online',
      description: 'El marketplace líder de clasificados en Venezuela. Publica gratis y vende tus productos.',
      url: 'https://vende-t.com/',
      siteName: 'VendeT.online',
      images: [
        {
          url: 'https://vende-t.com/og-image.png',
          width: 1200,
          height: 630,
          alt: 'VendeT.online - Clasificados Venezuela'
        }
      ],
      locale: params.locale === 'en' ? 'en_US' : 'es_VE',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Clasificados Venezuela | VendeT.online',
      description: 'El marketplace líder de clasificados en Venezuela. Publica gratis y vende tus productos.',
      images: ['https://vende-t.com/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

const PLACEHOLDER_IMAGES = ['/placeholder-product.webp']

function getPlaceholderImage(titulo: string) {
  return PLACEHOLDER_IMAGES[Math.abs(titulo.charCodeAt(0)) % PLACEHOLDER_IMAGES.length]
}

async function getDestacados(limit = 8) {
  try {
    const { data, error } = await supabase.rpc('obtener_destacados_home', { p_limite: limit })
    if (!error && data) return data as any[]

    const { data: data2 } = await supabase
      .from('productos')
      .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, creado_en')
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
      .eq('destacado', true)
      .gt('destacado_hasta', new Date().toISOString())
      .order('destacado_hasta', { ascending: false })
      .limit(limit)

    return data2 || []
  } catch {
    return []
  }
}

async function getTrending(limit = 8) {
  const { data } = await supabase
    .from('productos')
    .select('id, titulo, precio_usd, imagen_url, ubicacion_ciudad, visitas, creado_en')
    .eq('activo', true)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
    .order('visitas', { ascending: false })
    .limit(limit)
  return data || []
}

async function getRecentProducts(limit = 8) {
  const { data, error } = await supabase
    .from('productos')
    .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, creado_en, boosteado_en, destacado, destacado_hasta')
    .eq('activo', true)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
    .limit(20)

  if (error) return []

  const now = new Date().toISOString()
  return (data || [])
    .sort((a: any, b: any) => {
      const aBoost = a.boosteado_en || null
      const bBoost = b.boosteado_en || null
      if (aBoost && !bBoost) return -1
      if (!aBoost && bBoost) return 1
      if (aBoost && bBoost) return bBoost.localeCompare(aBoost)

      const aDest = a.destacado && a.destacado_hasta > now
      const bDest = b.destacado && b.destacado_hasta > now
      if (aDest && !bDest) return -1
      if (!aDest && bDest) return 1
      if (aDest && bDest) return b.destacado_hasta.localeCompare(a.destacado_hasta)

      return (b.creado_en || '').localeCompare(a.creado_en || '')
    })
    .slice(0, limit)
}

function ProductCard({ p, highlighted = false, priority = false, t }: { p: any; highlighted?: boolean; priority?: boolean; t: any }) {
  const imgUrl = p.imagen_url || getPlaceholderImage(p.titulo)

  return (
    <LocalLink
      href={`/inmueble/${p.id}`}
      className={`bg-white rounded-xl overflow-hidden transition-all duration-200 group block border ${
        highlighted
          ? 'border-2 border-brand-accent shadow-lg hover:shadow-xl hover:-translate-y-1'
          : 'shadow-sm border-gray-100 hover:shadow-lg hover:-translate-y-1 hover:border-gray-200'
      }`}
    >
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {highlighted && (
          <div className="absolute top-2 left-2 z-10 bg-brand-accent text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Star size={10} /> {t('home.productCard.featured')}
          </div>
        )}
        <Image
          src={imgUrl}
          alt={p.titulo}
          fill
          sizes="(max-width: 480px) 45vw, (max-width: 768px) 45vw, (max-width: 1024px) 23vw, 320px"
          className="object-cover group-hover:scale-110 transition-transform duration-300"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          priority={priority}
          fetchPriority={priority ? 'high' : 'auto'}
          quality={75}
          placeholder="blur"
          blurDataURL="/placeholder-product.webp"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">
          {p.titulo}
        </h3>
        <p className="text-xl font-black text-brand-primary mt-1">
          ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd || 0))}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {p.estado} · {p.ubicacion_ciudad || 'Venezuela'}
        </p>
      </div>
    </LocalLink>
  )
}

export default async function HomePage() {
  const t = await getTranslations()
  const [destacados, trending, productos] = await Promise.all([
    getDestacados(),
    getTrending(),
    getRecentProducts(),
  ])

  const baseUrl = 'https://vende-t.com'
  const allProducts = [...destacados, ...productos].slice(0, 20)
  const itemListSchema = generateItemListSchema(allProducts, baseUrl)

  return (
    <>
      {itemListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}
      <div className="bg-gray-50">
      <section className="bg-gradient-to-br from-brand-primary to-brand-dark py-10 md:py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-accent/5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />

        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-2 leading-tight">
            {t('home.hero.title1')}
            <br />
            <span className="text-brand-accent">{t('home.hero.title2')}</span>
          </h1>
          <p className="text-base md:text-lg text-blue-200 mb-2 max-w-2xl mx-auto">
            {t('home.hero.subtitle1')}
            <br />
            <span className="text-white/90 font-medium">
              {t('home.hero.subtitle2')}{' '}
              <span className="text-brand-accent font-bold">{t('home.hero.subtitle3')}</span>.
            </span>
          </p>

          <div className="inline-flex items-center gap-2 bg-brand-accent/15 border border-brand-accent/30 rounded-full px-4 py-1.5 mb-4">
            <Zap size={14} className="text-brand-accent" />
            <span className="text-xs font-semibold text-white">
              {t('home.hero.featuredBadge')}{' '}
              <span className="text-brand-accent font-black">{t('home.hero.featuredBadgeBold')}</span>
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <LocalLink
              href="/publicar"
              className="inline-flex items-center gap-2 bg-brand-accent text-gray-900 px-6 py-3 rounded-xl font-bold text-base hover:bg-accent/90 transition shadow-lg shadow-black/20"
            >
              <span>{t('home.hero.publishFree')}</span>
              <ArrowRight size={18} />
            </LocalLink>
            <LocalLink
              href="/creditos"
              className="inline-flex items-center gap-2 bg-white/10 border-2 border-white/20 text-white px-6 py-3 rounded-xl font-bold text-base hover:bg-white/20 transition"
            >
              <Eye size={18} />
              <span>{t('home.hero.seeHowToFeature')}</span>
            </LocalLink>
            <BotonDescargarApp />
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto text-center">
            <div>
              <p className="text-2xl font-black text-brand-accent">+130</p>
              <p className="text-[10px] text-white/60 mt-0.5">{t('home.hero.stats.activeProducts')}</p>
            </div>
            <div>
              <p className="text-2xl font-black text-brand-accent">+5K</p>
              <p className="text-[10px] text-white/60 mt-0.5">{t('home.hero.stats.users')}</p>
            </div>
            <div>
              <p className="text-2xl font-black text-brand-accent">$1</p>
              <p className="text-[10px] text-white/60 mt-0.5">{t('home.hero.stats.featureFrom')}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-y border-green-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shrink-0">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <p className="font-bold text-gray-900 text-sm">{t('home.freeBanner.title')}</p>
          </div>
          <p className="text-xs text-gray-600 hidden sm:inline">
            {t('home.freeBanner.subtitle')}
          </p>
          <LocalLink href="/como-funciona" className="text-green-700 text-xs font-bold hover:underline">
            {t('home.freeBanner.compare')}
          </LocalLink>
        </div>
      </div>

      {destacados.length > 0 ? (
        <section className="relative">
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-y border-yellow-200">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-accent rounded-full flex items-center justify-center shrink-0">
                  <Zap size={16} className="text-gray-900" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{t('home.featured.wantToFeature')}</p>
                  <p className="text-xs text-gray-600">
                    {t('home.featured.featureDesc')}
                  </p>
                </div>
              </div>
              <LocalLink
                href="/creditos"
                className="flex items-center gap-1 bg-brand-accent text-gray-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-accent/90 transition shrink-0"
              >
                {t('home.featured.seePackages')} <ArrowRight size={14} />
              </LocalLink>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-gray-900">{t('home.featured.title')}</h2>
              <span className="bg-brand-accent/20 text-brand-primary text-xs font-bold px-2.5 py-1 rounded-full">
                {t('home.featured.badge')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(destacados as any[]).map((p: any, index: number) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  highlighted
                  priority={index < 2} // Prioridad para las primeras 2 imágenes
                  t={t}
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-r from-blue-50 to-yellow-50 border border-gray-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-brand-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap size={28} className="text-gray-900" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">
              {t('home.featured.emptyTitle')}
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto mb-2">
              {t('home.featured.emptyDesc')}
            </p>
            <p className="text-brand-primary font-bold mb-6">{t('home.featured.emptyPrice')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <LocalLink
                href="/publicar"
                className="inline-flex items-center gap-2 bg-brand-accent text-gray-900 px-6 py-3 rounded-xl font-bold hover:bg-accent/90 transition"
              >
                {t('home.featured.publishFree')}
              </LocalLink>
              <LocalLink
                href="/creditos"
                className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-dark transition"
              >
                {t('home.featured.seeCreditPackages')} <ArrowRight size={16} />
              </LocalLink>
            </div>
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-brand-dark rounded-2xl p-8 md:p-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
              {t('home.boost.title')}
            </h2>
            <p className="text-gray-300 max-w-lg mx-auto">
              {t('home.boost.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center group hover:border-brand-accent/50 transition">
              <div className="w-12 h-12 bg-brand-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap size={24} className="text-brand-accent" />
              </div>
              <h3 className="font-bold text-white text-lg mb-1">{t('home.boost.boost.name')}</h3>
              <p className="text-3xl font-black text-brand-accent mb-2">{t('home.boost.boost.price')}</p>
              <p className="text-sm text-gray-300 mb-4">
                {t('home.boost.boost.desc')}
              </p>
              <div className="bg-white/5 rounded-lg p-3 text-sm text-gray-300">
                {t('home.boost.boost.detail')} <strong>ya</strong>
              </div>
            </div>

            <div className="bg-brand-accent rounded-xl p-6 text-center relative shadow-lg shadow-black/20 transform scale-[1.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-[10px] font-bold px-3 py-1 rounded-full">
                {t('home.boost.featured24.popular')}
              </div>
              <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star size={24} className="text-gray-900" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">{t('home.boost.featured24.name')}</h3>
              <p className="text-3xl font-black text-gray-900 mb-2">{t('home.boost.featured24.price')}</p>
              <p className="text-sm text-gray-800 mb-4">
                {t('home.boost.featured24.desc')}
              </p>
              <div className="bg-gray-900/10 rounded-lg p-3 text-sm text-gray-900">
                <TrendingUp size={14} className="inline mr-1" /> <strong>$2 USD</strong> ·
                {t('home.boost.featured24.detail')}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center group hover:border-brand-accent/50 transition">
              <div className="w-12 h-12 bg-brand-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye size={24} className="text-brand-accent" />
              </div>
              <h3 className="font-bold text-white text-lg mb-1">{t('home.boost.featured48.name')}</h3>
              <p className="text-3xl font-black text-brand-accent mb-2">{t('home.boost.featured48.price')}</p>
              <p className="text-sm text-gray-300 mb-4">
                {t('home.boost.featured48.desc')}
              </p>
              <div className="bg-white/5 rounded-lg p-3 text-sm text-gray-300">
                <strong>$4 USD</strong> · {t('home.boost.featured48.detail')}
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <LocalLink
              href="/creditos"
              className="inline-flex items-center gap-2 bg-brand-accent text-gray-900 px-8 py-3 rounded-xl font-bold hover:bg-accent/90 transition"
            >
              {t('home.boost.buyCredits')} <ArrowRight size={18} />
            </LocalLink>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
          {t('home.categories.title')}
        </h2>
        <p className="text-gray-600 mb-8">{t('home.categories.subtitle')}</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { id: 'vehiculos', nombre: t('home.categories.vehicles'), icon: '🚗', desc: t('home.categories.vehiclesDesc') },
            { id: 'tecnologia', nombre: t('home.categories.tech'), icon: '💻', desc: t('home.categories.techDesc') },
            { id: 'moda', nombre: t('home.categories.fashion'), icon: '👗', desc: t('home.categories.fashionDesc') },
            { id: 'hogar', nombre: t('home.categories.homeCat'), icon: '🛋', desc: t('home.categories.homeCatDesc') },
            { id: 'herramientas', nombre: t('home.categories.tools'), icon: '🔧', desc: t('home.categories.toolsDesc') },
            { id: 'otros', nombre: t('home.categories.others'), icon: '📦', desc: t('home.categories.othersDesc') },
          ].map((cat) => (
            <LocalLink
              key={cat.id}
              href={`/catalogo?categoria=${cat.id}`}
              prefetch={true}
              className="bg-white rounded-2xl p-6 text-center shadow-sm border hover:border-brand-accent transition hover:shadow-lg group"
            >
              <span className="text-4xl block mb-3 group-hover:scale-110 transition-transform">
                {cat.icon}
              </span>
              <span className="font-bold text-gray-900 text-sm">{cat.nombre}</span>
              <span className="block text-xs text-gray-600 mt-1 truncate">{cat.desc}</span>
            </LocalLink>
          ))}
        </div>
      </section>

      {trending.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-gray-900">{t('home.trending.title')}</h2>
            <span className="text-xs text-gray-500">{t('home.trending.period')}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {trending.map((p, index) => (
              <LocalLink
                key={p.id}
                href={`/inmueble/${p.id}`}
                prefetch={true}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition group block"
              >
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  <Image
                    src={p.imagen_url || getPlaceholderImage(p.titulo)}
                    alt={p.titulo}
                    fill
                    sizes="(max-width: 480px) 45vw, (max-width: 768px) 45vw, (max-width: 1024px) 23vw, 320px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    loading={index < 2 ? 'eager' : 'lazy'}
                    decoding="async"
                    priority={index < 2} // Prioridad para las primeras 2 imágenes
                    fetchPriority={index < 2 ? 'high' : 'auto'}
                    quality={75}
                    placeholder="blur"
                    blurDataURL="/placeholder-product.webp"
                  />
                  <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    🔥 Trending
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">
                    {p.titulo}
                  </h3>
                  <p className="text-xl font-black text-brand-primary mt-1">
                    ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd || 0))}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Eye size={11} className="text-gray-400" />
                    <p className="text-xs text-gray-500">{p.visitas || 0} {t('home.trending.views')}</p>
                  </div>
                </div>
              </LocalLink>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('home.recent.title')}</h2>
          <LocalLink
            href="/catalogo"
            className="text-brand-primary font-semibold text-sm hover:underline flex items-center gap-1"
            prefetch={true}
          >
            {t('home.recent.viewAll')} <ArrowRight size={14} />
          </LocalLink>
        </div>

        {productos.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center shadow-sm border">
            <p className="text-xl font-bold text-gray-800 mb-2">{t('home.recent.empty')}</p>
            <p className="text-gray-500 mb-6">{t('home.recent.emptyCta')}</p>
            <LocalLink
              href="/publicar"
              className="inline-block bg-brand-accent text-gray-900 px-6 py-3 rounded-lg font-bold hover:bg-accent/90 transition"
            >
              {t('home.recent.publishFree')}
            </LocalLink>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {productos.map((p, index) => {
              const isHighlighted =
                (p.destacado && p.destacado_hasta > new Date().toISOString()) || p.boosteado_en
              return <ProductCard key={p.id} p={p} highlighted={isHighlighted} priority={index < 2} t={t} />
            })}
          </div>
        )}
      </section>

      <section className="bg-brand-accent py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-4">
            {t('home.cta.title')}
          </h2>
          <p className="text-gray-800 text-lg mb-8">
            {t('home.cta.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <LocalLink
              href="/publicar"
              className="inline-flex items-center gap-2 bg-brand-primary text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-brand-dark transition shadow-lg"
              prefetch={true}
            >
              {t('home.cta.publishNow')}
              <ArrowRight size={20} />
            </LocalLink>
            <LocalLink
              href="/creditos"
              className="inline-flex items-center gap-2 bg-white text-brand-primary px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg"
            >
              {t('home.cta.featureAd')}
            </LocalLink>
          </div>
        </div>
      </section>
    </div>
    </>
  )
}

export const revalidate = 120
