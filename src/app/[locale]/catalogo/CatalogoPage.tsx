'use client'

import { useEffect, useState, useRef, memo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { Search, ChevronRight, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { categoriasData } from '@/lib/categorias'
import UbicacionSelector from '@/components/UbicacionSelector'
import { Pagination } from '@/components/Pagination'
import { OptimizedProductGrid } from '@/components/OptimizedProductGrid'
import { CatalogFilters } from '@/components/CatalogFilters'
import { useProductPagination } from '@/hooks/useProductPagination'
import { useProductLoader } from '@/hooks/useProductLoader'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import { usePrefetch } from '@/hooks/usePrefetch'

type Producto = {
  id: string
  titulo: string
  precio_usd: number
  estado: string
  imagen_url: string | null
  ubicacion_ciudad: string | null
  ubicacion_estado: string | null
  creado_en: string
  subcategoria: string | null
  boosteado_en: string | null
  destacado: boolean
  destacado_hasta: string | null
  vendedor_verificado: boolean | null
}

interface CatalogoPageProps {
  initialProducts?: Producto[]
  initialCount?: number
}

const PLACEHOLDER_IMAGES = [
  '/placeholder-product.webp',
]

const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAADAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

function getPlaceholderImage(titulo: string) {
  return PLACEHOLDER_IMAGES[Math.abs(titulo.charCodeAt(0)) % PLACEHOLDER_IMAGES.length]
}

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  )
}

const ProductCard = memo(({ p, priority = false, t }: { p: Producto; priority?: boolean; t: (key: string) => string }) => {
  const isBoosted = p.boosteado_en != null
  // Usar flag pre-computado del servidor para evitar hydration mismatch
  // Si no existe (datos frescos del cliente), calcular en el cliente
  const isFeatured = (p as any)._isFeatured !== undefined
    ? (p as any)._isFeatured
    : !!(p.destacado && p.destacado_hasta && new Date(p.destacado_hasta) > new Date())
  const isPromoted = isBoosted || isFeatured

  const imgUrl = p.imagen_url || getPlaceholderImage(p.titulo)

  return (
    <LocalLink href={`/inmueble/${p.id}`} className={`bg-white rounded-xl overflow-hidden transition-all duration-200 group block border ${isPromoted ? 'border-2 border-brand-accent shadow-md hover:shadow-xl hover:-translate-y-1' : 'border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-gray-200'}`}>
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-brand-accent text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            ⭐ {t('product.featured')}
          </div>
        )}
        {isBoosted && !isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-green-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            ⚡ <span className="text-white">Boost</span>
          </div>
        )}
        <Image
          src={imgUrl}
          alt={p.titulo}
          width={300}  // Reducir tamaño para optimización
          height={300}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          decoding="async"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          fetchPriority={priority ? 'high' : 'low'} // Cambiar a 'low' para no prioritarios
          onError={(e) => {
            // ✅ CORREGIDO: Previene loop infinito
            const target = e.target as HTMLImageElement
            if (!target.src.includes('/placeholder-product.webp')) {
              target.src = '/placeholder-product.webp'
            }
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">{p.titulo}</h3>
        <p className="text-xl font-black text-brand-primary mt-1">${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd || 0))}</p>
        {p.vendedor_verificado && (
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full mt-1">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {t('product.verified')}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">{p.ubicacion_ciudad || p.ubicacion_estado || 'Venezuela'}</p>
      </div>
    </LocalLink>
  )
})

ProductCard.displayName = 'ProductCard'

