import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { ArrowRight, Star, Search, Home, Key, Building2, MapPin, TreePine, Store, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Home' })
  return {
    title: {
      default: 'Inmuebles en Venezuela | VendeT Inmuebles - Casas, Apartamentos, Terrenos',
      template: `%s | VendeT Inmuebles`
    },
    description: 'VendeT Inmuebles es el portal líder de bienes raíces en Venezuela. Encuentra casas, apartamentos, terrenos, locales y oficinas en venta y alquiler en todo el país.',
    keywords: ['inmuebles venezuela', 'casas en venta venezuela', 'apartamentos venezuela', 'terrenos venezuela', 'alquiler venezuela', 'bienes raices venezuela', 'propiedades venezuela', 'inmobiliaria venezuela'],
    authors: [{ name: 'VendeT Inmuebles' }],
    creator: 'VendeT Inmuebles',
    publisher: 'VendeT Inmuebles',
    alternates: {
      canonical: 'https://vendet-inmuebles.online/',
      languages: {
        es: 'https://vendet-inmuebles.online/',
        en: 'https://vendet-inmuebles.online/en/',
      },
    },
    openGraph: {
      title: 'Inmuebles en Venezuela | VendeT Inmuebles',
      description: 'El portal líder de bienes raíces en Venezuela. Encuentra tu próximo hogar o inversión.',
      url: 'https://vendet-inmuebles.online/',
      siteName: 'VendeT Inmuebles',
      images: [{
        url: 'https://vendet-inmuebles.online/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VendeT Inmuebles - Bienes Raíces Venezuela'
      }],
      locale: params.locale === 'en' ? 'en_US' : 'es_VE',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Inmuebles en Venezuela | VendeT Inmuebles',
      description: 'El portal líder de bienes raíces en Venezuela.',
      images: ['https://vendet-inmuebles.online/og-image.png'],
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

const PLACEHOLDER_IMAGES = ['/placeholder-property.webp']
function getPlaceholderImage(titulo: string) {
  return PLACEHOLDER_IMAGES[Math.abs(titulo.charCodeAt(0)) % PLACEHOLDER_IMAGES.length]
}

async function getDestacados(limit = 8) {
  try {
    const { data, error } = await supabase.rpc('obtener_destacados_home', { p_limite: limit })
    if (!error && data) return data as any[]
    const { data: data2 } = await supabase
      .from('productos')
      .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, creado_en, tipo_propiedad, operacion_tipo')
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
    .select('id, titulo, precio_usd, imagen_url, ubicacion_ciudad, visitas, creado_en, tipo_propiedad, operacion_tipo')
    .eq('activo', true)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
    .order('visitas', { ascending: false })
    .limit(limit)
  return data || []
}

async function getRecentProducts(limit = 8) {
  const { data, error } = await supabase
    .from('productos')
    .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, creado_en, boosteado_en, destacado, destacado_hasta, tipo_propiedad, operacion_tipo')
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

function PropertyCard({ p, highlighted = false, priority = false, t }: { p: any; highlighted?: boolean; priority?: boolean; t: any }) {
  const imgUrl = p.imagen_url || getPlaceholderImage(p.titulo)
  const operacion = p.operacion_tipo === 'Venta' ? t('home.propertyCard.forSale') : t('home.propertyCard.forRent')
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
            <Star size={10} /> {t('home.propertyCard.featured')}
          </div>
        )}
        <div className="absolute top-2 right-2 z-10 bg-brand-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          {operacion}
        </div>
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
          blurDataURL="/placeholder-property.webp"
        />
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
          <MapPin size={10} /> {p.ubicacion_ciudad || p.estado || 'Venezuela'}
        </p>
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">
          {p.titulo}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {p.tipo_propiedad}
        </p>
        <p className="text-xl font-black text-brand-primary mt-2">
          ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(p.precio_usd || 0))}
          <span className="text-xs font-normal text-gray-500"> USD</span>
        </p>
      </div>
    </LocalLink>
  )
}

