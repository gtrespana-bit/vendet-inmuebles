'use client'

import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight, Search, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AuthShellProps {
  heading: string
  subheading: string
  children: React.ReactNode
}

export default function AuthShell({ heading, subheading, children }: AuthShellProps) {
  const t = useTranslations('auth')

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <aside className="auth-story">
          <Image
            src="/home-hero-caracas.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 800px) 100vw, 45vw"
            className="auth-story__image"
          />
          <div className="auth-story__scrim" />
          <div className="auth-story__content">
            <LocalLink href="/" className="auth-brand" aria-label="Venezuela Inmuebles, inicio">
              <Image src="/brand-mark.svg" alt="" width={34} height={34} />
              <span>Venezuela <strong>Inmuebles</strong></span>
            </LocalLink>
            <div className="auth-story__copy">
              <p className="auth-story__eyebrow">{t('story.eyebrow')}</p>
              <h2>{t('story.title')}</h2>
              <p>{t('story.description')}</p>
              <div className="auth-story__features">
                <span><Search size={15} aria-hidden="true" /> {t('story.featureSearch')}</span>
                <span><ShieldCheck size={15} aria-hidden="true" /> {t('story.featurePublish')}</span>
              </div>
            </div>
            <LocalLink href="/como-funciona" className="auth-story__link">
              {t('story.learnMore')} <ArrowUpRight size={15} aria-hidden="true" />
            </LocalLink>
          </div>
        </aside>

        <section className="auth-panel" aria-labelledby="auth-heading">
          <LocalLink href="/" className="auth-brand auth-brand--mobile" aria-label="Venezuela Inmuebles, inicio">
            <Image src="/brand-mark.svg" alt="" width={32} height={32} />
            <span>Venezuela <strong>Inmuebles</strong></span>
          </LocalLink>
          <header className="auth-panel__heading">
            <p className="auth-panel__eyebrow">{t('story.formEyebrow')}</p>
            <h1 id="auth-heading">{heading}</h1>
            <p>{subheading}</p>
          </header>
          <div className="auth-form-card">{children}</div>
        </section>
      </div>
    </div>
  )
}
