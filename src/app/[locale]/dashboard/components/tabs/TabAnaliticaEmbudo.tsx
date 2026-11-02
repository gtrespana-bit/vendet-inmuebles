'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  Award,
  BarChart3,
  CalendarCheck,
  Clock3,
  Download,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquare,
  Phone,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import {
  buildFunnelCsv,
  type AgentPerformanceRow,
  type FunnelDiagnosticCode,
  type ListingFunnelMetrics,
  type PortfolioFunnelSummary,
  type ResponseSpeedSummary,
} from '@/lib/listing-funnel'

interface TabAnaliticaEmbudoProps {
  onGoToTab?: (tab: string) => void
  onDestacar?: (target: { productId: string; titulo: string }) => void
}

export default function TabAnaliticaEmbudo({
  onGoToTab,
  onDestacar,
}: TabAnaliticaEmbudoProps) {
  const pathname = usePathname()
  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const locale: 'es' | 'en' = isEn ? 'en' : 'es'

  const [days, setDays] = useState<number>(30)
  const [loading, setLoading] = useState(true)
  const [isAgencyAdmin, setIsAgencyAdmin] = useState(false)
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [summary, setSummary] = useState<PortfolioFunnelSummary | null>(null)
  const [responseSpeed, setResponseSpeed] = useState<ResponseSpeedSummary | null>(null)
  const [items, setItems] = useState<ListingFunnelMetrics[]>([])
  const [agentNames, setAgentNames] = useState<Record<string, string>>({})
  const [byAgent, setByAgent] = useState<AgentPerformanceRow[]>([])

  const loadFunnel = useCallback(async (periodDays: number) => {
    setLoading(true)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch(`/api/analytics/mi-embudo?days=${periodDays}`, { headers })
      if (!res.ok) return
      const json = await res.json()
      setIsAgencyAdmin(Boolean(json.isAgencyAdmin))
      setAgencyName(json.agencyName || null)
      setSummary(json.summary || null)
      setResponseSpeed(json.responseSpeed || null)
      setItems(json.items || [])
      setAgentNames(json.agentNamesById || {})
      setByAgent(json.byAgent || [])
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFunnel(days)
  }, [days, loadFunnel])

  function handleExportCsv() {
    if (items.length === 0) return
    const csv = buildFunnelCsv(items, agentNames, locale)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `embudo-conversion-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function renderResponseBadge() {
    if (!responseSpeed || responseSpeed.tier === 'insufficient_data') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-medium">
          <Clock3 size={13} aria-hidden="true" />
          {isEn ? 'Response time: awaiting chats' : 'Tiempo de respuesta: esperando chats'}
        </span>
      )
    }

    const mins = responseSpeed.medianMinutes || 0
    const timeText =
      mins < 60
        ? `${mins} min`
        : `${Math.round((mins / 60) * 10) / 10} h`

    const colorClass =
      responseSpeed.tier === 'fast_under_1h'
        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        : responseSpeed.tier === 'same_day'
          ? 'bg-blue-100 text-blue-800 border border-blue-200'
          : 'bg-amber-100 text-amber-800 border border-amber-200'

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${colorClass}`}>
        <Clock3 size={13} aria-hidden="true" />
        {isEn
          ? `Median reply: ~${timeText}`
          : ` Primera respuesta mediana: ~${timeText}`}
      </span>
    )
  }

  function renderDiagnosticBadge(code: FunnelDiagnosticCode) {
    if (code === 'pending_visits') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[11px] font-bold">
          ⏳ {isEn ? 'Confirm pending visit' : 'Visita por confirmar'}
        </span>
      )
    }
    if (code === 'strong_conversion') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold">
          🔥 {isEn ? 'Strong conversion' : 'Alta conversión'}
        </span>
      )
    }
    if (code === 'high_views_low_leads') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-0.5 text-[11px] font-medium">
          💡 {isEn ? 'Review $/m² or add floor plan' : 'Revisa $/m² o añade plano/tour'}
        </span>
      )
    }
    if (code === 'high_favorites_no_visits') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-medium">
          ⭐ {isEn ? 'Saved by buyers — feature to close' : 'En favoritos — destaca para agendar'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-[11px] font-medium">
        📈 {isEn ? 'Gathering impressions' : 'Acumulando alcance'}
      </span>
    )
  }

  const maxStage = Math.max(
    1,
    summary?.effectiveViews || 0,
    summary?.favorites || 0,
    summary?.totalContacts || 0,
    summary?.visitRequests || 0,
  )

  return (
    <section className="space-y-6">
      {/* Cabecera + controles de ventana temporal y CSV */}
      <div className="bg-white rounded-2xl border border-[#e5dfd3] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#8C6526] mb-1">
              {isAgencyAdmin && agencyName
                ? `${isEn ? 'Agency Intelligence' : 'Inteligencia Comercial'} · ${agencyName}`
                : isEn
                  ? 'Conversion Funnel'
                  : 'Embudo de Conversión'}
            </p>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#16294B] m-0 flex items-center gap-2">
              <BarChart3 size={22} className="text-[#8C6526]" aria-hidden="true" />
              <span>
                {isEn
                  ? 'Listing & Lead Performance'
                  : 'Rendimiento de Publicaciones y Leads'}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
              {isEn
                ? 'Track how property views convert into saved favorites, direct WhatsApp/phone/chat inquiries, and confirmed tours.'
                : 'Mide cómo tus vistas se convierten en favoritos, contactos directos (WhatsApp, llamadas, chat) y visitas agendadas.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {renderResponseBadge()}
            <div className="inline-flex rounded-xl border border-[#dfd8cc] bg-[#f7f4ee] p-1">
              {[
                { val: 7, label: '7d' },
                { val: 30, label: '30d' },
                { val: 90, label: '90d' },
                { val: 0, label: isEn ? 'All' : 'Todo' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDays(opt.val)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    days === opt.val
                      ? 'bg-[#16294B] text-white shadow-sm'
                      : 'text-[#475569] hover:text-[#16294B]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {items.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8d2c7] bg-white hover:bg-[#f7f4ee] text-[#16294B] px-3 py-1.5 text-xs font-semibold transition"
              >
                <Download size={14} aria-hidden="true" />
                <span>{isEn ? 'Export CSV' : 'Exportar CSV'}</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[#64748B] gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span>{isEn ? 'Calculating conversion funnel…' : 'Calculando embudo de conversión…'}</span>
          </div>
        ) : summary ? (
          <>
            {/* 4 Etapas visuales del Embudo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6">
              {[
                {
                  step: '1',
                  label: isEn ? 'Property Views' : 'Vistas a fichas',
                  value: summary.effectiveViews,
                  sub: isEn
                    ? `${summary.activeListings} active listings`
                    : `${summary.activeListings} anuncios activos`,
                  icon: Eye,
                  barColor: 'bg-[#16294B]',
                },
                {
                  step: '2',
                  label: isEn ? 'Saved & Shared' : 'Favoritos y compartidos',
                  value: summary.favorites + summary.shares,
                  sub: isEn
                    ? `${summary.favorites} favorites · ${summary.shares} shares`
                    : `${summary.favorites} favoritos · ${summary.shares} compartidos`,
                  icon: Heart,
                  barColor: 'bg-[#8C6526]',
                },
                {
                  step: '3',
                  label: isEn ? 'Direct Contacts' : 'Contactos directos',
                  value: summary.totalContacts,
                  sub: `WA ${summary.whatsappClicks} · Tel ${summary.phoneClicks} · Chat ${summary.chatLeads}`,
                  icon: MessageCircle,
                  barColor: 'bg-emerald-600',
                },
                {
                  step: '4',
                  label: isEn ? 'Scheduled Tours' : 'Solicitudes de visita',
                  value: summary.visitRequests,
                  sub: isEn
                    ? `${summary.confirmedVisits} confirmed/attended`
                    : `${summary.confirmedVisits} confirmadas/atendidas`,
                  icon: CalendarCheck,
                  barColor: 'bg-indigo-600',
                },
              ].map((stage) => {
                const Icon = stage.icon
                const widthPct = Math.max(8, Math.round((stage.value / maxStage) * 100))
                return (
                  <div
                    key={stage.step}
                    className="rounded-2xl border border-[#e7dfd1] bg-[#faf8f4] p-4 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                      <span className="font-bold uppercase tracking-wider">
                        {isEn ? `Stage ${stage.step}` : `Paso ${stage.step}`}
                      </span>
                      <Icon size={16} className="text-[#16294B]" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-2xl sm:text-3xl font-black text-[#16294B] m-0">
                        {new Intl.NumberFormat(isEn ? 'en-US' : 'es-VE').format(stage.value)}
                      </p>
                      <p className="text-xs font-semibold text-[#1E293B] mt-0.5 mb-1">
                        {stage.label}
                      </p>
                      <p className="text-[11px] text-[#64748B] m-0">{stage.sub}</p>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-[#e6dfd2] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${stage.barColor}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Franja de conversión global y desglose por canal */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f4ee] border border-[#e7dfd1] px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 font-bold text-[#16294B]">
                  <TrendingUp size={15} className="text-emerald-700" aria-hidden="true" />
                  {isEn ? 'View → Lead conversion:' : 'Conversión Vista → Lead:'}{' '}
                  <strong className="text-emerald-700">{summary.viewToLeadPct}%</strong>
                </span>
                <span className="text-[#475569]">
                  {isEn ? 'Total leads captured:' : 'Leads totales captados:'}{' '}
                  <strong className="text-[#16294B]">{summary.totalLeads}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[#475569]">
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={13} className="text-emerald-600" /> WhatsApp:{' '}
                  <strong>{summary.whatsappClicks}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Phone size={13} className="text-[#16294B]" /> {isEn ? 'Calls:' : 'Llamadas:'}{' '}
                  <strong>{summary.phoneClicks}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare size={13} className="text-[#8C6526]" /> Chat:{' '}
                  <strong>{summary.chatLeads}</strong>
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Tabla de rendimiento por Asesor (exclusiva para dueños/admins de Agencia) */}
      {!loading && isAgencyAdmin && byAgent.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5dfd3] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-[#16294B] m-0 flex items-center gap-2">
                <Users size={19} className="text-[#8C6526]" aria-hidden="true" />
                <span>
                  {isEn ? 'Performance by Team Advisor' : 'Rendimiento por Asesor del Equipo'}
                </span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5 mb-0">
                {isEn
                  ? 'Active portfolio, inquiries, confirmed visits, and client rating per advisor.'
                  : 'Cartera asignada, contactos recibidos, visitas confirmadas y calificación por asesor.'}
              </p>
            </div>
            {onGoToTab && (
              <button
                type="button"
                onClick={() => onGoToTab('equipo')}
                className="text-xs font-bold text-[#16294B] hover:underline"
              >
                {isEn ? 'Manage team & portfolio →' : 'Gestionar equipo y cartera →'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#ece6da] text-[11px] uppercase tracking-wider text-[#64748B]">
                  <th className="py-2.5 pr-3">{isEn ? 'Advisor' : 'Asesor'}</th>
                  <th className="py-2.5 px-2 text-right">{isEn ? 'Active' : 'Activos'}</th>
                  <th className="py-2.5 px-2 text-right">{isEn ? 'Views' : 'Vistas'}</th>
                  <th className="py-2.5 px-2 text-right">{isEn ? 'Contacts' : 'Contactos'}</th>
                  <th className="py-2.5 px-2 text-right">{isEn ? 'Tours (Ok)' : 'Visitas (Conf.)'}</th>
                  <th className="py-2.5 px-2 text-right">{isEn ? 'Conv.' : 'Conv.'}</th>
                  <th className="py-2.5 pl-2 text-right">{isEn ? 'Rating' : 'Calificación'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3eee4]">
                {byAgent.map((ag, idx) => (
                  <tr key={ag.agentId} className="hover:bg-[#faf8f4]">
                    <td className="py-3 pr-3 font-semibold text-[#16294B] flex items-center gap-2">
                      {idx === 0 && ag.totalLeads > 0 && (
                        <Award size={14} className="text-[#8C6526] shrink-0" aria-hidden="true" />
                      )}
                      <span>{ag.agentName}</span>
                    </td>
                    <td className="py-3 px-2 text-right font-medium">{ag.activeListings}</td>
                    <td className="py-3 px-2 text-right">{ag.effectiveViews}</td>
                    <td className="py-3 px-2 text-right font-semibold text-emerald-700">
                      {ag.totalContacts}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {ag.visitRequests}{' '}
                      <span className="text-[11px] text-[#64748B]">({ag.confirmedVisits})</span>
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-[#16294B]">
                      {ag.viewToLeadPct}%
                    </td>
                    <td className="py-3 pl-2 text-right">
                      {ag.reviewCount > 0 ? (
                        <span className="inline-flex items-center justify-end gap-1 font-semibold text-[#8C6526]">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          {ag.averageRating.toFixed(1)} ({ag.reviewCount})
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Desglose accionable por Inmueble */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-[#e5dfd3] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-lg font-extrabold text-[#16294B] m-0 flex items-center gap-2">
              <Activity size={19} className="text-[#8C6526]" aria-hidden="true" />
              <span>{isEn ? 'Funnel by Property' : 'Embudo por Inmueble'}</span>
            </h3>
            <span className="text-xs text-[#64748B]">
              {items.length} {isEn ? 'listings analyzed' : 'publicaciones analizadas'}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 text-sm text-[#64748B]">
              <p className="mb-3">
                {isEn
                  ? 'Publish your first property to start measuring views, favorites, WhatsApp clicks, and scheduled tours.'
                  : 'Publica tu primer inmueble para medir vistas, favoritos, clics a WhatsApp y solicitudes de visita.'}
              </p>
              <LocalLink
                href="/publicar-inmueble"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16294B] text-white px-4 py-2.5 text-xs font-bold no-underline"
              >
                {isEn ? 'Publish property' : 'Publicar inmueble'}
              </LocalLink>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const target = `/inmueble/${item.slug || item.propertyId}`
                const advisorName = agentNames[item.assignedAgentId]
                return (
                  <article
                    key={item.propertyId}
                    className="rounded-xl border border-[#eae3d5] p-4 hover:border-[#cbbd9f] transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {renderDiagnosticBadge(item.diagnostic)}
                          {item.featured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-[#8C6526] border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
                              <Sparkles size={10} /> {isEn ? 'Featured' : 'Destacado'}
                            </span>
                          )}
                          {isAgencyAdmin && advisorName && (
                            <span className="rounded-full bg-[#16294B]/10 text-[#16294B] px-2.5 py-0.5 text-[11px] font-semibold">
                              👤 {advisorName}
                            </span>
                          )}
                        </div>

                        <LocalLink
                          href={target}
                          className="text-sm sm:text-base font-bold text-[#16294B] hover:underline inline-flex items-center gap-1 no-underline"
                        >
                          <span className="truncate">{item.title}</span>
                          <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
                        </LocalLink>
                        <p className="text-xs text-[#64748B] mt-0.5 mb-0">
                          {[item.city, item.state].filter(Boolean).join(', ') || 'Venezuela'}
                          {item.price > 0
                            ? ` · $${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(item.price)}`
                            : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {item.pendingVisits > 0 && onGoToTab && (
                          <button
                            type="button"
                            onClick={() => onGoToTab('visitas')}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 text-xs font-bold transition"
                          >
                            <CalendarCheck size={13} />
                            <span>
                              {isEn
                                ? `Confirm (${item.pendingVisits})`
                                : `Confirmar cita (${item.pendingVisits})`}
                            </span>
                          </button>
                        )}
                        {item.active && !item.featured && onDestacar && (
                          <button
                            type="button"
                            onClick={() =>
                              onDestacar({ productId: item.propertyId, titulo: item.title })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-[#d8d2c7] bg-[#faf8f4] hover:bg-[#f1ece1] text-[#16294B] px-2.5 py-1.5 text-xs font-semibold transition"
                          >
                            <Sparkles size={12} className="text-[#8C6526]" />
                            <span>{isEn ? 'Feature' : 'Destacar'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3 border-t border-[#f2ede3] text-xs">
                      <div>
                        <span className="text-[#64748B] block text-[11px]">
                          {isEn ? 'Views' : 'Vistas'}
                        </span>
                        <strong className="text-[#16294B]">{item.effectiveViews}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[11px]">
                          {isEn ? 'Favorites' : 'Favoritos'}
                        </span>
                        <strong className="text-[#16294B]">{item.favorites}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[11px]">WhatsApp / Tel</span>
                        <strong className="text-emerald-700">
                          {item.whatsappClicks} / {item.phoneClicks}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[11px]">
                          {isEn ? 'Chats & Visits' : 'Chats y Visitas'}
                        </span>
                        <strong className="text-[#16294B]">
                          {Math.max(item.conversationsStarted, item.chatClicks)} /{' '}
                          {item.visitRequests}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[11px]">
                          {isEn ? 'Conversion' : 'Conversión'}
                        </span>
                        <strong className="text-[#8C6526]">{item.viewToLeadPct}%</strong>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
