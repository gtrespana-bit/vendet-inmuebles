'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import type { LandingCopy } from './copy'
import styles from './landing.module.css'

export default function LandingNav({ copy }: { copy: LandingCopy }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      <header className={styles.nav}>
        <LocalLink href="/" className={styles.brand} aria-label="Venezuela Inmuebles">
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandName}>
            <span>Venezuela</span>
            <span>Inmuebles</span>
          </span>
        </LocalLink>

        <nav className={styles.navLinks} aria-label={copy.nav.menuNote}>
          {copy.nav.links.map((link) => (
            <LocalLink key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </LocalLink>
          ))}
        </nav>

        <LocalLink href={copy.nav.ctaHref} className={styles.navCta}>
          {copy.nav.cta}
        </LocalLink>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="landing-menu"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </header>

      {open && (
        <div className={styles.menuPanel} id="landing-menu" role="dialog" aria-modal="true" aria-label={copy.nav.menuNote}>
          <div className={styles.menuPanelHead}>
            <span>{copy.nav.menuTitle}</span>
            <button type="button" className={styles.menuClose} aria-label="Cerrar menú" onClick={() => setOpen(false)}>
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>

          <nav className={styles.menuPanelLinks} aria-label={copy.nav.menuNote}>
            {copy.nav.links.map((link, index) => (
              <LocalLink key={link.href} href={link.href} className={styles.menuPanelLink}>
                <small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small>
                {link.label}
              </LocalLink>
            ))}
          </nav>

          <LocalLink href={copy.nav.ctaHref} className={styles.menuPanelCta}>
            {copy.nav.menuCta}
          </LocalLink>
        </div>
      )}
    </>
  )
}
