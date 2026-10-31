'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import { Search, ChevronRight, Map as MapIcon, LayoutList } from 'lucide-react'
import { categoriasData } from '@/lib/categorias'
import UbicacionSelector from '@/components/UbicacionSelector'
import { Pagination } from '@/components/Pagination'
import { OptimizedProductGrid } from '@/components/OptimizedProductGrid'
import { CatalogFilters } from '@/components/CatalogFilters'
import { useProductLoader } from '@/hooks/useProductLoader'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import type { CatalogPropertyRecord } from '@/types/property'

interface CatalogoPageProps {
  initialProducts?: CatalogPropertyRecord[]
  initialCount?: number
}

export default function CatalogoClient({ initialProducts = [], initialCount = 0 }: CatalogoPageProps) {
  const tc = useTranslations('catalog')
  const tp = useTranslations('product')
  const tcm = useTranslations('common')
  const tm = useTranslations('map')
  // Universal translator function (supports any namespace with variables)
  const t = (key: string, vars?: Record<string, string | number>) => {
    const parts = key.split('.')
    const ns = parts[0]
    const rest = parts.slice(1).join('.')
    if (ns === 'catalog') return tc(rest, vars as any)
    if (ns === 'product') return tp(rest, vars as any)
    if (ns === 'common') return tcm(rest, vars as any)
    if (ns === 'map') return tm(rest, vars as any)
    return key
  }
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  // Usar hook de paginación
  const currentPage = Math.max(1, Number.parseInt(searchParams.get('pagina') || '1', 10) || 1)
  const itemsPerPage = 24

  const categoria = searchParams.get('categoria') || ''
  const subcategoria = searchParams.get('subcategoria') || ''
  const marca = searchParams.get('marca') || ''
  const q = searchParams.get('q') || ''
  const precioMin = searchParams.get('precioMin') || ''
  const precioMax = searchParams.get('precioMax') || ''
  const ubicacionEstado = searchParams.get('estado') || ''
  const ubicacionCiudad = searchParams.get('ciudad') || ''

  const operacion = searchParams.get('operacion') || ''
  const habitaciones = searchParams.get('habitaciones') || ''
  const banos = searchParams.get('banos') || ''
  const estacionamientos = searchParams.get('estacionamientos') || ''
  const areaMin = searchParams.get('areaMin') || ''
  const areaMax = searchParams.get('areaMax') || ''
  const condicion = searchParams.get('condicion') || ''
  const amenidades = searchParams.get('amenidades') || ''
  const hasActiveFilters = !!(categoria || subcategoria || marca || q || precioMin || precioMax || ubicacionEstado || ubicacionCiudad || operacion || habitaciones || banos || estacionamientos || areaMin || areaMax || condicion || amenidades)

  // Usar los hooks de carga y precarga de productos
  const { productos: loadedProductos, loading, error: loaderError, totalCount: loaderTotalCount, loadProducts } = useProductLoader();

  // Determinar qué productos usar
  // Durante loading con filtros, mantener productos iniciales para evitar parpadeo
  const productosToUse = hasActiveFilters
    ? (loading && loadedProductos.length === 0 && initialProducts.length > 0 ? initialProducts : loadedProductos)
    : initialProducts;
  const totalCountToUse = hasActiveFilters ? loaderTotalCount : initialCount;

  // Renderizar sólo la página actual para limitar imágenes y nodos en pantalla
  const startIndex = (currentPage - 1) * itemsPerPage
  const productosPagina = productosToUse.slice(startIndex, startIndex + itemsPerPage)
  const totalPages = Math.ceil(productosToUse.length / itemsPerPage)

  const isFirstRender = useRef(true)

  const cat = categoriasData[categoria]
  const subs = cat ? cat.subs : []
  const allMarcas = subs.flatMap(s => s.marcas || []).filter((v, i, a) => a.indexOf(v) === i).sort()

  const mapHref = (() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    const query = params.toString()
    return `/mapa${query ? `?${query}` : ''}`
  })()

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
        ubicacionCiudad,
        operacionTipo: operacion, habitaciones, banos, estacionamientos, areaMin, areaMax, condicion, amenidades
      });
    }
  }, [categoria, subcategoria, marca, q, precioMin, precioMax, ubicacionEstado, ubicacionCiudad, hasActiveFilters, loadProducts, operacion, habitaciones, banos, estacionamientos, areaMin, areaMax, condicion, amenidades]);

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
      item: item.href ? `https://venezuela-inmuebles.online${item.href}` : undefined
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="catalog-page home-shell py-8">
        <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
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

      <div className="catalog-layout">
        <aside className="catalog-sidebar">
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

        <div className="catalog-results">
          <div className="catalog-results-head">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="catalog-overline">{t('catalog.breadcrumb')}</p>
                <h1>{tituloMostrar}</h1>
                <p className="catalog-result-count">
                  {loading ? t('common.loading') : t('catalog.results', { count: totalCountToUse || 0 })}
                </p>
              </div>
              <div className="catalog-head-tools">
                <div className="catalog-view-toggle" role="group" aria-label={tm('viewMap')}>
                  <span className="is-active" aria-current="true">
                    <LayoutList size={14} aria-hidden="true" />
                    {tm('viewList')}
                  </span>
                  <LocalLink href={mapHref}>
                    <MapIcon size={14} aria-hidden="true" />
                    {tm('viewMap')}
                  </LocalLink>
                </div>

                <form action={pathname.startsWith('/en') ? '/en/catalogo' : '/catalogo'} method="GET" className="catalog-search">
                  {Array.from(searchParams.entries()).filter(([key]) => key !== 'q' && key !== 'pagina').map(([key, value], index) => <input key={`${key}-${index}`} type="hidden" name={key} value={value} />)}
                  <input name="q" defaultValue={q} placeholder={`${t('common.search')}...`} aria-label={t('common.search')} />
                  <button type="submit" aria-label={t('common.search')}><Search size={17} /></button>
                </form>
              </div>
            </div>
          </div>

          {(categoria || ubicacionEstado || precioMin || precioMax || habitaciones || banos || estacionamientos || areaMin || areaMax || condicion || amenidades) && (
            <p className="text-xs text-gray-600 mb-3">{t('catalog.extra.mapFilterNote')}</p>
          )}

          <div className="mb-4">
            <UbicacionSelector
              estado={ubicacionEstado}
              ciudad={ubicacionCiudad}
              onChange={(estado, ciudad) => {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('pagina')
                if (estado) params.set('estado', estado); else params.delete('estado')
                if (ciudad) params.set('ciudad', ciudad); else params.delete('ciudad')
                router.push(`${pathname}?${params.toString()}`)
              }}
            />
          </div>

          {loading ? (
            <LoadingIndicator count={6} />
          ) : hasActiveFilters && loaderError ? (
            <div className="catalog-empty" role="alert">{t('catalog.extra.loadError')}</div>
          ) : productosToUse.length === 0 ? (
            <div className="catalog-empty">
              <Search size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t('catalog.empty')}</h3>
              <p className="text-gray-500 mb-4">{t('catalog.emptyCta')}</p>
              <LocalLink href="/publicar-inmueble" className="inline-block bg-brand-accent text-[var(--on-gold)] px-6 py-3 rounded-lg font-bold hover:bg-accent/90 transition">
                {t('catalog.publishFree')}
              </LocalLink>
            </div>
          ) : (
            <OptimizedProductGrid
              productos={productosPagina}
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