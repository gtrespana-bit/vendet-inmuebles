'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, RotateCcw } from 'lucide-react'

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

  useEffect(() => setMinPrice(precioMin), [precioMin])
  useEffect(() => setMaxPrice(precioMax), [precioMax])

  const hasAnyFilter = Boolean(categoria || operacionTipo || precioMin || precioMax || ubicacionEstado || ubicacionCiudad)

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  const applyPriceFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (minPrice) params.set('precioMin', minPrice)
    else params.delete('precioMin')
    if (maxPrice) params.set('precioMax', maxPrice)
    else params.delete('precioMax')
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    setMinPrice('')
    setMaxPrice('')
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
    </section>
  )
}
