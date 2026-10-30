'use client'

import { useLocale, useTranslations } from 'next-intl'
import Avatar from '@/components/Avatar'
import BadgeVerificado from '@/components/BadgeVerificado'
import NivelBadge from '@/components/NivelBadge'
import LocalLink from '@/components/LocalLink'
import { Camera, Edit, MapPin, Mail, Star, CalendarDays, Coins, ArrowUpRight } from 'lucide-react'

/**
 * Cabecera de identidad del dashboard. Siempre visible:
 * avatar, nombre, verificado, nivel, ubicación, miembro desde, reseñas
 * y acciones rápidas. Las estadísticas de anuncios NO viven aquí.
 */
export default function ProfileHero({
  userId,
  nombre,
  email,
  fotoUrl,
  verificado,
  nivelConfianza,
  estado,
  ciudad,
  creadoEn,
  resenasCount,
  promedioResenas,
  creditos,
  onGoToTab,
  onFotoChange,
}: {
  userId: string
  nombre: string
  email?: string | null
  fotoUrl: string | null
  verificado: boolean
  nivelConfianza: number
  estado?: string
  ciudad?: string
  creadoEn: string | null
  resenasCount: number
  promedioResenas: number
  creditos: number
  onGoToTab: (tab: string) => void
  onFotoChange?: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
}) {
  const t = useTranslations('dashboard')
  const locale = useLocale()

  const ubicacion = [ciudad, estado].filter(Boolean).join(', ')
  const fechaMiembro = (() => {
    if (!creadoEn) return null
    try {
      return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-VE', { month: 'long', year: 'numeric' }).format(new Date(creadoEn))
    } catch {
      return null
    }
  })()

  return (
    <section className="dashboard-hero" aria-label={t('heroAriaLabel')}>
      <div className="dashboard-hero__identity">
        <label className="dashboard-hero__avatar group relative cursor-pointer flex-shrink-0">
          <Avatar nombre={nombre} fotoUrl={fotoUrl} size="xl" />
          {onFotoChange && (
            <>
              <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Camera size={18} className="text-white" aria-hidden="true" />
              </span>
              <input type="file" accept="image/*" onChange={onFotoChange} className="hidden" aria-label={t('changePhoto')} />
            </>
          )}
        </label>

        <div className="dashboard-hero__info">
          <div className="dashboard-hero__name-row">
            <h1>{nombre || t('noName')}</h1>
            {verificado && <BadgeVerificado size="md" />}
            <NivelBadge nivel={nivelConfianza} showNumber />
          </div>

          <div className="dashboard-hero__meta">
            {email && (
              <span className="dashboard-hero__meta-item"><Mail size={13} aria-hidden="true" /> {email}</span>
            )}
            {ubicacion && (
              <span className="dashboard-hero__meta-item"><MapPin size={13} aria-hidden="true" /> {ubicacion}</span>
            )}
            {fechaMiembro && (
              <span className="dashboard-hero__meta-item">
                <CalendarDays size={13} aria-hidden="true" /> {t('heroMemberSince', { date: fechaMiembro })}
              </span>
            )}
            {resenasCount > 0 && (
              <span className="dashboard-hero__meta-item">
                <Star size={13} className="text-yellow-500" fill="currentColor" aria-hidden="true" />
                {t('reviewsSummary', { rating: promedioResenas.toFixed(1), count: resenasCount })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-hero__actions">
        <LocalLink href="/publicar-inmueble" className="dashboard-hero__btn dashboard-hero__btn--primary">
          {t('publishPropertyAction')}
        </LocalLink>
        <LocalLink href={`/vendedor/${userId}`} className="dashboard-hero__btn" prefetch={false}>
          {t('viewPublicProfile')} <ArrowUpRight size={13} aria-hidden="true" />
        </LocalLink>
        <button type="button" onClick={() => onGoToTab('perfil')} className="dashboard-hero__btn">
          <Edit size={13} aria-hidden="true" /> {t('editProfile')}
        </button>
      </div>

      <button type="button" onClick={() => onGoToTab('creditos')} className="dashboard-hero__credits" aria-label={t('heroCreditsAria')}>
        <Coins size={15} aria-hidden="true" />
        <span className="dashboard-hero__credits-value">{creditos}</span>
        <span className="dashboard-hero__credits-label">{t('creditsLabel')}</span>
      </button>
    </section>
  )
}