export default function CatalogoClient({ initialProducts = [], initialCount = 0 }: CatalogoPageProps) {
  const tc = useTranslations('catalog')
  const tp = useTranslations('product')
  const tcm = useTranslations('common')
  // Universal translator function (supports any namespace with variables)
  const t = (key: string, vars?: Record<string, string | number>) => {
    const parts = key.split('.')
    const ns = parts[0]
    const rest = parts.slice(1).join('.')
    if (ns === 'catalog') return tc(rest, vars as any)
    if (ns === 'product') return tp(rest, vars as any)
    if (ns === 'common') return tcm(rest, vars as any)
    return key
  }
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  // Usar hook de paginación
  const { currentPage, itemsPerPage } = useProductPagination({ itemsPerPage: 24 })

  const categoria = searchParams.get('categoria') || ''
  const subcategoria = searchParams.get('subcategoria') || ''
  const marca = searchParams.get('marca') || ''
  const q = searchParams.get('q') || ''
  const precioMin = searchParams.get('precioMin') || ''
  const precioMax = searchParams.get('precioMax') || ''
  const ubicacionEstado = searchParams.get('estado') || ''
  const ubicacionCiudad = searchParams.get('ciudad') || ''

  const operacion = searchParams.get('operacion') || ''
  const hasActiveFilters = !!(categoria || subcategoria || marca || q || precioMin || precioMax || ubicacionEstado || ubicacionCiudad || operacion)

  // Usar los hooks de carga y precarga de productos
  const { productos: loadedProductos, loading, error, totalCount: loaderTotalCount, loadProducts } = useProductLoader();
  const { prefetchPage } = usePrefetch();

  // Determinar qué productos usar
  // Durante loading con filtros, mantener productos iniciales para evitar parpadeo
  const productosToUse = hasActiveFilters
    ? (loading && loadedProductos.length === 0 && initialProducts.length > 0 ? initialProducts : loadedProductos)
    : initialProducts;
  const totalCountToUse = hasActiveFilters ? loaderTotalCount : initialCount;

  // Calcular productos para la página actual
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const productosPagina = productosToUse.slice(startIndex, endIndex)
  const totalPages = Math.ceil(productosToUse.length / itemsPerPage)

  const isFirstRender = useRef(true)

  const cat = categoriasData[categoria]
  const subs = cat ? cat.subs : []
  const allMarcas = subs.flatMap(s => s.marcas || []).filter((v, i, a) => a.indexOf(v) === i).sort()

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    if (key === 'categoria') params.delete('subcategoria')
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      if (!hasActiveFilters) {
        // Si no hay filtros activos, usar los productos iniciales
        return
      }
    }

    if (hasActiveFilters) {
      // Cargar productos con los filtros actuales solo si hay filtros activos
      loadProducts({
        categoria,
        subcategoria,
        marca,
        q,
        precioMin,
        precioMax,
        ubicacionEstado,
        ubicacionCiudad
        operacionTipo: operacion
      });
    }
  }, [categoria, subcategoria, marca, q, precioMin, precioMax, ubicacionEstado, ubicacionCiudad, hasActiveFilters, loadProducts]);

  // Precargar la siguiente página cuando sea apropiado
  useEffect(() => {
    if (!loading && productosToUse.length > 0 && totalPages > currentPage) {
      // Precargar la siguiente página después de un breve retraso
      const prefetchTimer = setTimeout(() => {
        prefetchPage(
          currentPage + 1,
          itemsPerPage,
          {
            categoria,
            subcategoria,
            marca,
            q,
            precioMin,
            precioMax,
            ubicacionEstado,
            ubicacionCiudad
          }
        );
      }, 2000); // Precargar después de 2 segundos para permitir la carga completa de la página actual

      return () => clearTimeout(prefetchTimer);
    }
  }, [currentPage, totalPages, loading, productosToUse.length, categoria, subcategoria, marca, q, precioMin, precioMax, ubicacionEstado, ubicacionCiudad, itemsPerPage, prefetchPage]);

  const tituloMostrar = q
    ? t('catalog.resultsFor', { q })
    : subcategoria
      ? t('catalog.subcategories.' + subcategoria)
      : cat
        ? t('catalog.categories.' + categoria)
        : t('catalog.allProducts')

  // Generar breadcrumbs jerárquicos con schema.org
  const breadcrumbs = [
    { label: t('catalog.breadcrumb'), href: '/' },
    { label: t('catalog.title'), href: '/catalogo' }
  ]
  
  if (categoria && cat) {
    breadcrumbs.push({ 
      label: `${cat.icon} ${t('catalog.categories.' + categoria)}`, 
      href: `/catalogo?categoria=${categoria}` 
    })
  }
  
  if (subcategoria) {
    breadcrumbs.push({ 
      label: t('catalog.subcategories.' + subcategoria), 
      href: '' // Página actual
    })
  }
  
  if (q) {
    breadcrumbs.push({ 
      label: `${t('catalog.searchLabel')}: "${q}"`, 
      href: '' // Página actual
    })
  }
  
  // Schema.org BreadcrumbList JSON-LD
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label.replace(/^[^ ]+ /, ''), // Remover emoji del nombre para schema
      item: item.href ? `https://vendet.online${item.href}` : undefined
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumbs visuales */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight size={14} className="text-gray-400" />}
              {item.href ? (
                <LocalLink 
                  href={item.href} 
                  className="hover:text-brand-primary transition"
                >
                  {item.label}
                </LocalLink>
              ) : (
                <span className="text-gray-900 font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 flex-shrink-0">
          <CatalogFilters
            categoria={categoria}
            operacionTipo={operacion}
            precioMin={precioMin}
            precioMax={precioMax}
            ubicacionEstado={ubicacionEstado}
            ubicacionCiudad={ubicacionCiudad}
            t={t}
          />
        </aside>

        <div className="flex-1">
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{tituloMostrar}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {loading ? t('common.loading') : t('catalog.results', { count: totalCountToUse || 0 })}
                </p>
              </div>
              <form action="/buscar" method="GET" className="flex gap-2 w-full sm:w-auto">
                <input name="q" defaultValue={q} placeholder={`${t('common.search')}...`} className="w-full sm:w-60 border rounded-lg px-4 py-2 text-sm" />
                <button type="submit" className="bg-brand-primary text-white px-4 rounded-lg font-bold text-sm hover:bg-brand-dark transition">{t('common.search')}</button>
              </form>
            </div>
          </div>

          <div className="mb-4">
            <UbicacionSelector
              estado={ubicacionEstado}
              ciudad={ubicacionCiudad}
              onChange={(estado, ciudad) => {
                const params = new URLSearchParams(searchParams.toString())
                if (estado) params.set('estado', estado); else params.delete('estado')
                if (ciudad) params.set('ciudad', ciudad); else params.delete('ciudad')
                router.push(`${pathname}?${params.toString()}`)
              }}
            />
          </div>

          {loading ? (
            <LoadingIndicator count={6} />
          ) : productosToUse.length === 0 ? (
            <div className="bg-white rounded-xl p-16 text-center shadow-sm border">
              <Search size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t('catalog.empty')}</h3>
              <p className="text-gray-500 mb-4">{t('catalog.emptyCta')}</p>
              <LocalLink href="/publicar" className="inline-block bg-brand-accent text-brand-primary px-6 py-3 rounded-lg font-bold hover:bg-accent/90 transition">
                {t('catalog.publishFree')}
              </LocalLink>
            </div>
          ) : (
            <OptimizedProductGrid
              productos={productosToUse}
              t={t}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
            />
          )}
        </div>
      </div>

      {/* Componente de paginación optimizado */}
      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={productosToUse.length} 
      />
    </div>
    </>
  )
}