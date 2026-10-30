'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import styles from './landing.module.css'

const LINKS = [
  { href: '/catalogo', label: 'COLLECTION', index: '01' },
  { href: '/propiedades', label: 'ARCHIVE', index: '02' },
  { href: '/contacto', label: 'CONCIERGE', index: '03' },
] as const

export default function LandingNav() {
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
        <LocalLink href="/" className={styles.brand} aria-label="Venezuela Inmuebles — inicio">
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandName}>
            <span>Venezuela</span>
            <span>Inmuebles</span>
          </span>
        </LocalLink>

        <nav className={styles.navLinks} aria-label="Colección">
          {LINKS.map((link) => (
            <LocalLink key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </LocalLink>
          ))}
        </nav>

        <LocalLink href="/contacto" className={styles.navCta}>
          Solicitar acceso privado
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
        <div className={styles.menuPanel} id="landing-menu" role="dialog" aria-modal="true" aria-label="Menú">
          <div className={styles.menuPanelHead}>
            <span>Venezuela Inmuebles</span>
            <button
              type="button"
              className={styles.menuClose}
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>

          <nav className={styles.menuPanelLinks} aria-label="Menú principal">
            {LINKS.map((link) => (
              <LocalLink key={link.href} href={link.href} className={styles.menuPanelLink}>
                <small aria-hidden="true">{link.index}</small>
                {link.label}
              </LocalLink>
            ))}
          </nav>

          <LocalLink href="/contacto" className={styles.menuPanelCta}>
            Solicitar acceso privado
          </LocalLink>
        </div>
      )}
    </>
  )
}
