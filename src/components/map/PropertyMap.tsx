'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker, LatLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { VE_CENTER, VE_ZOOM } from '@/lib/geo/venezuela'

export type MapBounds = { north: number; south: number; east: number; west: number }

export type MapProperty = {
  id: string
  title: string
  price: number
  currency: string
  operation?: string | null
  location?: string | null
  image?: string | null
  href?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  area?: number | null
  lat: number
  lng: number
  approximate?: boolean
  featured?: boolean
}

export type MapLabels = {
  approximate: string
  exact: string
  viewListing: string
  bedrooms: string
  bathrooms: string
  area: string
  empty: string
  zoomIn: string
  zoomOut: string
  resetView: string
}

type PropertyMapProps = {
  items: MapProperty[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onBoundsChange?: (bounds: MapBounds) => void
  /** Se dispara al hacer clic en el mapa (selector de ubicación). */
  onMapClick?: (point: { lat: number; lng: number }) => void
  labels: MapLabels
  locale?: string
  variant?: 'full' | 'mini'
  /** Cambia este valor para volver a encuadrar el mapa sobre los resultados. */
  fitKey?: string
  initialZoom?: number
  initialCenter?: { lat: number; lng: number }
  /** Encuadra automáticamente los puntos al montar (por defecto sí). */
  fit?: boolean
  className?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const numberLocale = (locale: string) => (locale === 'en' ? 'en-US' : 'es-VE')

/** 890000 → "USD 890K" · 1250 → "USD 1.250" */
export function formatMarkerPrice(price: number, currency: string, locale = 'es'): string {
  if (!price || price <= 0) return currency
  const format = (value: number, digits: number) =>
    new Intl.NumberFormat(numberLocale(locale), {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(value)

  if (price >= 1_000_000) return `${currency} ${format(price / 1_000_000, 2)}M`
  if (price >= 10_000) return `${currency} ${format(price / 1_000, 0)}K`
  return `${currency} ${format(price, 0)}`
}

function formatFullPrice(price: number, currency: string, locale: string): string {
  if (!price || price <= 0) return currency
  return new Intl.NumberFormat(numberLocale(locale), {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(price)
}

function fitPoints(
  map: LeafletMap,
  L: typeof import('leaflet'),
  points: MapProperty[],
) {
  const bounds = points.reduce(
    (acc, item) => acc.extend(L.latLng(item.lat, item.lng)),
    L.latLngBounds(L.latLng(points[0].lat, points[0].lng), L.latLng(points[0].lat, points[0].lng)),
  ) as LatLngBounds
  map.fitBounds(bounds, { padding: [52, 52], maxZoom: 12.5 })
}

function popupHtml(item: MapProperty, labels: MapLabels, locale: string): string {
  const price = formatFullPrice(item.price, item.currency, locale)
  const meta = [
    item.bedrooms ? `${item.bedrooms} ${labels.bedrooms}` : '',
    item.bathrooms ? `${item.bathrooms} ${labels.bathrooms}` : '',
    item.area ? `${new Intl.NumberFormat(numberLocale(locale)).format(item.area)} ${labels.area}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const tag = item.href ? 'a' : 'div'
  const hrefAttr = item.href ? ` href="${escapeHtml(item.href)}"` : ''

  return `
    <${tag} class="vi-map__popup-card"${hrefAttr}>
      ${
        item.image
          ? `<img class="vi-map__popup-image" src="${escapeHtml(item.image)}" alt="" loading="lazy" />`
          : '<span class="vi-map__popup-image vi-map__popup-image--empty" aria-hidden="true"></span>'
      }
      <span class="vi-map__popup-body">
        ${item.operation ? `<span class="vi-map__popup-eyebrow">${escapeHtml(item.operation)}</span>` : ''}
        <span class="vi-map__popup-price">${escapeHtml(price)}</span>
        <span class="vi-map__popup-title">${escapeHtml(item.title)}</span>
        ${item.location ? `<span class="vi-map__popup-location">${escapeHtml(item.location)}</span>` : ''}
        ${meta ? `<span class="vi-map__popup-meta">${escapeHtml(meta)}</span>` : ''}
        ${item.href ? `<span class="vi-map__popup-cta">${escapeHtml(labels.viewListing)} →</span>` : ''}
        <span class="vi-map__popup-note">${escapeHtml(item.approximate ? labels.approximate : labels.exact)}</span>
      </span>
    </${tag}>`
}

export default function PropertyMap({
  items,
  selectedId,
  onSelect,
  onBoundsChange,
  onMapClick,
  labels,
  locale = 'es',
  variant = 'full',
  fitKey,
  initialZoom,
  initialCenter,
  fit = true,
  className,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map())
  const clusterRef = useRef<any>(null)
  const onSelectRef = useRef(onSelect)
  const onBoundsRef = useRef(onBoundsChange)
  const onMapClickRef = useRef(onMapClick)
  const lastFitRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  onSelectRef.current = onSelect
  onBoundsRef.current = onBoundsChange
  onMapClickRef.current = onMapClick

  const points = useMemo(
    () => items.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    [items],
  )
  const pointsKey = useMemo(() => points.map((point) => point.id).join('|'), [points])

  const emitBounds = useCallback((map: LeafletMap) => {
    const bounds = map.getBounds()
    onBoundsRef.current?.({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }, [])

  /* ── Init ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false
    const markers = markersRef.current

    const boot = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.markercluster')
      if (cancelled || !containerRef.current || mapRef.current) return
      leafletRef.current = L as unknown as typeof import('leaflet')

      const map = L.map(containerRef.current, {
        center: [initialCenter?.lat ?? VE_CENTER.lat, initialCenter?.lng ?? VE_CENTER.lng],
        zoom: initialZoom ?? (variant === 'mini' ? 13 : VE_ZOOM),
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: variant === 'full' ? 'center' : false,
        dragging: variant === 'full',
        touchZoom: variant === 'full',
        doubleClickZoom: variant === 'full',
        boxZoom: false,
        keyboard: variant === 'full',
        maxZoom: 19,
        minZoom: 4,
        zoomSnap: 0.5,
        worldCopyJump: true,
      })

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 4,
        updateWhenIdle: true,
        keepBuffer: 2,
      }).addTo(map)

      const cluster = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 54,
        disableClusteringAtZoom: 15,
        iconCreateFunction: (group: any) =>
          L.divIcon({
            className: 'vi-map__cluster-wrap',
            html: `<span class="vi-map__cluster">${group.getChildCount()}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
      })
      cluster.addTo(map)
      clusterRef.current = cluster

      L.control
        .attribution({ position: 'bottomright', prefix: false })
        .addAttribution(
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        )
        .addTo(map)

      map.on('moveend zoomend', () => emitBounds(map))
      map.on('click', (event) => {
        onMapClickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng })
      })
      map.whenReady(() => emitBounds(map))

      mapRef.current = map
      setReady(true)
    }

    boot()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      clusterRef.current = null
      markers.clear()
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Markers (se reconstruyen solo si cambian los puntos) ─────────────── */
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!ready || !L || !map) return

    const cluster = clusterRef.current
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()
    cluster?.clearLayers()

    points.forEach((item) => {
      const priceLabel = formatMarkerPrice(item.price, item.currency, locale)
      const plain = !(item.price > 0)
      const html = `
        <button type="button" class="vi-map__marker${plain ? ' is-plain' : ''}${item.approximate ? ' is-approx' : ''}${item.featured ? ' is-featured' : ''}" aria-label="${escapeHtml(
          plain ? item.title : `${item.title} · ${formatFullPrice(item.price, item.currency, locale)}`,
        )}">
          ${plain ? '<span class="vi-map__marker-dot"></span>' : `<span class="vi-map__marker-price">${escapeHtml(priceLabel)}</span>`}
        </button>`

      const marker = L.marker([item.lat, item.lng], {
        icon: L.divIcon({ className: 'vi-map__pin', html, iconSize: [0, 0], iconAnchor: [0, 0] }),
        keyboard: false,
        riseOnHover: true,
      })

      if (cluster) cluster.addLayer(marker)
      else marker.addTo(map)

      if (!plain) {
        marker.bindPopup(popupHtml(item, labels, locale), {
          className: 'vi-map__popup',
          closeButton: true,
          maxWidth: 300,
          minWidth: 240,
          offset: [0, -18],
          autoPanPadding: [24, 24],
        })
        marker.on('popupopen', () => onSelectRef.current?.(item.id))
      }
      markersRef.current.set(item.id, marker)
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pointsKey, locale])

  /* ── Encuadre ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!fit || !ready || !map || !L || points.length === 0 || variant === 'mini') return

    const key = fitKey ?? pointsKey
    if (lastFitRef.current === key) return

    fitPoints(map, L, points)
    lastFitRef.current = key
  }, [ready, fitKey, pointsKey, variant, points, fit])

  /* ── Selección ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!ready) return
    markersRef.current.forEach((marker, id) => {
      const element = marker.getElement()?.querySelector('.vi-map__marker')
      if (!element) return
      element.classList.toggle('is-active', id === selectedId)
    })

    if (!selectedId) return
    const marker = markersRef.current.get(selectedId)
    const map = mapRef.current
    if (!marker || !map) return
    map.panInside(marker.getLatLng(), { padding: [64, 64] })
    if (!marker.isPopupOpen()) marker.openPopup()
  }, [selectedId, ready, pointsKey])

  const fitAll = () => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || points.length === 0) return
    fitPoints(map, L, points)
  }

  return (
    <div className={`vi-map ${variant === 'mini' ? 'vi-map--mini' : ''} ${className || ''}`}>
      <div ref={containerRef} className="vi-map__canvas" />

      {variant === 'full' && (
        <div className="vi-map__controls" role="group" aria-label={labels.resetView}>
          <button type="button" className="vi-map__control" onClick={() => mapRef.current?.zoomIn(1)} aria-label={labels.zoomIn}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="vi-map__control" onClick={() => mapRef.current?.zoomOut(1)} aria-label={labels.zoomOut}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="vi-map__control" onClick={fitAll} aria-label={labels.resetView}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 5V2h3M12 5V2H9M2 9v3h3M12 9v3H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {points.length === 0 && labels.empty && (
        <div className="vi-map__empty" role="status">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <p>{labels.empty}</p>
        </div>
      )}
    </div>
  )
}
