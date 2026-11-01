'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, Globe, Menu, Search, X, MessageCircle, UserPlus } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/components/AuthProvider'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { useLocalizedMessages } from '@/hooks/useLocalizedMessages'

/** Sin sesión no se ofrece «publicar»: se invita a crear la cuenta y se conserva la intención. */
const registerRedirect = '/register?redirect=%2Fpublicar-inmueble'

export function Header() {
  const { user } = useAuth()
  const unread = useUnreadMessages(user?.id)
  const { t } = useLocalizedMessages()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isEnglish = pathname === '/en' || pathname.startsWith('/en/')
  const alternateLocaleHref = isEnglish
    ? (pathname.replace(/^\/en(?=\/|$)/, '') || '/')
    : `/en${pathname === '/' ? '' : pathname}`
  const primaryHref = user ? '/publicar-inmueble' : registerRedirect
  const primaryLabel = user ? t('header.publishProperty') : t('header.signUp')
  const catalogAction = isEnglish ? '/en/catalogo' : '/catalogo'

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const closeMenu = () => setMobileOpen(false)

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <LocalLink href="/" className="site-brand" aria-label="Venezuela Inmuebles, inicio">
          <BrandMark size={38} />
          <span className="site-brand__name"><strong>Venezuela</strong><span>Inmuebles</span></span>
        </LocalLink>

        <nav className="site-header__nav" aria-label={t('header.primaryNavigation')}>
          <LocalLink href="/catalogo?operacion=Venta">{t('header.buy')}</LocalLink>
          <LocalLink href="/catalogo?operacion=Alquiler">{t('header.rent')}</LocalLink>
          <LocalLink href="/catalogo">{t('header.explore')}</LocalLink>
          <LocalLink href="/mapa">{t('header.map')}</LocalLink>
        </nav>

        <form action={catalogAction} method="get" className="site-header__search">
          <label htmlFor="site-header-query" className="sr-only">{t('header.searchAria')}</label>
          <Search size={17} aria-hidden="true" />
          <input
            id="site-header-query"
            name="q"
            type="search"
            placeholder={t('header.searchPlaceholder')}
          />
          <button type="submit" aria-label={t('header.searchAria')}><ArrowUpRight size={16} /></button>
        </form>

        <div className="site-header__actions">
          <a
            href={alternateLocaleHref}
            className="site-header__locale"
            lang={isEnglish ? 'es' : 'en'}
            aria-label={isEnglish ? 'Cambiar a español' : 'Switch to English'}
            title={isEnglish ? 'Español' : 'English'}
          >
            <Globe size={16} aria-hidden="true" />
            <span>{isEnglish ? 'ES' : 'EN'}</span>
          </a>

          {user ? (
            <LocalLink href="/dashboard" className="site-header__account">{t('header.myPanel')}</LocalLink>
          ) : (
            <LocalLink href="/login" className="site-header__account">{t('header.signIn')}</LocalLink>
          )}
          <LocalLink href={primaryHref} className="site-header__publish" aria-label={primaryLabel}>
            <span>{primaryLabel}</span>
            {user ? <ArrowUpRight size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
          </LocalLink>
        </div>

        <LocalLink href="/chat" className="site-header__chat" aria-label={unread > 0 ? t('header.chatUnread').replace('{count}', String(unread)) : t('header.chat')} title={t('header.chat')}>
          <span className="site-header__chat-icon"><MessageCircle size={20} aria-hidden="true" />{unread > 0 && <span className="site-header__chat-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}</span>
          <span className="site-header__chat-label">{t('header.chat')}</span>
        </LocalLink>

        <button
          type="button"
          className="site-header__menu-button"
          aria-label={mobileOpen ? t('header.closeMenu') : t('header.openMenu')}
          aria-expanded={mobileOpen}
          aria-controls="site-mobile-menu"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div id="site-mobile-menu" className="site-mobile-menu">
          <form action={catalogAction} method="get" className="site-mobile-menu__search">
            <label htmlFor="mobile-site-query" className="sr-only">{t('header.searchAria')}</label>
            <Search size={17} aria-hidden="true" />
            <input id="mobile-site-query" name="q" type="search" placeholder={t('header.searchPlaceholder')} />
            <button type="submit" aria-label={t('header.searchAria')} onClick={closeMenu}><ArrowUpRight size={17} /></button>
          </form>
          <nav aria-label={t('header.primaryNavigation')}>
            <LocalLink href="/catalogo?operacion=Venta" onClick={closeMenu}>{t('header.buy')}</LocalLink>
            <LocalLink href="/catalogo?operacion=Alquiler" onClick={closeMenu}>{t('header.rent')}</LocalLink>
            <LocalLink href="/catalogo" onClick={closeMenu}>{t('header.explore')}</LocalLink>
            <LocalLink href="/mapa" onClick={closeMenu}>{t('header.map')}</LocalLink>
            {user && <LocalLink href="/dashboard" onClick={closeMenu}>{t('header.myPanel')}</LocalLink>}
            <a href={alternateLocaleHref} onClick={closeMenu} lang={isEnglish ? 'es' : 'en'}>{isEnglish ? 'Español' : 'English'}</a>
            {!user && <LocalLink href="/login" onClick={closeMenu}>{t('header.signIn')}</LocalLink>}
            <LocalLink href={primaryHref} className="site-mobile-menu__publish" onClick={closeMenu}>{primaryLabel}</LocalLink>
          </nav>
        </div>
      )}
    </header>
  )
}
