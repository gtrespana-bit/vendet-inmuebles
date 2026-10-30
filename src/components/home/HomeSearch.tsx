'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { ESTADOS } from '@/lib/ubicaciones'
import styles from './home.module.css'

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

const PRICE_STEPS = [50000, 100000, 150000, 250000, 500000, 1000000, 2000000]

export type HomeSearchLabels = {
  buy: string
  rent: string
  city: string
  cityPlaceholder: string
  state: string
  allStates: string
  type: string
  anyType: string
  price: string
  anyPrice: string
  submit: string
  hint: string
  quick: string
  quickLinks: { label: string; href: string }[]
}

export default function HomeSearch({
  locale,
  labels,
}: {
  locale: string
  labels: HomeSearchLabels
}) {
  const [operation, setOperation] = useState<'Venta' | 'Alquiler'>('Venta')
  const isEnglish = locale === 'en'
  const action = isEnglish ? '/en/catalogo' : '/catalogo'
  const money = new Intl.NumberFormat(isEnglish ? 'en-US' : 'es-VE', { maximumFractionDigits: 0 })

  return (
    <form
      action={action}
      method="get"
      className={styles.searchCard}
      onSubmit={(event) => {
        const form = event.currentTarget
        const city = new FormData(form).get('ciudad')?.toString().trim()
        if (!city) return
        // A city is more specific than a state: never send both exact filters.
        const stateField = form.elements.namedItem('estado')
        if (stateField instanceof HTMLSelectElement) stateField.value = ''
      }}
    >
      <div className={styles.searchTop}>
        <div className={styles.searchTabs} role="group" aria-label={labels.type}>
          <button
            type="button"
            className={`${styles.searchTab} ${operation === 'Venta' ? styles.searchTabActive : ''}`}
            aria-pressed={operation === 'Venta'}
            onClick={() => setOperation('Venta')}
          >
            {labels.buy}
          </button>
          <button
            type="button"
            className={`${styles.searchTab} ${operation === 'Alquiler' ? styles.searchTabActive : ''}`}
            aria-pressed={operation === 'Alquiler'}
            onClick={() => setOperation('Alquiler')}
          >
            {labels.rent}
          </button>
        </div>
        <p className={styles.searchHint}>{labels.hint}</p>
      </div>

      <input type="hidden" name="operacion" value={operation} />

      <div className={styles.searchFields}>
        <label className={styles.searchField}>
          <span className={styles.searchFieldLabel}>{labels.city}</span>
          <input
            type="text"
            name="ciudad"
            list="home-search-cities"
            className={styles.searchInput}
            placeholder={labels.cityPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
          />
          <datalist id="home-search-cities">
            {CITIES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>

        <label className={styles.searchField}>
          <span className={styles.searchFieldLabel}>{labels.state}</span>
          <select name="estado" defaultValue="" className={styles.searchSelect}>
            <option value="">{labels.allStates}</option>
            {ESTADOS.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.searchField}>
          <span className={styles.searchFieldLabel}>{labels.type}</span>
          <select name="categoria" defaultValue="" className={styles.searchSelect}>
            <option value="">{labels.anyType}</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {isEnglish ? type.en : type.es}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.searchField}>
          <span className={styles.searchFieldLabel}>{labels.price}</span>
          <select name="precioMax" defaultValue="" className={styles.searchSelect}>
            <option value="">{labels.anyPrice}</option>
            {PRICE_STEPS.map((step) => (
              <option key={step} value={step}>
                {isEnglish ? `Up to $${money.format(step)}` : `Hasta $${money.format(step)}`}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={styles.searchSubmit}>
          <Search size={16} aria-hidden="true" />
          {labels.submit}
        </button>
      </div>

      <div className={styles.searchQuick}>
        <span className={styles.searchQuickLabel}>{labels.quick}</span>
        {labels.quickLinks.map((link) => (
          <a key={link.href} href={link.href} className={styles.searchChip}>
            {link.label}
          </a>
        ))}
      </div>
    </form>
  )
}
