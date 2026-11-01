'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ESTADOS } from '@/lib/ubicaciones'
import {
  CIUDADES_PRINCIPALES_BUSQUEDA,
  classifyLocationInput,
  getUrbanizacionesSugeridas,
} from '@/lib/urbanizaciones'
import styles from './home.module.css'

const PROPERTY_TYPES = [
  { value: 'casas', es: 'Casas', en: 'Houses' },
  { value: 'apartamentos', es: 'Apartamentos', en: 'Apartments' },
  { value: 'townhouses', es: 'Townhouses', en: 'Townhouses' },
  { value: 'terrenos', es: 'Terrenos', en: 'Land' },
  { value: 'locales', es: 'Locales comerciales', en: 'Commercial spaces' },
  { value: 'oficinas', es: 'Oficinas', en: 'Offices' },
  { value: 'galpones', es: 'Galpones', en: 'Warehouses' },
  { value: 'habitaciones', es: 'Anexos / Habitaciones', en: 'Rooms & annexes' },
  { value: 'fincas', es: 'Fincas', en: 'Farms & estates' },
  { value: 'edificios', es: 'Edificios', en: 'Buildings' },
]

export const SALE_PRICE_STEPS = [25000, 50000, 100000, 150000, 250000, 500000, 1000000, 2000000] as const
export const RENT_PRICE_STEPS = [200, 350, 500, 800, 1200, 2000, 3500] as const

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
  const [locationText, setLocationText] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const isEnglish = locale === 'en'
  const prefix = isEnglish ? '/en' : ''
  const action = `${prefix}/catalogo`
  const money = new Intl.NumberFormat(isEnglish ? 'en-US' : 'es-VE', { maximumFractionDigits: 0 })

  const activePriceSteps = operation === 'Alquiler' ? RENT_PRICE_STEPS : SALE_PRICE_STEPS
  const classifiedLocation = useMemo(() => classifyLocationInput(locationText), [locationText])

  const locationSuggestions = useMemo(() => {
    const zones = getUrbanizacionesSugeridas(selectedState || undefined, undefined)
    const list = selectedState
      ? zones
      : [...CIUDADES_PRINCIPALES_BUSQUEDA, ...zones.slice(0, 20)]
    return Array.from(new Set(list))
  }, [selectedState])

  const handleOperationChange = (nextOp: 'Venta' | 'Alquiler') => {
    setOperation(nextOp)
    const nextSteps: readonly number[] = nextOp === 'Alquiler' ? RENT_PRICE_STEPS : SALE_PRICE_STEPS
    if (maxPrice && !nextSteps.includes(Number(maxPrice))) {
      setMaxPrice('')
    }
  }

  const rentQuickLinks = isEnglish
    ? [
        { label: 'Apartments in Las Mercedes', href: `${prefix}/catalogo?operacion=Alquiler&categoria=apartamentos&zona=Las+Mercedes` },
        { label: 'Rentals in Valencia', href: `${prefix}/catalogo?operacion=Alquiler&ciudad=Valencia` },
        { label: 'Offices for rent', href: `${prefix}/catalogo?operacion=Alquiler&categoria=oficinas` },
        { label: 'Townhouses for rent', href: `${prefix}/catalogo?operacion=Alquiler&categoria=townhouses` },
      ]
    : [
        { label: 'Apartamentos en Las Mercedes', href: '/catalogo?operacion=Alquiler&categoria=apartamentos&zona=Las+Mercedes' },
        { label: 'Alquiler en Valencia', href: '/catalogo?operacion=Alquiler&ciudad=Valencia' },
        { label: 'Oficinas en alquiler', href: '/catalogo?operacion=Alquiler&categoria=oficinas' },
        { label: 'Townhouses en alquiler', href: '/catalogo?operacion=Alquiler&categoria=townhouses' },
      ]

  const activeQuickLinks = operation === 'Alquiler' ? rentQuickLinks : labels.quickLinks

  return (
    <form
      action={action}
      method="get"
      className={styles.searchCard}
    >
      <div className={styles.searchTop}>
        <div className={styles.searchTabs} role="group" aria-label={labels.type}>
          <button
            type="button"
            className={`${styles.searchTab} ${operation === 'Venta' ? styles.searchTabActive : ''}`}
            aria-pressed={operation === 'Venta'}
            onClick={() => handleOperationChange('Venta')}
          >
            {labels.buy}
          </button>
          <button
            type="button"
            className={`${styles.searchTab} ${operation === 'Alquiler' ? styles.searchTabActive : ''}`}
            aria-pressed={operation === 'Alquiler'}
            onClick={() => handleOperationChange('Alquiler')}
          >
            {labels.rent}
          </button>
        </div>
        <p className={styles.searchHint}>{labels.hint}</p>
      </div>

      <input type="hidden" name="operacion" value={operation} />
      {classifiedLocation.kind === 'ciudad' && (
        <input type="hidden" name="ciudad" value={classifiedLocation.value} />
      )}
      {classifiedLocation.kind === 'zona' && (
        <input type="hidden" name="zona" value={classifiedLocation.value} />
      )}
      {selectedState && classifiedLocation.kind !== 'ciudad' && (
        <input type="hidden" name="estado" value={selectedState} />
      )}

      <div className={styles.searchFields}>
        <label className={styles.searchField}>
          <span className={styles.searchFieldLabel}>{labels.city}</span>
          <input
            type="text"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            list="home-search-locations"
            className={styles.searchInput}
            placeholder={labels.cityPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
          />
          <datalist id="home-search-locations">
            {locationSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className={styles.searchField}>
          <span className={styles.searchFieldLabel}>{labels.state}</span>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className={styles.searchSelect}
          >
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
          <select
            name="precioMax"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className={styles.searchSelect}
          >
            <option value="">{labels.anyPrice}</option>
            {activePriceSteps.map((step) => (
              <option key={step} value={step}>
                {operation === 'Alquiler'
                  ? isEnglish
                    ? `Up to $${money.format(step)}/mo`
                    : `Hasta $${money.format(step)}/mes`
                  : isEnglish
                    ? `Up to $${money.format(step)}`
                    : `Hasta $${money.format(step)}`}
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
        {activeQuickLinks.map((link) => (
          <a key={link.href} href={link.href} className={styles.searchChip}>
            {link.label}
          </a>
        ))}
      </div>
    </form>
  )
}
