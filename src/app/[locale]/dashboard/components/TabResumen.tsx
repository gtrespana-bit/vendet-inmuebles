'use client'

import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { TrendingUp, Eye, MessageCircle, BarChart3 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

type DashboardStats = {
  activos: number
  totalVisitas: number
  mensajesNoLeidos: number
  favoritos: number
  vendidos: number
}

export default function TabResumen({ userId }: { userId: string }) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      if (!isSupabaseConfigured()) {
        setStats({ activos: 0, totalVisitas: 0, mensajesNoLeidos: 0, favoritos: 0, vendidos: 0 })
        return
      }

      try {
        const { count: activos, error: activeError } = await supabase
          .from('vw_propiedades_publicas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('activo', true)
        if (activeError) throw activeError

        const { data: properties, error: propertiesError } = await supabase
          .from('vw_propiedades_publicas')
          .select('id, visitas')
          .eq('user_id', userId)
          .eq('activo', true)
        if (propertiesError) throw propertiesError

        const totalVisitas = (properties || []).reduce((sum: number, property: { visitas?: number | null }) => sum + (property.visitas || 0), 0)
        const propertyIds = (properties || []).map((property: { id: string }) => property.id)

        const [{ count: unread, error: unreadError }, favoritesResult, { count: sold, error: soldError }] = await Promise.all([
          supabase
            .from('mensajes')
            .select('id', { count: 'exact', head: true })
            .eq('destinatario_id', userId)
            .eq('leido', false),
          propertyIds.length
            ? supabase.from('favoritos').select('id', { count: 'exact', head: true }).in('producto_id', propertyIds)
            : Promise.resolve({ count: 0, error: null }),
          supabase
            .from('inmuebles')
            .select('id', { count: 'exact', head: true })
            .eq('usuario_id', userId)
            .eq('activo', false),
        ])

        if (unreadError) throw unreadError
        if (soldError) throw soldError
        if (cancelled) return

        setStats({
          activos: activos || 0,
          totalVisitas,
          mensajesNoLeidos: unread || 0,
          favoritos: favoritesResult.count || 0,
          vendidos: sold || 0,
        })
      } catch (error) {
        console.error('[dashboard-summary] Could not load account stats:', error)
        if (!cancelled) {
          setHasError(true)
          setStats({ activos: 0, totalVisitas: 0, mensajesNoLeidos: 0, favoritos: 0, vendidos: 0 })
        }
      }
    }

    loadStats()
    return () => { cancelled = true }
  }, [userId])

  const number = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-VE')
  const cards = stats ? [
    { label: t('activeListings'), value: number.format(stats.activos), icon: BarChart3, color: 'text-[var(--burgundy)]', bg: 'bg-[var(--paper-deep)]' },
    { label: t('totalVisits'), value: number.format(stats.totalVisitas), icon: Eye, color: 'text-[#795f3f]', bg: 'bg-[#F1EDE2]' },
    { label: t('unreadMessages'), value: number.format(stats.mensajesNoLeidos), icon: MessageCircle, color: stats.mensajesNoLeidos > 0 ? 'text-[#9a524a]' : 'text-[#8a8076]', bg: stats.mensajesNoLeidos > 0 ? 'bg-[#f8e9e6]' : 'bg-[#f1ede7]' },
    { label: t('savedFavorites'), value: number.format(stats.favoritos), icon: TrendingUp, color: 'text-[#8b7046]', bg: 'bg-[#F1EDE2]' },
  ] : []

  if (!stats) {
    return (
      <div className="dashboard-panel" aria-busy="true">
        <div className="mb-5 h-5 w-44 animate-pulse bg-[#EAE6DC]" />
        <div className="dashboard-summary-cards">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse bg-[#F4F1E9]" />)}
        </div>
      </div>
    )
  }

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-recent-title">
      <div className="mb-4">
        <p className="dashboard-page__eyebrow">{t('performanceEyebrow')}</p>
        <h2 id="dashboard-recent-title" className="m-0 font-heading text-2xl font-normal text-[#1A2333]">{t('summaryTitle')}</h2>
        {hasError && <p className="mt-2 text-xs text-[#8a6256]" role="status">{t('statsUnavailable')}</p>}
      </div>

      <div className="dashboard-summary-cards">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <article key={label}>
            <div className={bg}><Icon size={17} className={color} aria-hidden="true" /></div>
            <p>{value}</p>
            <p>{label}</p>
          </article>
        ))}
      </div>

      {stats.vendidos > 0 && (
        <p className="mt-4 flex items-center gap-2 border border-[#dbe6d9] bg-[#eff4ed] px-4 py-3 text-xs text-[#526d56]">
          <strong>{number.format(stats.vendidos)}</strong> {t('soldPaused')}
        </p>
      )}
    </section>
  )
}
