'use client'

import { FormEvent, useState } from 'react'
import { ChevronDown, MapPin, Search } from 'lucide-react'
import { ESTADOS } from '@/lib/ubicaciones'
import { useTranslations } from 'next-intl'

interface PropertySearchProps {
  locale: string
}

const propertyTypes = [
  { value: 'casas', key: 'house' },
  { value: 'apartamentos', key: 'apartment' },
  { value: 'terrenos', key: 'land' },
  { value: 'locales', key: 'commercial' },
  { value: 'oficinas', key: 'office' },
  { value: 'galpones', key: 'warehouse' },
]

const suggestedCities = [
  'Caracas',
  'Maracaibo',
  'Valencia',
  'Barquisimeto',
  'Maracay',
  'Mérida',
  'Lechería',
  'San Cristóbal',
  'Maturín',
  'Porlamar',
]

export default function PropertySearch({ locale }: PropertySearchProps) {
  const t = useTranslations('landing')
  const [operation, setOperation] = useState<'Venta' | 'Alquiler'>('Venta')
  const action = locale === 'es' ? '/catalogo' : `/${locale}/catalogo`

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget
    const city = new FormData(form).get('ciudad')?.toString().trim()
    const state = new FormData(form).get('estado')?.toString()

    // A city is the more specific location. Avoid sending both exact-match filters.
    if (city && state) {
      const stateSelect = form.elements.namedItem('estado')
      if (stateSelect instanceof HTMLSelectElement) stateSelect.value = ''
    }
  }

  return (
    <form action={action} method="get" onSubmit={handleSubmit} className="property-search">
      <div className="property-search__top">
        <div>
          <p className="property-search__eyebrow">{t('searchEyebrow')}</p>
          <div className="property-search__tabs" role="group" aria-label={t('searchOperationLabel')}>
            <button
              type="button"
              className={operation === 'Venta' ? 'property-search__tab is-active' : 'property-search__tab'}
              aria-pressed={operation === 'Venta'}
              onClick={() => setOperation('Venta')}
            >
              {t('searchBuy')}
            </button>
            <button
              type="button"
              className={operation === 'Alquiler' ? 'property-search__tab is-active' : 'property-search__tab'}
              aria-pressed={operation === 'Alquiler'}
              onClick={() => setOperation('Alquiler')}
            >
              {t('searchRent')}
            </button>
          </div>
        </div>
        <p className="property-search__note">{t('searchHint')}</p>
      </div>

      <input type="hidden" name="operacion" value={operation} />

      <div className="property-search__fields">
        <label className="property-search__field property-search__field--city">
          <span className="property-search__label">{t('searchCityLabel')}</span>
          <span className="property-search__control">
            <MapPin size={18} aria-hidden="true" />
            <input
              type="text"
              name="ciudad"
              list="venezuela-property-cities"
              placeholder={t('searchCityPlaceholder')}
              autoComplete="off"
              aria-label={t('searchCityLabel')}
            />
          </span>
          <datalist id="venezuela-property-cities">
            {suggestedCities.map((city) => <option key={city} value={city} />)}
          </datalist>
        </label>

        <label className="property-search__field">
          <span className="property-search__label">{t('searchStateLabel')}</span>
          <span className="property-search__control">
            <select name="estado" defaultValue="" aria-label={t('searchStateLabel')}>
              <option value="">{t('searchAllStates')}</option>
              {ESTADOS.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>

        <label className="property-search__field">
          <span className="property-search__label">{t('searchTypeLabel')}</span>
          <span className="property-search__control">
            <select name="categoria" defaultValue="" aria-label={t('searchTypeLabel')}>
              <option value="">{t('searchAnyType')}</option>
              {propertyTypes.map(({ value, key }) => (
                <option key={value} value={value}>{t(`type${key[0].toUpperCase()}${key.slice(1)}`)}</option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </label>

        <button type="submit" className="property-search__submit">
          <Search size={18} aria-hidden="true" />
          <span>{t('searchSubmit')}</span>
        </button>
      </div>
    </form>
  )
}
