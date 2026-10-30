'use client'

import dynamic from 'next/dynamic'
import { ExternalLink, MapPin } from 'lucide-react'
import type { MapLabels, MapProperty } from './PropertyMap'

const PropertyMap = dynamic(() => import('./PropertyMap'), {
  ssr: false,
  loading: () => (
    <div className="property-map property-map--loading">
      <div className="vi-map vi-map--skeleton" />
    </div>
  ),
})

type PropertyLocationMapProps = {
  item: MapProperty
  labels: MapLabels
  locale: string
  osmHref: string
  openLabel: string
  note?: string
  approximateLabel?: string
}

export default function PropertyLocationMap({
  item,
  labels,
  locale,
  osmHref,
  openLabel,
  note,
  approximateLabel,
}: PropertyLocationMapProps) {
  return (
    <div className="property-map">
      <div className="property-map__canvas">
        <PropertyMap
          items={[item]}
          labels={labels}
          locale={locale}
          variant="full"
          fit={false}
          initialCenter={{ lat: item.lat, lng: item.lng }}
          initialZoom={14}
        />
      </div>

      <div className="property-map__foot">
        <p className="property-map__caption">
          <MapPin size={14} aria-hidden="true" />
          {item.approximate && approximateLabel ? approximateLabel : item.location}
        </p>
        <a className="property-map__link" href={osmHref} target="_blank" rel="noreferrer">
          {openLabel}
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      {note && <p className="property-map__note">{note}</p>}
    </div>
  )
}
