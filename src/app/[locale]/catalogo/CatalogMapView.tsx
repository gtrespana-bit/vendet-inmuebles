'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import LocalLink from '@/components/LocalLink'
import { MapPin, X } from 'lucide-react'
import type { MapBounds, MapLabels, MapProperty } from '@/components/map/PropertyMap'
import { jitterPoint, resolveListingGeo } from '@/lib/geo/venezuela'

const PropertyMap = dynamic(() => import('@/components/map/PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="vi-map vi-map--loading">
      <div className="vi-map__canvas" />
    </div>
  ),
})

export type CatalogMapLabels = MapLabels & {
  resultsInMap: (count: number) => string
  searchArea: string
  searchAreaHint: string
  clearArea: string
  areaActive: (count: number) => string
  sampleData: string
  noResultsInArea: string
}

type CatalogMapViewProps = {
  items: MapProperty[]
  locale: string
  labels: CatalogMapLabels
  demo?: boolean
  fitKey: string
}

function numberLocale(locale: string) {
  return locale === 'en' ? 'en-US' : 'es-VE'
}

export function toMapProperty(product: any, locale: string): MapProperty | null {
  const geo = resolveListingGeo({
    latitud: product.latitud ?? product.latitude,
    longitud: product.longitud ?? product.longitude,
    ciudad: product.ciudad ?? product.city,
    municipio: product.municipio,
    estado: product.estado ?? product.state,
    zona: product.zona,
  })

  if (!geo.point) return null

  const id = String(product.id ?? product.slug ?? Math.random())
  const point = geo.approximate ? jitterPoint(geo.point, id) : geo.point
  const slug = product.slug || product.id
  const city = product.ciudad ?? product.city ?? ''
  const state = product.estado ?? product.state ?? ''

  return {
    id,
    title: product.titulo || product.title || '',
    price: Number(product.precio ?? product.price ?? 0),
    currency: String(product.moneda || product.currency || 'USD'),
    operation: product.operacion_nombre ?? product.operacion_slug ?? null,
    location: [city, state].filter(Boolean).join(', '),
    image: product.main_image_url ?? null,
    href: `/inmueble/${slug}`,
    bedrooms: product.habitaciones != null ? Number(product.habitaciones) : null,
    bathrooms: product.banos != null ? Number(product.banos) : null,
    area: product.area_total != null ? Number(product.area_total) : null,
    lat: point.lat,
    lng: point.lng,
    approximate: geo.approximate,
    featured: Boolean(product.destacado),
  }
}

export default function CatalogMapView({ items, locale, labels, demo = false, fitKey }: CatalogMapViewProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [pendingBounds, setPendingBounds] = useState<MapBounds | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visibleItems = useMemo(() => {
    if (!bounds) return items
    return items.filter(
      (item) =>
        item.lat <= bounds.north &&
        item.lat >= bounds.south &&
        item.lng <= bounds.east &&
        item.lng >= bounds.west,
    )
  }, [items, bounds])

  const fmtPrice = (item: MapProperty) => {
    if (!item.price) return item.currency
    return new Intl.NumberFormat(numberLocale(locale), {
      style: 'currency',
      currency: item.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(item.price)
  }

  return (
    <div className="catalog-map">
      <div className="catalog-map__map">
        <PropertyMap
          items={items}
          labels={labels}
          locale={locale}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBoundsChange={setPendingBounds}
          fitKey={fitKey}
        />

        <div className="catalog-map__area">
          {bounds ? (
            <>
              <span className="catalog-map__area-count">
                {labels.areaActive(visibleItems.length)}
              </span>
              <button type="button" className="catalog-map__area-clear" onClick={() => setBounds(null)}>
                <X size={13} aria-hidden="true" />
                {labels.clearArea}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="catalog-map__area-button"
              onClick={() => pendingBounds && setBounds(pendingBounds)}
              disabled={!pendingBounds}
            >
              <MapPin size={15} aria-hidden="true" />
              {labels.searchArea}
            </button>
          )}
        </div>

        {demo && <span className="catalog-map__badge">{labels.sampleData}</span>}
      </div>

      <div className="catalog-map__side">
        <div className="catalog-map__list-head">
          <p className="catalog-map__list-title">
            {labels.resultsInMap(visibleItems.length)}
          </p>
          <p className="catalog-map__list-hint">{labels.searchAreaHint}</p>
        </div>

        {visibleItems.length === 0 ? (
          <p className="catalog-map__empty">{labels.noResultsInArea}</p>
        ) : (
          <ul className="catalog-map__list">
            {visibleItems.map((item) => {
              const active = item.id === selectedId
              const content = (
                <>
                  <span className="catalog-map__thumb">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" loading="lazy" />
                    ) : null}
                  </span>
                  <span className="catalog-map__body">
                    <span className="catalog-map__row-top">
                      <span className="catalog-map__price">{fmtPrice(item)}</span>
                      {item.approximate && <span className="catalog-map__approx">{labels.approximate}</span>}
                    </span>
                    <span className="catalog-map__row-title">{item.title}</span>
                    <span className="catalog-map__row-meta">
                      {[item.location, item.bedrooms ? `${item.bedrooms} ${labels.bedrooms}` : '', item.area ? `${item.area} ${labels.area}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </>
              )

              return (
                <li key={item.id}>
                  {item.href ? (
                    <LocalLink
                      href={item.href}
                      className={`catalog-map__row ${active ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {content}
                    </LocalLink>
                  ) : (
                    <button
                      type="button"
                      className={`catalog-map__row ${active ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {content}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
