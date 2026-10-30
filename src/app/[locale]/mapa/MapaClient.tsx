'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { LayoutList, Search } from 'lucide-react'
import CatalogMapView from '../catalogo/CatalogMapView'
import { toMapProperty } from '../catalogo/CatalogMapView'
import type { MapProperty } from '@/components/map/PropertyMap'
import { demoMapProperties } from '@/lib/demo/demo-listings'
import type { MapPageRecord } from './page'

type MapaClientProps = {
  products: MapPageRecord[]
  locale: string
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function MapaClient({ products, locale }: MapaClientProps) {
  const t = useTranslations('map')
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [operacion, setOperacion] = useState(searchParams.get('operacion') || '')
  const [ciudad, setCiudad] = useState(searchParams.get('ciudad') || '')
  const [q, setQ] = useState(searchParams.get('q') || '')

  // Si se llega desde un enlace externo (cabecera, catálogo…) con otros parámetros,
  // sincronizamos el estado local con la URL.
  const searchKey = searchParams.toString()
  useEffect(() => {
    setOperacion(searchParams.get('operacion') || '')
    setCiudad(searchParams.get('ciudad') || '')
    setQ(searchParams.get('q') || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey])

  // El filtrado es local: la URL se actualiza sin volver a pedir la página al servidor.
  const setParam = (key: 'operacion' | 'ciudad' | 'q', value: string) => {
    if (key === 'operacion') setOperacion(value)
    if (key === 'ciudad') setCiudad(value)
    if (key === 'q') setQ(value)

    const params = new URLSearchParams(window.location.search)
    if (value) params.set(key, value)
    else params.delete(key)
    const query = params.toString()
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}`)
  }

  const isDemo = products.length === 0
  const source = useMemo<MapProperty[]>(() => {
    if (isDemo) return demoMapProperties(locale)
    return products
      .map((product) => toMapProperty(product, locale))
      .filter((item): item is MapProperty => Boolean(item))
  }, [isDemo, products, locale])

  const cities = useMemo(() => {
    const unique = new Map<string, string>()
    products.forEach((product) => {
      if (!product.ciudad) return
      const key = normalize(product.ciudad)
      if (!unique.has(key)) unique.set(key, product.ciudad)
    })
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, 'es'))
  }, [products])

  const wantedCities = useMemo(() => {
    const set = new Set<string>()
    // Permite enlaces con varias ciudades separadas por coma
    ciudad.split(',').filter(Boolean).forEach((value) => set.add(normalize(value)))
    return set
  }, [ciudad])

  const filtered = useMemo(() => {
    const needle = normalize(q)
    return source.filter((item) => {
      if (operacion) {
        const op = normalize(item.operation || '')
        if (normalize(operacion) === 'venta' && !op.includes('venta') && !op.includes('sale')) return false
        if (normalize(operacion) === 'alquiler' && !op.includes('alquiler') && !op.includes('rent')) return false
      }
      if (wantedCities.size > 0) {
        const location = normalize(item.location || '')
        if (!Array.from(wantedCities).some((city) => location.includes(city))) return false
      }
      if (needle) {
        const haystack = normalize(`${item.title} ${item.location || ''}`)
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [source, operacion, wantedCities, q])

  const listHref = (() => {
    const params = new URLSearchParams()
    if (operacion) params.set('operacion', operacion)
    if (ciudad) params.set('ciudad', ciudad)
    if (q) params.set('q', q)
    const query = params.toString()
    return `${locale === 'en' ? '/en' : ''}/catalogo${query ? `?${query}` : ''}`
  })()

  const labels = {
    approximate: t('approximate'),
    exact: t('exact'),
    viewListing: t('viewListing'),
    bedrooms: t('bedrooms'),
    bathrooms: t('bathrooms'),
    area: t('area'),
    empty: t('empty'),
    zoomIn: t('zoomIn'),
    zoomOut: t('zoomOut'),
    resetView: t('resetView'),
    resultsInMap: (count: number) => t('resultsInMap', { count }),
    searchArea: t('searchArea'),
    searchAreaHint: t('searchAreaHint'),
    clearArea: t('clearArea'),
    areaActive: (count: number) => t('areaActive', { count }),
    sampleData: t('sampleData'),
    noResultsInArea: t('noResultsInArea'),
  }

  const fitKey = [operacion, ciudad, q, filtered.length].join('|')

  return (
    <div className="map-page home-shell">
      <header className="map-page__head">
        <div>
          <p className="map-page__eyebrow">{t('eyebrow')}</p>
          <h1 className="map-page__title">{t('title')}</h1>
          <p className="map-page__subtitle">{t('subtitle')}</p>
        </div>
        <Link href={listHref} className="map-page__switch">
          <LayoutList size={16} aria-hidden="true" />
          {t('viewList')}
        </Link>
      </header>

      <div className="map-page__bar">
        <div className="map-page__chips" role="group" aria-label={t('operation')}>
          {[
            { value: '', label: t('allOperations') },
            { value: 'Venta', label: t('sale') },
            { value: 'Alquiler', label: t('rent') },
          ].map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              className={`map-page__chip ${operacion === option.value ? 'is-active' : ''}`}
              aria-pressed={operacion === option.value}
              onClick={() => setParam('operacion', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="map-page__field">
          <span>{t('city')}</span>
          <select value={ciudad} onChange={(event) => setParam('ciudad', event.target.value)}>
            <option value="">{t('allCities')}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <form
          className="map-page__search"
          onSubmit={(event) => {
            event.preventDefault()
            const value = new FormData(event.currentTarget).get('q')
            setParam('q', String(value || ''))
          }}
        >
          <Search size={15} aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder={t('searchPlaceholder')} aria-label={t('search')} />
          <button type="submit">{t('search')}</button>
        </form>
      </div>

      <CatalogMapView items={filtered} locale={locale} labels={labels} demo={isDemo} fitKey={fitKey} />
    </div>
  )
}
