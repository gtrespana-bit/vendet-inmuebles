import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { MapPin, ChevronRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

interface Props {
  ciudadSlug: string
  ciudadNombre: string
  estado: string
  categoriaSlug: string
  categoriaNombre: string
  descripcion: string
}

const CATEGORIA_MAP: Record<string, string> = {
  vehiculos: 'vehiculos',
  'tecnologia': 'tecnologia',
  moda: 'moda',
  hogar: 'hogar',
  herramientas: 'herramientas',
  materiales: 'materiales',
  'repuestos': 'repuestos',
  otros: 'otros',
}

async function getProductos(ciudadNombre: string, categoriaSlug: string) {
  const { data } = await supabase
    .from('productos')
    .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, subcategoria, destacado, destacado_hasta')
    .eq('activo', true)
    .eq('ubicacion_ciudad', ciudadNombre)
    .eq('subcategoria', categoriaSlug)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
    .order('creado_en', { ascending: false })
    .limit(24)
  return data || []
}

const CATEGORIA_NAMES: Record<string, string> = {
  vehiculos: 'Vehículos',
  tecnologia: 'Tecnología',
  moda: 'Moda',
  hogar: 'Hogar',
  herramientas: 'Herramientas',
  materiales: 'Materiales',
  repuestos: 'Repuestos',
  otros: 'Otros',
}

function ProductosGrid({ productos, categoriaNombre, ciudadNombre, t }: { productos: any[], categoriaNombre: string, ciudadNombre: string, t: any }) {
  if (productos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-xl mb-2">{t('noAds', { category: categoriaNombre.toLowerCase(), city: ciudadNombre })}</p>
        <p className="mb-4">{t('beFirst')}</p>
        <LocalLink href="/publicar" className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold">{t('postFree')}</LocalLink>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {productos.map((p: any) => (
        <LocalLink key={p.id} href={`/inmueble/${p.id}`} className="bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg transition group block">
          <div className="aspect-square bg-gray-100 relative overflow-hidden">
            {p.destacado && new Date(p.destacado_hasta) > new Date() && (
              <div className="absolute top-2 left-2 z-10 bg-brand-accent text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ {t('featured')}</div>
            )}
            {p.imagen_url ? (
              <Image src={p.imagen_url} alt={p.titulo} width={300} height={300} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl"></div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{p.titulo}</h3>
            <p className="text-lg font-black text-brand-primary mt-1">${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd || 0))}</p>
            <p className="text-xs text-gray-500">{p.estado} · {p.subcategoria}</p>
          </div>
        </LocalLink>
      ))}
    </div>
  )
}

export default async function LandingCategoria({ ciudadSlug, ciudadNombre, categoriaSlug, categoriaNombre }: Props) {
  const t = await getTranslations('catLanding')
  const productos = await getProductos(ciudadNombre, categoriaSlug)

  // Categorias relacionadas para la ciudad
  const categoriasRelacionadas = Object.entries(CATEGORIA_MAP)
    .filter(([k]) => k !== categoriaSlug)
    .map(([k, v]) => ({ slug: k, nombre: CATEGORIA_NAMES[k] || k }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 flex-wrap">
        <LocalLink href="/" className="hover:text-brand-primary">{t('breadcrumb')}</LocalLink>
        <ChevronRight size={14} />
        <LocalLink href={`/${ciudadSlug}`} className="hover:text-brand-primary">{ciudadNombre}</LocalLink>
        <ChevronRight size={14} />
        <span className="text-gray-800 font-medium">{categoriaNombre}</span>
      </nav>

      <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
        {categoriaNombre} en {ciudadNombre}
      </h1>
      <p className="text-gray-500 mb-6">
        {t('desc', { category: categoriaNombre.toLowerCase(), city: ciudadNombre })}
      </p>

      {/* Categorias en esta ciudad */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categoriasRelacionadas.map((cat) => (
          <LocalLink key={cat.slug} href={`/${ciudadSlug}/${cat.slug}`} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-brand-primary hover:text-white transition">
            {t('title', { category: cat.nombre, city: ciudadNombre })}
          </LocalLink>
        ))}
      </div>

      <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => (<div key={i} className="bg-gray-100 rounded-xl aspect-square animate-pulse"></div>))}</div>}>
        <ProductosGrid productos={productos} categoriaNombre={categoriaNombre} ciudadNombre={ciudadNombre} t={t} />
      </Suspense>
    </div>
  )
}
