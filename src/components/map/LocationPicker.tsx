'use client'

import dynamic from 'next/dynamic'
import { Crosshair, X } from 'lucide-react'
import type { MapLabels, MapProperty } from './PropertyMap'

const PropertyMap = dynamic(() => import('./PropertyMap'), {
  ssr: false,
  loading: () => <div className="vi-map vi-map--skeleton" />,
})

type Point = { lat: number; lng: number }

type LocationPickerProps = {
  value: Point | null
  center: Point
  onChange: (point: Point | null) => void
  labels: MapLabels
  hint: string
  clearLabel: string
  emptyLabel: string
  placeLabel: string
}

export default function LocationPicker({
  value,
  center,
  onChange,
  labels,
  hint,
  clearLabel,
  emptyLabel,
  placeLabel,
}: LocationPickerProps) {
  const item: MapProperty | null = value
    ? {
        id: 'picker',
        title: placeLabel,
        price: 0,
        currency: '',
        lat: value.lat,
        lng: value.lng,
        approximate: false,
      }
    : null

  return (
    <div className="location-picker">
      <div className="location-picker__canvas">
        <PropertyMap
          items={item ? [item] : []}
          labels={{ ...labels, empty: '' }}
          variant="full"
          fit={false}
          initialCenter={center}
          initialZoom={12}
          onMapClick={(point) => onChange(point)}
        />
      </div>

      <div className="location-picker__bar">
        <p className="location-picker__hint">
          <Crosshair size={14} aria-hidden="true" />
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : hint}
        </p>
        {value ? (
          <button type="button" className="location-picker__clear" onClick={() => onChange(null)}>
            <X size={13} aria-hidden="true" />
            {clearLabel}
          </button>
        ) : (
          <span className="location-picker__empty">{emptyLabel}</span>
        )}
      </div>
    </div>
  )
}
