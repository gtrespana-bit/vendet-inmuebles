'use client'

import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { useLocalizedMessages } from '@/hooks/useLocalizedMessages'

export function Footer() {
  const { t } = useLocalizedMessages()
  const year = new Date().getFullYear()

  const categoryLinks = [
    { label: t('header.categories.casas'), href: '/catalogo?categoria=casas' },
    { label: t('header.categories.apartamentos'), href: '/catalogo?categoria=apartamentos' },
    { label: t('header.categories.terrenos'), href: '/catalogo?categoria=terrenos' },
    { label: t('header.categories.locales'), href: '/catalogo?categoria=locales' },
    { label: t('header.categories.oficinas'), href: '/catalogo?categoria=oficinas' },
  ]

  const informationLinks = [
    { label: t('footer.howItWorks'), href: '/como-funciona' },
    { label: t('footer.aboutUs'), href: '/sobre-nosotros' },
    { label: t('header.blog'), href: '/blog' },
    { label: t('nav.contact'), href: '/contacto' },
  ]

  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div className="site-footer__brand-column">
          <LocalLink href="/" className="site-brand site-brand--footer" aria-label="Venezuela Inmuebles, inicio">
            <Image src="/brand-mark.svg" alt="" width={40} height={40} />
            <span className="site-brand__name"><strong>Venezuela</strong><span>Inmuebles</span></span>
          </LocalLink>
          <p>{t('footer.description')}</p>
          <LocalLink href="/publicar-inmueble" className="site-footer__cta">
            {t('header.publishProperty')} <ArrowUpRight size={16} aria-hidden="true" />
          </LocalLink>
        </div>

        <nav className="site-footer__links" aria-label={t('footer.categories')}>
          <h2>{t('footer.categories')}</h2>
          <LocalLink href="/catalogo?operacion=Venta">{t('header.buy')}</LocalLink>
          <LocalLink href="/catalogo?operacion=Alquiler">{t('header.rent')}</LocalLink>
          {categoryLinks.map((link) => <LocalLink key={link.href} href={link.href}>{link.label}</LocalLink>)}
        </nav>

        <nav className="site-footer__links" aria-label={t('footer.information')}>
          <h2>{t('footer.information')}</h2>
          {informationLinks.map((link) => <LocalLink key={link.href} href={link.href}>{link.label}</LocalLink>)}
          <LocalLink href="/faq">FAQ</LocalLink>
          <LocalLink href="/creditos">{t('header.credits')}</LocalLink>
        </nav>

        <nav className="site-footer__links" aria-label={t('footer.legal')}>
          <h2>{t('footer.legal')}</h2>
          <LocalLink href="/terminos-y-condiciones">{t('footer.terms')}</LocalLink>
          <LocalLink href="/politica-de-privacidad">{t('footer.privacy')}</LocalLink>
        </nav>
      </div>

      <div className="site-footer__bottom">
        <p>© {year} Venezuela Inmuebles. {t('footer.allRightsReserved')}</p>
        <LocalLink href="/catalogo" className="site-footer__back-to-search">{t('header.explore')} <ArrowUpRight size={14} aria-hidden="true" /></LocalLink>
      </div>
    </footer>
  )
}
