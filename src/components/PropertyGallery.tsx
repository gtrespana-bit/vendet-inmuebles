'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, Image as ImageIcon, X } from 'lucide-react'

interface PropertyGalleryProps {
  images: string[]
  title: string
  locale: string
}

export default function PropertyGallery({ images, title, locale }: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const isEnglish = locale === 'en'
  const count = images.length

  const goTo = (index: number) => setActiveIndex((index + count) % count)

  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false)
      if (event.key === 'ArrowRight') setActiveIndex((current) => (current + 1) % count)
      if (event.key === 'ArrowLeft') setActiveIndex((current) => (current - 1 + count) % count)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [lightboxOpen, count])

  const photoLabel = isEnglish ? 'Photo' : 'Foto'
  const viewAll = isEnglish ? 'View all photos' : 'Ver todas las fotos'

  return (
    <section className="property-gallery" aria-label={isEnglish ? 'Property photos' : 'Fotos del inmueble'}>
      <div className="property-gallery__hero">
        <Image
          src={images[activeIndex]}
          alt={`${title} · ${photoLabel.toLowerCase()} ${activeIndex + 1}`}
          fill
          priority
          unoptimized
          sizes="(max-width: 768px) 100vw, 72vw"
          className="property-gallery__image"
        />
        <div className="property-gallery__shade" aria-hidden="true" />

        {count > 1 && (
          <>
            <button
              type="button"
              className="property-gallery__arrow property-gallery__arrow--left"
              onClick={() => goTo(activeIndex - 1)}
              aria-label={isEnglish ? 'Previous photo' : 'Foto anterior'}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="property-gallery__arrow property-gallery__arrow--right"
              onClick={() => goTo(activeIndex + 1)}
              aria-label={isEnglish ? 'Next photo' : 'Foto siguiente'}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        <div className="property-gallery__counter" aria-live="polite">
          {String(activeIndex + 1).padStart(2, '0')} <span>/</span> {String(count).padStart(2, '0')}
        </div>
        <button type="button" className="property-gallery__expand" onClick={() => setLightboxOpen(true)}>
          <Expand size={15} aria-hidden="true" />
          <span>{viewAll}</span>
        </button>
      </div>

      {count > 1 && (
        <div className="property-gallery__thumbs" role="group" aria-label={isEnglish ? 'Choose a photo' : 'Elegir una foto'}>
          {images.slice(0, 5).map((image, index) => (
            <button
              type="button"
              key={`${image}-${index}`}
              onClick={() => setActiveIndex(index)}
              className={`property-gallery__thumb ${activeIndex === index ? 'is-active' : ''}`}
              aria-label={`${photoLabel} ${index + 1}`}
              aria-pressed={activeIndex === index}
            >
              <Image src={image} alt="" fill unoptimized sizes="140px" />
              {index === 4 && count > 5 && (
                <span className="property-gallery__more">+{count - 5}</span>
              )}
            </button>
          ))}
          <button type="button" className="property-gallery__all" onClick={() => setLightboxOpen(true)}>
            <ImageIcon size={17} aria-hidden="true" />
            <span>{viewAll}</span>
            <span className="property-gallery__all-count">{count}</span>
          </button>
        </div>
      )}

      {lightboxOpen && (
        <div
          className="property-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={isEnglish ? 'Photo gallery' : 'Galería de fotos'}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="property-lightbox__close"
            onClick={() => setLightboxOpen(false)}
            aria-label={isEnglish ? 'Close gallery' : 'Cerrar galería'}
          >
            <X size={22} />
          </button>
          <p className="property-lightbox__count" aria-live="polite">
            {activeIndex + 1} / {count}
          </p>
          {count > 1 && (
            <>
              <button
                type="button"
                className="property-lightbox__arrow property-lightbox__arrow--left"
                onClick={(event) => { event.stopPropagation(); goTo(activeIndex - 1) }}
                aria-label={isEnglish ? 'Previous photo' : 'Foto anterior'}
              ><ChevronLeft size={28} /></button>
              <button
                type="button"
                className="property-lightbox__arrow property-lightbox__arrow--right"
                onClick={(event) => { event.stopPropagation(); goTo(activeIndex + 1) }}
                aria-label={isEnglish ? 'Next photo' : 'Foto siguiente'}
              ><ChevronRight size={28} /></button>
            </>
          )}
          <div className="property-lightbox__image" onClick={(event) => event.stopPropagation()}>
            <Image
              src={images[activeIndex]}
              alt={`${title} · ${photoLabel.toLowerCase()} ${activeIndex + 1}`}
              fill
              unoptimized
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
          <p className="property-lightbox__caption">{title}</p>
        </div>
      )}
    </section>
  )
}
