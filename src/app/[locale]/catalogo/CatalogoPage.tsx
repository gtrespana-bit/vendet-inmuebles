'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import { Search, ChevronRight, Map as MapIcon, LayoutList, ArrowUpDown } from 'lucide-react'
import { categoriasData } from '@/lib/categorias'
import UbicacionSelector from '@/components/UbicacionSelector'
import { Pagination } from '@/components/Pagination'
import { OptimizedProductGrid } from '@/components/OptimizedProductGrid'
import { CatalogFilters } from '@/components/CatalogFilters'
import { useProductLoader } from '@/hooks/useProductLoader'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import SaveSearchButton from '@/components/SaveSearchButton'
import { normalizeCatalogSort, sortCatalogProperties, type CatalogSortKey } from '@/lib/catalog-sort'
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
  const isEnglish = pathname === '/en' || pathname.startsWith('/en/')

  const currentPage = Math.max(1, Number.parseInt(searchParams.get('pagina') || '1', 10) || 1)
  const itemsPerPage = 24

  const categoria = searchParams.get('categoria') || ''
  const subcategoria = searchParams.get('subcategoria') || ''
  const marca = searchParams.get('marca') || ''
  const q = searchParams.get('q') || ''
  const zona = searchParams.get('zona') || ''
  const ordenRaw = searchParams.get('orden') || ''
  const sortKey: CatalogSortKey = normalizeCatalogSort(ordenRaw)
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

  const hasSearchOrFilter = Boolean(
    categoria ||
      subcategoria ||
      marca ||
      q ||
      zona ||
      precioMin ||
      precioMax ||
      ubicacionEstado ||
      ubicacionCiudad ||
      operacion ||
      habitaciones ||
      banos ||
      estacionamientos ||
      areaMin ||
      areaMax ||
      condicion ||
      amenidades
  )
  const needsCustomServerFetch = hasSearchOrFilter || (sortKey !== 'relevancia' && initialCount > initialProducts.length)

  const {
    productos: loadedProductos,
    loading,
    error: loaderError,
    totalCount: loaderTotalCount,
    loadProducts,
  } = useProductLoader()

  const sortedInitialProducts = useMemo(
    () => sortCatalogProperties(initialProducts, sortKey),
    [initialProducts, sortKey]
  )

  const productosToUse = needsCustomServerFetch
    ? loading && loadedProductos.length === 0 && sortedInitialProducts.length > 0
      ? sortedInitialProducts
      : loadedProductos
    : sortedInitialProducts

  const totalCountToUse = needsCustomServerFetch ? loaderTotalCount : initialCount

  const startIndex = (currentPage - 1) * itemsPerPage
  const productosPagina = productosToUse.slice(startIndex, startIndex + itemsPerPage)
  const totalPages = Math.ceil(productosToUse.length / itemsPerPage)

  const isFirstRender = useRef(true)
  const cat = categoriasData[categoria]

  const mapHref = (() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    params.delete('pagina')
    const query = params.toString()
    return `/mapa${query ? `?${query}` : ''}`
  })()

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      if (!needsCustomServerFetch) {
        return
      }
    }

    if (needsCustomServerFetch) {
      loadProducts({
        categoria,
        subcategoria,
        marca,
        q,
        zona,
        orden: sortKey,
        precioMin,
        precioMax,
        ubicacionEstado,
        ubicacionCiudad,
        operacionTipo: operacion,
        habitaciones,
        banos,
        estacionamientos,
        areaMin,
        areaMax,
        condicion,
        amenidades,
      })
    }
  }, [
    categoria,
    subcategoria,
    marca,
    q,
    zona,
    sortKey,
    precioMin,
    precioMax,
    ubicacionEstado,
    ubicacionCiudad,
    needsCustomServerFetch,
    loadProducts,
    operacion,
    habitaciones,
    banos,
    estacionamientos,
    areaMin,
    areaMax,
    condicion,
    amenidades,
  ])

  const tituloMostrar = q
    ? t('catalog.resultsFor', { q })
    : zona
      ? `${isEnglish ? 'Properties in' : 'Inmuebles en'} ${zona}`
      : subcategoria
        ? t('catalog.subcategories.' + subcategoria)
        : cat
          ? t('catalog.categories.' + categoria)
          : t('catalog.allProducts')

  const breadcrumbs = [
    { label: t('catalog.breadcrumb'), href: '/' },
    { label: t('catalog.title'), href: '/catalogo' },
  ]

  if (categoria && cat) {
    breadcrumbs.push({
      label: `${cat.icon} ${t('catalog.categories.' + categoria)}`,
      href: `/catalogo?categoria=${categoria}`,
    })
  }

  if (zona) {
    breadcrumbs.push({
      label: zona,
      href: '',
    })
  } else if (subcategoria) {
    breadcrumbs.push({
      label: t('catalog.subcategories.' + subcategoria),
      href: '',
    })
  }

  if (q) {
    breadcrumbs.push({
      label: `${t('catalog.searchLabel')}: "${q}"`,
      href: '',
    })
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label.replace(/^[^ ]+ /, ''),
      item: item.href ? `https://venezuela-inmuebles.online${item.href}` : undefined,
    })),
  }

  const sortOptions: Array<{ value: CatalogSortKey; label: string }> = [
    { value: 'relevancia', label: t('catalog.sortRelevance') },
    { value: 'recientes', label: t('catalog.sortNewest') },
    { value: 'precio_asc', label: t('catalog.sortPriceAsc') },
    { value: 'precio_desc', label: t('catalog.sortPriceDesc') },
    { value: 'precio_m2_asc', label: t('catalog.sortPricePerM2Asc') },
    { value: 'area_desc', label: t('catalog.sortAreaDesc') },
  ]

  const updateSingleParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('pagina')
    if (value) params.set(key, value)
    else params.delete(key)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }}
      />
      <div className="catalog-page home-shell py-8">
        <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight size={14} className="text-gray-400" />}
              {item.href ? (
                <LocalLink href={item.href} className="hover:text-brand-primary transition">
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
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                <div>
                  <p className="catalog-overline">{t('catalog.breadcrumb')}</p>
                  <h1>{tituloMostrar}</h1>
                  <p className="catalog-result-count">
                    {loading ? t('common.loading') : t('catalog.results', { count: totalCountToUse || 0 })}
                  </p>
                </div>
                <div className="catalog-head-tools">
                  <SaveSearchButton />

                  <div className="catalog-sort">
                    <label htmlFor="catalog-sort-select" className="sr-only">
                      {t('catalog.sort')}
                    </label>
                    <ArrowUpDown size={13} aria-hidden="true" />
                    <select
                      id="catalog-sort-select"
                      value={sortKey}
                      onChange={(e) =>
                        updateSingleParam('orden', e.target.value === 'relevancia' ? '' : e.target.value)
                      }
                      aria-label={t('catalog.sort')}
                    >
                      {sortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

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

                  <form
                    action={isEnglish ? '/en/catalogo' : '/catalogo'}
                    method="GET"
                    className="catalog-search"
                  >
                    {Array.from(searchParams.entries())
                      .filter(([key]) => key !== 'q' && key !== 'pagina')
                      .map(([key, value], index) => (
                        <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
                      ))}
                    <input
                      name="q"
                      defaultValue={q}
                      placeholder={
                        isEnglish
                          ? 'Search zone, city or keyword…'
                          : 'Urbanización, ciudad o palabra clave…'
                      }
                      aria-label={t('common.search')}
                    />
                    <button type="submit" aria-label={t('common.search')}>
                      <Search size={17} />
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {(categoria ||
              ubicacionEstado ||
              zona ||
              precioMin ||
              precioMax ||
              habitaciones ||
              banos ||
              estacionamientos ||
              areaMin ||
              areaMax ||
              condicion ||
              amenidades) && (
              <p className="text-xs text-gray-600 mb-3">{t('catalog.extra.mapFilterNote')}</p>
            )}

            <div className="mb-4">
              <UbicacionSelector
                estado={ubicacionEstado}
                ciudad={ubicacionCiudad}
                zona={zona}
                onChange={(estado, ciudad) => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.delete('pagina')
                  if (estado) params.set('estado', estado)
                  else params.delete('estado')
                  if (ciudad) params.set('ciudad', ciudad)
                  else params.delete('ciudad')
                  if (!estado && !ciudad) params.delete('zona')
                  const qs = params.toString()
                  router.push(qs ? `${pathname}?${qs}` : pathname)
                }}
                onZonaChange={(nuevaZona) => updateSingleParam('zona', nuevaZona)}
              />
            </div>

            {loading ? (
              <LoadingIndicator count={6} />
            ) : needsCustomServerFetch && loaderError ? (
              <div className="catalog-empty" role="alert">
                {t('catalog.extra.loadError')}
              </div>
            ) : productosToUse.length === 0 ? (
              <div className="catalog-empty">
                <Search size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">{t('catalog.empty')}</h3>
                <p className="text-gray-500 mb-4">{t('catalog.emptyCta')}</p>
                <LocalLink
                  href="/publicar-inmueble"
                  className="inline-block bg-brand-accent text-[var(--on-gold)] px-6 py-3 rounded-lg font-bold hover:bg-accent/90 transition"
                >
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
