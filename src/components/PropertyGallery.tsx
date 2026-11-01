'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Expand, Image as ImageIcon, X } from 'lucide-react'
import { isOptimizableImageSrc as checkOptimizableImageSrc } from '@/lib/image-src'

interface PropertyGalleryProps {
  images: string[]
  title: string
  locale: string
}

/**
 * Comprueba si la URL está cubierta por `images.remotePatterns` (o es local),
 * permitiendo usar la optimización AVIF/WebP de Next Image sin romper URLs heredadas (F24).
 *
 * NOTA: Los Server Components deben importar `isOptimizableImageSrc` desde `@/lib/image-src`,
 * nunca desde este archivo `'use client'`.
 */
export function isOptimizableImageSrc(src: string): boolean {
  return checkOptimizableImageSrc(src)
}

export default function PropertyGallery({ images, title, locale }: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const isEnglish = locale === 'en'
  const count = images.length

  const goTo = (index: number) => setActiveIndex((index + count) % count)

  const openLightbox = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement
    }
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  useEffect(() => {
    if (!lightboxOpen) return

    const backgroundSelectors = ['#main-content', 'header', 'footer']
    const isolated: Array<{ el: HTMLElement; prevAriaHidden: string | null; prevInert: boolean }> = []
    for (const sel of backgroundSelectors) {
      document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        isolated.push({
          el,
          prevAriaHidden: el.getAttribute('aria-hidden'),
          prevInert: Boolean((el as HTMLElement & { inert?: boolean }).inert),
        })
        el.setAttribute('aria-hidden', 'true')
        ;(el as HTMLElement & { inert?: boolean }).inert = true
      })
    }

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setLightboxOpen(false)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % count)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveIndex((current) => (current - 1 + count) % count)
        return
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
          )
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (event.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            event.preventDefault()
            last.focus()
          }
        } else if (!active || active === last || !dialogRef.current.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
      for (const item of isolated) {
        if (item.prevAriaHidden === null) item.el.removeAttribute('aria-hidden')
        else item.el.setAttribute('aria-hidden', item.prevAriaHidden)
        ;(item.el as HTMLElement & { inert?: boolean }).inert = item.prevInert
      }
      const trigger = previousFocusRef.current
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus()
      }
    }
  }, [lightboxOpen, count])

  const photoLabel = isEnglish ? 'Photo' : 'Foto'
  const viewAll = isEnglish ? 'View all photos' : 'Ver todas las fotos'
  const activeSrc = images[activeIndex]
  const optimizeActive = isOptimizableImageSrc(activeSrc)

  return (
    <section className="property-gallery" aria-label={isEnglish ? 'Property photos' : 'Fotos del inmueble'}>
      <div className="property-gallery__hero">
        <Image
          src={activeSrc}
          alt={`${title} · ${photoLabel.toLowerCase()} ${activeIndex + 1}`}
          fill
          priority
          unoptimized={!optimizeActive}
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
        <button type="button" className="property-gallery__expand" onClick={openLightbox}>
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
              <Image src={image} alt="" fill unoptimized={!isOptimizableImageSrc(image)} sizes="140px" />
              {index === 4 && count > 5 && (
                <span className="property-gallery__more">+{count - 5}</span>
              )}
            </button>
          ))}
          <button type="button" className="property-gallery__all" onClick={openLightbox}>
            <ImageIcon size={17} aria-hidden="true" />
            <span>{viewAll}</span>
            <span className="property-gallery__all-count">{count}</span>
          </button>
        </div>
      )}

      {lightboxOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dialogRef}
          className="property-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={isEnglish ? 'Photo gallery' : 'Galería de fotos'}
          onClick={closeLightbox}
        >
          <button
            ref={closeButtonRef}
            type="button"
            className="property-lightbox__close"
            onClick={closeLightbox}
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
              src={activeSrc}
              alt={`${title} · ${photoLabel.toLowerCase()} ${activeIndex + 1}`}
              fill
              unoptimized={!optimizeActive}
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
          <p className="property-lightbox__caption">{title}</p>
        </div>,
        document.body
      )}
    </section>
  )
}
