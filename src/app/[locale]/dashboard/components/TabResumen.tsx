'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import {
  PlusCircle, MessageSquare, Coins, ShieldCheck,
  AlertCircle, ArrowRight, Eye,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * Tab «Inicio»: accesos rápidos + pendientes que requieren atención.
 * NO muestra estadísticas de rendimiento de anuncios (viven en «Mis inmuebles»).
 */
export default function TabResumen({
  userId,
  productos,
  verificado,
  onGoToTab,
}: {
  userId: string
  productos: any[]
  verificado: boolean
  onGoToTab: (tab: string) => void
}) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!isSupabaseConfigured()) return

    supabase
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario_id', userId)
      .eq('leido', false)
      .then(({ count }: { count: number | null }) => {
        if (!cancelled) setMensajesNoLeidos(count || 0)
      })

    return () => { cancelled = true }
  }, [userId])

  const pendientes = productos.filter((p: any) => p.estado_moderacion === 'pendiente')
  const recientes = productos.slice(0, 3)

  const atencionItems = [
    mensajesNoLeidos > 0 && {
      id: 'mensajes',
      icon: MessageSquare,
      texto: t('attentionMessages', { count: mensajesNoLeidos }),
      accion: () => onGoToTab('mensajes'),
      color: 'text-[#9a524a]',
      bg: 'bg-[#f8e9e6]',
    },
    pendientes.length > 0 && {
      id: 'moderacion',
      icon: AlertCircle,
      texto: t('attentionModeration', { count: pendientes.length }),
      accion: () => onGoToTab('productos'),
      color: 'text-[#8b7046]',
      bg: 'bg-[#F1EDE2]',
    },
    !verificado && {
      id: 'verificacion',
      icon: ShieldCheck,
      texto: t('attentionVerify'),
      accion: () => onGoToTab('verificacion'),
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
  ].filter(Boolean) as { id: string; icon: any; texto: string; accion: () => void; color: string; bg: string }[]

  const accesos = [
    { href: '/publicar-inmueble', icon: PlusCircle, title: t('quickPublishTitle'), desc: t('quickPublishDesc') },
    { onClick: () => onGoToTab('mensajes'), icon: MessageSquare, title: t('quickMessagesTitle'), desc: t('quickMessagesDesc') },
    { onClick: () => onGoToTab('creditos'), icon: Coins, title: t('quickCreditsTitle'), desc: t('quickCreditsDesc') },
    ...(verificado ? [] : [{ onClick: () => onGoToTab('verificacion'), icon: ShieldCheck, title: t('quickVerifyTitle'), desc: t('quickVerifyDesc') }]),
  ]

  const dateLocale = locale === 'en' ? 'en-US' : 'es-VE'

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-home-title">
      <div className="mb-5">
        <p className="dashboard-page__eyebrow">{t('screenEyebrow')}</p>
        <h2 id="dashboard-home-title" className="m-0 font-heading text-2xl font-normal text-[#1A2333]">{t('homeTitle')}</h2>
      </div>

      {/* Accesos rápidos */}
      <div className="dashboard-quick-actions">
        {accesos.map((a) => {
          const inner = (
            <>
              <div className="dashboard-quick-actions__icon"><a.icon size={18} aria-hidden="true" /></div>
              <div>
                <p className="dashboard-quick-actions__title">{a.title}</p>
                <p className="dashboard-quick-actions__desc">{a.desc}</p>
              </div>
              <ArrowRight size={15} className="dashboard-quick-actions__arrow" aria-hidden="true" />
            </>
          )
          return a.href ? (
            <LocalLink key={a.title} href={a.href} className="dashboard-quick-actions__card">{inner}</LocalLink>
          ) : (
            <button key={a.title} type="button" onClick={a.onClick} className="dashboard-quick-actions__card text-left w-full">{inner}</button>
          )
        })}
      </div>

      {/* Pendientes de atención */}
      {atencionItems.length > 0 && (
        <div className="dashboard-attention" role="status">
          <h3 className="dashboard-attention__title">
            <AlertCircle size={14} aria-hidden="true" /> {t('attentionTitle')}
          </h3>
          <div className="dashboard-attention__list">
            {atencionItems.map((item) => (
              <button key={item.id} type="button" onClick={item.accion} className="dashboard-attention__item">
                <span className={`dashboard-attention__icon ${item.bg} ${item.color}`}><item.icon size={15} aria-hidden="true" /></span>
                <span className="dashboard-attention__text">{item.texto}</span>
                <ArrowRight size={14} className="dashboard-attention__arrow" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Últimos inmuebles (acceso rápido, no estadísticas) */}
      {recientes.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="m-0 text-sm font-bold text-[#3d3630]">{t('recentTitle')}</h3>
            <button type="button" onClick={() => onGoToTab('productos')} className="text-xs font-bold text-[var(--burgundy)] hover:underline">
              {t('viewAllListings')} →
            </button>
          </div>
          <div className="dashboard-recent-list">
            {recientes.map((p: any) => (
              <div key={p.id} className="dashboard-recent-row">
                <div className="dashboard-recent-row__media">
                  {p.main_image_url ? (
                    <Image src={p.main_image_url} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <span aria-hidden="true">🏠</span>
                  )}
                </div>
                <div className="dashboard-recent-row__info">
                  <p className="dashboard-recent-row__title">{p.titulo}</p>
                  <p className="dashboard-recent-row__meta">
                    <Eye size={11} aria-hidden="true" /> {numberFormatFallback(p.visitas, dateLocale)}
                    {' · '}
                    <span className={
                      p.vendido ? 'text-emerald-700' :
                      p.estado_moderacion === 'pendiente' ? 'text-amber-700' :
                      p.activo ? 'text-[#526d56]' : 'text-[#8a8076]'
                    }>
                      {p.vendido ? t('propertySold') :
                        p.estado_moderacion === 'pendiente' ? t('filterPending') :
                        p.activo ? t('propertyActive') : t('propertyPaused')}
                    </span>
                  </p>
                </div>
                <button type="button" onClick={() => onGoToTab('productos')} className="dashboard-recent-row__cta">
                  {t('manageProperty')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function numberFormatFallback(value: unknown, locale: string): string {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat(locale).format(n)
  } catch {
    return String(n)
  }
}
