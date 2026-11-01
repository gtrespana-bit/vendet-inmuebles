'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, Compass, FileText, Layers, Play, Video } from 'lucide-react'
import {
  parseFloorPlanMedia,
  parseVideoMedia,
  parseVirtualTourMedia,
} from '@/lib/property-media'
import { isOptimizableImageSrc } from '@/lib/image-src'

interface PropertyRichMediaProps {
  videoUrl?: string | null
  virtualTourUrl?: string | null
  floorPlanUrl?: string | null
  title: string
  locale: string
}

type MediaTab = 'video' | 'tour' | 'plan'

export default function PropertyRichMedia({
  videoUrl,
  virtualTourUrl,
  floorPlanUrl,
  title,
  locale,
}: PropertyRichMediaProps) {
  const isEn = locale === 'en'
  const video = parseVideoMedia(videoUrl)
  const tour = parseVirtualTourMedia(virtualTourUrl)
  const plan = parseFloorPlanMedia(floorPlanUrl)

  const availableTabs: Array<{ key: MediaTab; label: string; icon: typeof Video }> = [
    ...(video ? [{ key: 'video' as const, label: isEn ? 'Video tour' : 'Vídeo del inmueble', icon: Video }] : []),
    ...(tour ? [{ key: 'tour' as const, label: isEn ? '360° Virtual tour' : 'Recorrido 360°', icon: Compass }] : []),
    ...(plan ? [{ key: 'plan' as const, label: isEn ? 'Floor plan' : 'Plano arquitectónico', icon: Layers }] : []),
  ]

  const [activeTab, setActiveTab] = useState<MediaTab>(availableTabs[0]?.key || 'video')
  const [tourIframeActive, setTourIframeActive] = useState(false)

  if (availableTabs.length === 0) return null

  const currentTab = availableTabs.some((t) => t.key === activeTab) ? activeTab : availableTabs[0].key

  const providerName = (provider: string) => {
    if (provider === 'youtube') return 'YouTube'
    if (provider === 'vimeo') return 'Vimeo'
    if (provider === 'instagram') return 'Instagram Reel'
    if (provider === 'tiktok') return 'TikTok'
    if (provider === 'matterport') return 'Matterport 3D'
    if (provider === 'kuula') return 'Kuula 360°'
    return isEn ? 'External viewer' : 'Visor externo'
  }

  return (
    <section className="property-detail__panel property-rich-media" aria-labelledby="property-rich-media-title">
      <div className="property-detail__section-heading">
        <div>
          <p className="property-detail__section-kicker">
            {isEn ? 'Interactive walkthrough' : 'Recorrido multimedia'}
          </p>
          <h2 id="property-rich-media-title">
            {isEn ? 'Video, 360° tour & floor plan' : 'Vídeo, recorrido 360° y plano'}
          </h2>
        </div>
      </div>

      {availableTabs.length > 1 && (
        <div className="property-rich-media__tabs" role="tablist">
          {availableTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={currentTab === key}
              onClick={() => setActiveTab(key)}
              className={`property-rich-media__tab${currentTab === key ? ' is-active' : ''}`}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {currentTab === 'video' && video && (
        <div className="property-rich-media__body">
          {video.embedUrl ? (
            <div
              className={
                video.isVertical
                  ? 'property-rich-media__frame property-rich-media__frame--vertical'
                  : 'property-rich-media__frame'
              }
            >
              <iframe
                src={video.embedUrl}
                title={`${title} — ${isEn ? 'Video tour' : 'Vídeo del inmueble'}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div className="property-rich-media__callout">
              <div className="property-rich-media__callout-icon">
                <Play size={22} aria-hidden="true" />
              </div>
              <div className="property-rich-media__callout-copy">
                <h3>
                  {isEn
                    ? `Watch walkthrough on ${providerName(video.provider)}`
                    : `Ver recorrido en vídeo en ${providerName(video.provider)}`}
                </h3>
                <p>
                  {isEn
                    ? 'Open the full walkthrough video published by the advisor or owner in a new tab.'
                    : 'Abre el vídeo completo publicado por el asesor o propietario en una pestaña segura.'}
                </p>
              </div>
              <a
                href={video.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="property-rich-media__cta"
              >
                {isEn ? 'Watch video' : 'Abrir vídeo'} <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          )}
          {video.embedUrl && (
            <p className="property-rich-media__footer-link">
              <a href={video.externalUrl} target="_blank" rel="noopener noreferrer">
                {isEn ? `Open on ${providerName(video.provider)}` : `Abrir directamente en ${providerName(video.provider)}`}{' '}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </p>
          )}
        </div>
      )}

      {currentTab === 'tour' && tour && (
        <div className="property-rich-media__body">
          {tour.embedUrl && tourIframeActive ? (
            <div className="property-rich-media__frame">
              <iframe
                src={tour.embedUrl}
                title={`${title} — ${isEn ? '360° Virtual tour' : 'Recorrido virtual 360°'}`}
                loading="lazy"
                allow="fullscreen; xr-spatial-tracking"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <div className="property-rich-media__callout">
              <div className="property-rich-media__callout-icon">
                <Compass size={22} aria-hidden="true" />
              </div>
              <div className="property-rich-media__callout-copy">
                <h3>
                  {isEn
                    ? `Interactive 360° tour (${providerName(tour.provider)})`
                    : `Recorrido interactivo 360° (${providerName(tour.provider)})`}
                </h3>
                <p>
                  {isEn
                    ? 'Explore every room of this property in 3D / 360° from your phone or computer.'
                    : 'Explora cada ambiente de este inmueble en 360° desde tu teléfono o computadora.'}
                </p>
              </div>
              {tour.embedUrl ? (
                <button
                  type="button"
                  onClick={() => setTourIframeActive(true)}
                  className="property-rich-media__cta"
                >
                  {isEn ? 'Start 360° tour' : 'Iniciar recorrido 360°'}
                </button>
              ) : (
                <a
                  href={tour.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="property-rich-media__cta"
                >
                  {isEn ? 'Open 360° tour' : 'Abrir recorrido 360°'} <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              )}
            </div>
          )}
          <p className="property-rich-media__footer-link">
            <a href={tour.externalUrl} target="_blank" rel="noopener noreferrer">
              {isEn ? 'Open 360° tour in full screen' : 'Abrir recorrido 360° en pantalla completa'}{' '}
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </p>
        </div>
      )}

      {currentTab === 'plan' && plan && (
        <div className="property-rich-media__body">
          {plan.kind === 'image' ? (
            <div className="property-rich-media__plan-preview">
              <div className="property-rich-media__plan-image">
                <Image
                  src={plan.url}
                  alt={`${title} — ${isEn ? 'Floor plan' : 'Plano arquitectónico'}`}
                  fill
                  sizes="(max-width: 768px) 92vw, 720px"
                  unoptimized={!isOptimizableImageSrc(plan.url)}
                  className="object-contain"
                />
              </div>
              <p className="property-rich-media__footer-link">
                <a href={plan.url} target="_blank" rel="noopener noreferrer">
                  {isEn ? 'View full-resolution floor plan' : 'Ver plano en tamaño completo'}{' '}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              </p>
            </div>
          ) : (
            <div className="property-rich-media__callout">
              <div className="property-rich-media__callout-icon">
                <FileText size={22} aria-hidden="true" />
              </div>
              <div className="property-rich-media__callout-copy">
                <h3>
                  {plan.kind === 'pdf'
                    ? isEn
                      ? 'Architectural floor plan (PDF)'
                      : 'Plano arquitectónico en PDF'
                    : isEn
                      ? 'Architectural floor plan'
                      : 'Plano de distribución del inmueble'}
                </h3>
                <p>
                  {isEn
                    ? 'Review dimensions, layout and room distribution in detail.'
                    : 'Revisa las medidas y la distribución de los ambientes en detalle.'}
                </p>
              </div>
              <a
                href={plan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="property-rich-media__cta"
              >
                {isEn ? 'Open floor plan' : 'Ver plano'} <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
