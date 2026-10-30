'use client'

import { useState } from 'react'
import { ESTADOS } from '@/lib/ubicaciones'
import type { LandingCopy } from './copy'
import styles from './landing.module.css'

const PROPERTY_TYPES = [
  { value: 'casas', es: 'Casas', en: 'Houses' },
  { value: 'apartamentos', es: 'Apartamentos', en: 'Apartments' },
  { value: 'terrenos', es: 'Terrenos', en: 'Land' },
  { value: 'locales', es: 'Locales', en: 'Retail' },
  { value: 'oficinas', es: 'Oficinas', en: 'Offices' },
  { value: 'galpones', es: 'Galpones', en: 'Warehouses' },
]

const CITIES = [
  'Caracas',
  'Maracaibo',
  'Valencia',
  'Barquisimeto',
  'Maracay',
  'Lechería',
  'Mérida',
  'Porlamar',
  'San Cristóbal',
  'Puerto Ordaz',
  'Barcelona',
  'Cumaná',
]

type Props = {
  copy: LandingCopy
  locale: string
}

export default function PortalSearch({ copy, locale }: Props) {
  const [operation, setOperation] = useState<'Venta' | 'Alquiler'>('Venta')
  const action = locale === 'es' ? '/catalogo' : `/${locale}/catalogo`
  const isEnglish = locale === 'en'

  return (
    <form
      action={action}
      method="get"
      className={styles.search}
      onSubmit={(event) => {
        const form = event.currentTarget
        const city = new FormData(form).get('ciudad')?.toString().trim()
        if (!city) return
        const stateSelect = form.elements.namedItem('estado')
        if (stateSelect instanceof HTMLSelectElement) stateSelect.value = ''
      }}
    >
      <div className={styles.searchTop}>
        <span className={styles.searchEyebrow}>{copy.search.eyebrow}</span>
        <div className={styles.searchTabs} role="group" aria-label={copy.search.operationLabel}>
          <button
            type="button"
            className={`${styles.searchTab} ${operation === 'Venta' ? styles.searchTabActive : ''}`}
            aria-pressed={operation === 'Venta'}
            onClick={() => setOperation('Venta')}
          >
            {copy.search.buy}
          </button>
          <button
            type="button"
            className={`${styles.searchTab} ${operation === 'Alquiler' ? styles.searchTabActive : ''}`}
            aria-pressed={operation === 'Alquiler'}
            onClick={() => setOperation('Alquiler')}
          >
            {copy.search.rent}
          </button>
        </div>
      </div>

      <input type="hidden" name="operacion" value={operation} />

      <div className={styles.searchGrid}>
        <label className={styles.searchField}>
          <span className={styles.searchLabel}>{copy.search.city}</span>
          <input
            type="text"
            name="ciudad"
            list="landing-search-cities"
            placeholder={copy.search.cityPlaceholder}
            autoComplete="off"
            className={styles.searchInput}
          />
          <datalist id="landing-search-cities">
            {CITIES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>

        <label className={styles.searchField}>
          <span className={styles.searchLabel}>{copy.search.state}</span>
          <select name="estado" defaultValue="" className={styles.searchSelect}>
            <option value="">{copy.search.allStates}</option>
            {ESTADOS.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.searchField}>
          <span className={styles.searchLabel}>{copy.search.type}</span>
          <select name="categoria" defaultValue="" className={styles.searchSelect}>
            <option value="">{copy.search.anyType}</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {isEnglish ? type.en : type.es}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.searchField}>
          <span className={styles.searchLabel}>{copy.search.price}</span>
          <input
            type="number"
            name="precioMax"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder={copy.search.pricePlaceholder}
            className={styles.searchInput}
          />
        </label>
      </div>

      <div className={styles.searchFoot}>
        <button type="submit" className={styles.searchSubmit}>
          {copy.search.submit}
          <span aria-hidden="true">→</span>
        </button>
        <span className={styles.searchCoords}>{copy.search.coords}</span>
      </div>
    </form>
  )
}