export default async function HomePage() {
  const t = await getTranslations()
  const [destacados, trending, propiedades] = await Promise.all([
    getDestacados(),
    getTrending(),
    getRecentProducts(),
  ])
  const baseUrl = 'https://vendet-inmuebles.online'
  // Schema markup removed to fix compilation issues

  const tiposPropiedad = [
    { id: 'casa', nombre: t('home.types.house'), icon: Home, desc: t('home.types.houseDesc') },
    { id: 'apartamento', nombre: t('home.types.apartment'), icon: Building2, desc: t('home.types.apartmentDesc') },
    { id: 'terreno', nombre: t('home.types.land'), icon: TreePine, desc: t('home.types.landDesc') },
    { id: 'local', nombre: t('home.types.commercial'), icon: Store, desc: t('home.types.commercialDesc') },
    { id: 'oficina', nombre: t('home.types.office'), icon: Briefcase, desc: t('home.types.officeDesc') },
    { id: 'galpon', nombre: t('home.types.warehouse'), icon: Building2, desc: t('home.types.warehouseDesc') },
  ]

  const estadosVenezuela = [
    'Distrito Capital', 'Miranda', 'Zulia', 'Carabobo', 'Aragua',
    'Lara', 'Bolívar', 'Anzoátegui', 'Táchira', 'Mérida'
  ]

  return (
    <div className="bg-white">
      {/* HERO - ZILLOW STYLE: Immersive with central search */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 py-20 md:py-32 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-orange-500/20 backdrop-blur-sm border border-orange-400/30 rounded-full px-4 py-2 mb-6">
                <Star size={16} className="fill-orange-400 text-orange-400" />
                <span className="text-orange-300 font-semibold text-sm">El marketplace #1 de inmuebles en Venezuela</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
                Encuentra tu lugar
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">perfecto en Venezuela</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto font-medium">
                Miles de propiedades en venta y alquiler. Publica gratis o busca tu próximo hogar hoy mismo.
              </p>
            </div>

            {/* Search Box - Central Focus like Zillow */}
            <div className="max-w-5xl mx-auto mb-12">
              <div className="bg-white rounded-2xl shadow-2xl p-3 md:p-4">
                {/* Tabs for intent */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  <button className="px-6 py-2.5 bg-blue-600 text-white rounded-full font-bold text-sm whitespace-nowrap hover:bg-blue-700 transition">
                    Comprar
                  </button>
                  <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-full font-bold text-sm whitespace-nowrap hover:bg-gray-200 transition">
                    Alquilar
                  </button>
                  <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-full font-bold text-sm whitespace-nowrap hover:bg-gray-200 transition">
                    Vender
                  </button>
                </div>

                {/* Search inputs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2 flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                    <MapPin size={20} className="text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Ciudad, estado o zona..."
                      className="w-full bg-transparent outline-none text-gray-800 font-medium placeholder:text-gray-400"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                    <Home size={18} className="text-gray-400 shrink-0" />
                    <select className="w-full bg-transparent outline-none text-gray-700 font-medium cursor-pointer">
                      <option value="">Tipo de propiedad</option>
                      <option value="casa">Casa</option>
                      <option value="apartamento">Apartamento</option>
                      <option value="terreno">Terreno</option>
                      <option value="local">Local comercial</option>
                      <option value="oficina">Oficina</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                    <Key size={18} className="text-gray-400 shrink-0" />
                    <select className="w-full bg-transparent outline-none text-gray-700 font-medium cursor-pointer">
                      <option value="">Operación</option>
                      <option value="venta">Venta</option>
                      <option value="alquiler">Alquiler</option>
                    </select>
                  </div>
                </div>

                {/* Search button full width on mobile */}
                <div className="mt-4">
                  <LocalLink
                    href="/catalogo"
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                  >
                    <Search size={22} className="group-hover:scale-110 transition-transform" />
                    Buscar Propiedades
                  </LocalLink>
                </div>
              </div>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <LocalLink
                href="/publicar-inmueble"
                className="bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Publicar Gratis
              </LocalLink>
              <LocalLink
                href="/catalogo"
                className="bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition flex items-center gap-2"
              >
                Ver todas las propiedades
                <ArrowRight size={20} />
              </LocalLink>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-black text-orange-400">+1,200</p>
                <p className="text-xs md:text-sm text-blue-100 mt-1">Propiedades Activas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-black text-orange-400">24</p>
                <p className="text-xs md:text-sm text-blue-100 mt-1">Estados Cubiertos</p>
              </div>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-black text-orange-400">100%</p>
                <p className="text-xs md:text-sm text-blue-100 mt-1">Gratis para Publicar</p>
              </div>
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-black text-orange-400">+5K</p>
                <p className="text-xs md:text-sm text-blue-100 mt-1">Usuarios Registrados</p>
              </div>
            </div>
          </div>
        </section>

        {/* Banner gratis */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-y border-green-200">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <p className="font-bold text-gray-900 text-sm">{t('home.freeBanner.title')}</p>
            </div>
            <p className="text-xs text-gray-600 hidden sm:inline">
              {t('home.freeBanner.subtitle')}
            </p>
            <LocalLink href="/publicar" className="text-green-700 text-xs font-bold hover:underline">
              {t('home.freeBanner.publishNow')}
            </LocalLink>
          </div>
        </div>

        {/* Destacadas */}
        {destacados.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 py-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900">{t('home.featured.title')}</h2>
                <p className="text-sm text-gray-500">{t('home.featured.subtitle')}</p>
              </div>
              <span className="bg-brand-accent/20 text-brand-primary text-xs font-bold px-2.5 py-1 rounded-full">
                <Star size={12} className="inline mr-1" /> {t('home.featured.badge')}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(destacados as any[]).map((p: any, index: number) => (
                <PropertyCard
                  key={p.id}
                  p={p}
                  highlighted
                  priority={index < 2}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tipos propiedad - ZILLOW STYLE */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
                Explora por tipo de propiedad
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Encuentra exactamente lo que buscas entre nuestra amplia variedad de categorías
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {tiposPropiedad.map((tipo) => {
                const Icon = tipo.icon
                return (
                  <LocalLink
                    key={tipo.id}
                    href={`/catalogo?tipo=${tipo.id}`}
                    prefetch={true}
                    className="bg-white rounded-2xl p-6 text-center shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group border border-gray-100"
                  >
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <Icon size={28} className="text-white" />
                    </div>
                    <span className="font-bold text-gray-900 text-sm block mb-1">{tipo.nombre}</span>
                    <span className="block text-xs text-gray-500 line-clamp-2">{tipo.desc}</span>
                  </LocalLink>
                )
              })}
            </div>
          </div>
        </section>

        {/* Cómo funciona - ZILLOW STYLE */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
                ¿Cómo funciona VendeT?
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Publicar o encontrar tu propiedad ideal es más fácil de lo que crees
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center relative">
                {/* Connector line for desktop */}
                <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-blue-200 to-orange-200 -z-10"></div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Search size={32} className="text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-xl mb-3">Busca propiedades</h3>
                <p className="text-gray-600 leading-relaxed">
                  Explora miles de inmuebles con filtros avanzados por ubicación, precio y características
                </p>
              </div>
              <div className="text-center relative">
                <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-blue-200 to-orange-200 -z-10"></div>
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 text-xl mb-3">Publica gratis</h3>
                <p className="text-gray-600 leading-relaxed">
                  Sube fotos, agrega detalles y publica tu propiedad en minutos sin costo alguno
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 text-xl mb-3">Conecta y vende</h3>
                <p className="text-gray-600 leading-relaxed">
                  Recibe mensajes directos de compradores interesados y cierra el trato sin comisiones
                </p>
              </div>
            </div>
            
            {/* CTA after how it works */}
            <div className="text-center mt-12">
              <LocalLink
                href="/publicar-inmueble"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition shadow-lg hover:shadow-xl"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Comenzar ahora — Es gratis
              </LocalLink>
            </div>
          </div>
        </section>

        {/* Recent Properties - ZILLOW STYLE CARD GRID */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">Propiedades Recientes</h2>
                <p className="text-gray-600">Las últimas publicaciones en el mercado venezolano</p>
              </div>
              <LocalLink
                href="/catalogo"
                className="hidden md:flex items-center gap-2 text-blue-600 font-bold hover:text-blue-700 transition"
                prefetch={true}
              >
                Ver todas <ArrowRight size={18} />
              </LocalLink>
            </div>
            
            {propiedades.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center shadow-lg border border-gray-100">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Home size={40} className="text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">¡Sé el primero en publicar!</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Aún no hay propiedades publicadas. Sé el primero en listar tu inmueble y llega a miles de compradores en toda Venezuela.
                </p>
                <LocalLink
                  href="/publicar-inmueble"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-orange-700 transition shadow-lg hover:shadow-xl"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Publicar mi propiedad — Gratis
                </LocalLink>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {propiedades.map((p, index) => {
                  const isHighlighted =
                    (p.destacado && p.destacado_hasta > new Date().toISOString()) || p.boosteado_en
                  return <PropertyCard key={p.id} p={p} highlighted={isHighlighted} priority={index < 2} t={t} />
                })}
              </div>
            )}
            
            {/* Mobile view all button */}
            <div className="md:hidden mt-8 text-center">
              <LocalLink
                href="/catalogo"
                className="inline-flex items-center gap-2 bg-white border-2 border-blue-600 text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition"
              >
                Ver todas las propiedades <ArrowRight size={18} />
              </LocalLink>
            </div>
          </div>
        </section>

        {/* Estados */}
        <section className="bg-white border-y border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 text-center mb-2">
              {t('home.states.title')}
            </h2>
            <p className="text-gray-600 text-center mb-8">{t('home.states.subtitle')}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {estadosVenezuela.map((estado) => (
                <LocalLink
                  key={estado}
                  href={`/catalogo?estado=${encodeURIComponent(estado)}`}
                  className="bg-gray-50 hover:bg-brand-accent/10 border border-gray-200 hover:border-brand-accent rounded-xl px-4 py-3 text-center transition group"
                >
                  <MapPin size={14} className="text-gray-400 group-hover:text-brand-accent inline mr-1" />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-brand-primary">{estado}</span>
                </LocalLink>
              ))}
            </div>
            <div className="text-center mt-6">
              <LocalLink
                href="/catalogo"
                className="text-brand-primary font-semibold text-sm hover:underline inline-flex items-center gap-1"
              >
                {t('home.states.viewAll')} <ArrowRight size={14} />
              </LocalLink>
            </div>
          </div>
        </section>

        {/* CTA */}
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
                href="/catalogo"
                className="inline-flex items-center gap-2 bg-white text-brand-primary px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg"
              >
                {t('home.cta.browseProperties')}
              </LocalLink>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export const revalidate = 120
