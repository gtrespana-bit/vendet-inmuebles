'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, RotateCcw, ChevronDown } from 'lucide-react'
import { CATALOG_AMENITIES, EXTRA_FILTER_KEYS } from '@/lib/catalog-extra-filters'

const propertyTypes = [
  'casas', 'apartamentos', 'townhouses', 'terrenos', 'locales', 'oficinas', 'edificios', 'habitaciones', 'fincas', 'galpones',
]

interface CatalogFiltersProps {
  categoria: string
  operacionTipo?: string
  precioMin: string
  precioMax: string
  ubicacionEstado: string
  ubicacionCiudad: string
  t: (key: string, vars?: Record<string, string | number>) => string
}

export const CatalogFilters = ({
  categoria,
  operacionTipo = '',
  precioMin,
  precioMax,
  ubicacionEstado,
  ubicacionCiudad,
  t,
}: CatalogFiltersProps) => {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [minPrice, setMinPrice] = useState(precioMin)
  const [maxPrice, setMaxPrice] = useState(precioMax)
  const [areaMin, setAreaMin] = useState(searchParams.get('areaMin') || '')
  const [areaMax, setAreaMax] = useState(searchParams.get('areaMax') || '')
  const selectedAmenities = (searchParams.get('amenidades') || '').split(',').filter(Boolean)
  const hasExtraFilters = EXTRA_FILTER_KEYS.some((key) => Boolean(searchParams.get(key)))
  const hasAdvancedFilters = ['areaMin', 'areaMax', 'condicion', 'amenidades'].some((key) => Boolean(searchParams.get(key)))
  const [moreOpen, setMoreOpen] = useState(hasAdvancedFilters)

  useEffect(() => setMinPrice(precioMin), [precioMin])
  useEffect(() => setMaxPrice(precioMax), [precioMax])
  useEffect(() => { setAreaMin(searchParams.get('areaMin') || ''); setAreaMax(searchParams.get('areaMax') || '') }, [searchParams])
  useEffect(() => { if (hasAdvancedFilters) setMoreOpen(true) }, [hasAdvancedFilters])

  const hasAnyFilter = Boolean(categoria || operacionTipo || precioMin || precioMax || ubicacionEstado || ubicacionCiudad || hasExtraFilters || searchParams.get('q'))

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('pagina')
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  const applyPriceFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('pagina')
    if (minPrice) params.set('precioMin', minPrice)
    else params.delete('precioMin')
    if (maxPrice) params.set('precioMax', maxPrice)
    else params.delete('precioMax')
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    setMinPrice('')
    setMaxPrice('')
    setAreaMin('')
    setAreaMax('')
    router.push(pathname)
  }

  return (
    <section className="catalog-filter-panel" aria-labelledby="catalog-filter-heading">
      <div className="catalog-filter-panel__heading">
        <div>
          <p>01 / {t('catalog.filters')}</p>
          <h2 id="catalog-filter-heading">{t('catalog.filters')}</h2>
        </div>
        {hasAnyFilter && (
          <button type="button" onClick={clearFilters} aria-label={t('catalog.clearFilters')} title={t('catalog.clearFilters')}>
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="catalog-filter-panel__group">
        <label htmlFor="filter-operation">{t('catalog.operation')}</label>
        <select id="filter-operation" value={operacionTipo} onChange={(event) => setParam('operacion', event.target.value)}>
          <option value="">{t('catalog.allOperations')}</option>
          <option value="Venta">{t('catalog.sale')}</option>
          <option value="Alquiler">{t('catalog.rent')}</option>
        </select>
      </div>

      <div className="catalog-filter-panel__group">
        <label htmlFor="filter-property-type">{t('catalog.propertyType')}</label>
        <select id="filter-property-type" value={categoria} onChange={(event) => setParam('categoria', event.target.value)}>
          <option value="">{t('catalog.allTypes')}</option>
          {propertyTypes.map((type) => (
            <option key={type} value={type}>{t(`catalog.types.${type}`)}</option>
          ))}
        </select>
      </div>

      <fieldset className="catalog-filter-panel__price">
        <legend>{t('catalog.priceUsd')}</legend>
        <div>
          <label htmlFor="filter-min-price">{t('catalog.minPrice')}</label>
          <input id="filter-min-price" type="number" min="0" inputMode="numeric" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="0" />
        </div>
        <div>
          <label htmlFor="filter-max-price">{t('catalog.maxPrice')}</label>
          <input id="filter-max-price" type="number" min="0" inputMode="numeric" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="—" />
        </div>
        <button type="button" onClick={applyPriceFilters}>
          {t('catalog.applyFilters')} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </fieldset>

      {(['habitaciones', 'banos', 'estacionamientos'] as const).map((key) => (
        <div className="catalog-filter-panel__group" key={key}>
          <label htmlFor={`filter-${key}`}>{t(`catalog.extra.${key}`)}</label>
          <select id={`filter-${key}`} value={searchParams.get(key) || ''} onChange={(event) => setParam(key, event.target.value)}>
            <option value="">{t('catalog.extra.any')}</option>
            {[1, 2, 3, 4, 5].map((n) => <option value={n} key={n}>{n}+</option>)}
          </select>
        </div>
      ))}

      <div className="catalog-filter-panel__more">
        <button type="button" className="catalog-filter-panel__more-toggle" aria-expanded={moreOpen} aria-controls="catalog-advanced-filters" onClick={() => setMoreOpen(!moreOpen)}>
          {t('catalog.extra.more')} <ChevronDown size={17} className={moreOpen ? 'rotate-180' : ''} aria-hidden="true" />
        </button>
        <div id="catalog-advanced-filters" hidden={!moreOpen}>
          <fieldset className="catalog-filter-panel__price">
            <legend>{t('catalog.extra.area')}</legend>
            <div><label htmlFor="filter-min-area">{t('catalog.min')}</label><input id="filter-min-area" type="number" min="0" value={areaMin} onChange={(e) => setAreaMin(e.target.value)} placeholder="0" /></div>
            <div><label htmlFor="filter-max-area">{t('catalog.max')}</label><input id="filter-max-area" type="number" min="0" value={areaMax} onChange={(e) => setAreaMax(e.target.value)} placeholder="—" /></div>
            <button type="button" onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.delete('pagina')
              for (const [key, value] of [['areaMin', areaMin], ['areaMax', areaMax]]) {
                if (value && Number(value) >= 0) params.set(key, value); else params.delete(key)
              }
              router.push(`${pathname}?${params.toString()}`)
            }}>{t('catalog.applyFilters')} <ArrowRight size={15} aria-hidden="true" /></button>
          </fieldset>
          <div className="catalog-filter-panel__group">
            <label htmlFor="filter-condition">{t('catalog.extra.condition')}</label>
            <select id="filter-condition" value={searchParams.get('condicion') || ''} onChange={(e) => setParam('condicion', e.target.value)}>
              <option value="">{t('catalog.extra.any')}</option>
              <option value="Nuevo">{t('catalog.extra.new')}</option>
              <option value="Usado - buen estado">{t('catalog.extra.good')}</option>
              <option value="Para remodelar">{t('catalog.extra.renovate')}</option>
            </select>
          </div>
          <fieldset className="catalog-filter-panel__amenities">
            <legend>{t('catalog.extra.amenities')}</legend>
            <p>{t('catalog.extra.amenitiesHint')}</p>
            {CATALOG_AMENITIES.map((item) => (
              <label key={item.key}>
                <input type="checkbox" checked={selectedAmenities.includes(item.key)} onChange={(e) => {
                  const values = e.target.checked ? [...selectedAmenities, item.key] : selectedAmenities.filter((v) => v !== item.key)
                  setParam('amenidades', values.join(','))
                }} />
                <span>{t(`catalog.extra.amenity.${item.key}`)}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>
    </section>
  )
}
