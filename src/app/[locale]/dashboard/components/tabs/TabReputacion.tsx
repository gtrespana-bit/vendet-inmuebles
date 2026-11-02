"use client"

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  Reply,
  ShieldCheck,
  Star,
} from 'lucide-react'
import SellerReputation from '@/components/SellerReputation'
import { useTranslations } from 'next-intl'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import {
  computeReviewDistribution,
  type ResponseSpeedSummary,
} from '@/lib/listing-funnel'

export default function TabReputacion({
  userId,
  verificado,
  nivelConfianza,
  badgesAuto,
  resenas,
  promedioResenas,
  numPubsActivas,
  numPubsVendidas,
  creadoEn,
  ultimaActividad,
  onToast,
}: {
  userId?: string
  verificado: boolean
  nivelConfianza: number
  badgesAuto: string[]
  resenas: any[]
  promedioResenas: number
  numPubsActivas: number
  numPubsVendidas: number
  creadoEn: string | null
  ultimaActividad: string | null
  onToast?: (msg: string | null) => void
}) {
  const t = useTranslations('dashboard')
  const pathname = usePathname()
  const isEn = pathname === '/en' || pathname.startsWith('/en/')

  const [richReviews, setRichReviews] = useState<any[]>(resenas)
  const [responseSpeed, setResponseSpeed] = useState<ResponseSpeedSummary | null>(null)
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null)

  const loadEnrichedReviews = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/resenas?vendedor_id=${encodeURIComponent(userId)}`)
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json.items)) {
        setRichReviews(json.items)
        const drafts: Record<string, string> = {}
        for (const r of json.items) {
          if (r.respuesta_vendedor) drafts[r.id] = r.respuesta_vendedor
        }
        setReplyDrafts(drafts)
      }
      if (json.responseSpeed) setResponseSpeed(json.responseSpeed)
    } catch {
      // fallback a prop `resenas`
    }
  }, [userId])

  useEffect(() => {
    setRichReviews(resenas)
  }, [resenas])

  useEffect(() => {
    void loadEnrichedReviews()
  }, [loadEnrichedReviews])

  const antiguedadDias = creadoEn
    ? Math.floor((Date.now() - new Date(creadoEn).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const distribution = computeReviewDistribution(richReviews)
  const effectiveAverage = distribution.total > 0 ? distribution.average : promedioResenas

  const estrellasRender = (rating: number, size = 16) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={size}
        className={i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
      />
    ))

  function originBadge(origin?: string) {
    if (origin === 'visita_confirmada') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 text-[11px] font-semibold">
          <CalendarCheck size={11} />
          {isEn ? 'Confirmed tour' : 'Visita confirmada'}
        </span>
      )
    }
    if (origin === 'cierre_operacion') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold">
          <CheckCircle2 size={11} />
          {isEn ? 'Closed operation' : 'Operación cerrada'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold">
        <MessageSquare size={11} />
        {isEn ? 'Verified inquiry' : 'Conversación verificada'}
      </span>
    )
  }

  async function handleSaveReply(reviewId: string) {
    setSavingReplyId(reviewId)
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getSupabaseAuthHeaders()),
      }
      const text = replyDrafts[reviewId] ?? ''
      const res = await fetch('/api/resenas', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: reviewId, respuesta_vendedor: text }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        onToast?.(json.error || (isEn ? 'Could not save reply' : 'No se pudo guardar la respuesta'))
        return
      }
      setRichReviews((prev) =>
        prev.map((item) =>
          item.id === reviewId
            ? {
                ...item,
                respuesta_vendedor: json.item?.respuesta_vendedor || null,
                respuesta_en: json.item?.respuesta_en || null,
              }
            : item,
        ),
      )
      setReplyOpenId(null)
      onToast?.(isEn ? 'Official reply saved' : 'Respuesta oficial publicada')
      setTimeout(() => onToast?.(null), 3500)
    } catch {
      onToast?.(isEn ? 'Connection error' : 'Error de conexión')
    } finally {
      setSavingReplyId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Resumen: lo que otros ven */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-xl font-bold text-gray-900 m-0 flex items-center gap-2">
            <ShieldCheck size={20} className="text-brand-primary" />
            {t('yourReputation')}
          </h3>
          {responseSpeed && responseSpeed.tier !== 'insufficient_data' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-bold">
              <Clock3 size={13} />
              {isEn
                ? `Median reply: ~${
                    (responseSpeed.medianMinutes || 0) < 60
                      ? `${responseSpeed.medianMinutes} min`
                      : `${Math.round(((responseSpeed.medianMinutes || 0) / 60) * 10) / 10} h`
                  }`
                : `Respuesta mediana: ~${
                    (responseSpeed.medianMinutes || 0) < 60
                      ? `${responseSpeed.medianMinutes} min`
                      : `${Math.round(((responseSpeed.medianMinutes || 0) / 60) * 10) / 10} h`
                  }`}
            </span>
          )}
        </div>

        <SellerReputation
          nivel={nivelConfianza}
          numResenas={richReviews.length}
          promedioResenas={effectiveAverage}
          numPubsActivas={numPubsActivas}
          numPubsVendidas={numPubsVendidas}
          antiguedadDias={antiguedadDias}
          ultimaActividad={ultimaActividad}
          verificado={verificado}
          badges={badgesAuto}
          size="lg"
        />

        {distribution.total > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const cnt = distribution.countsByStar[star]
                const pct = distribution.total > 0 ? Math.round((cnt / distribution.total) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-2.5 text-xs">
                    <span className="w-8 font-bold text-gray-700">{star} ★</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-gray-500">{cnt}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="rounded-xl bg-teal-50/70 border border-teal-200 px-3 py-2 text-teal-900">
                <strong>{distribution.countsByOrigin.visita_confirmada}</strong>{' '}
                {isEn ? 'from confirmed tours' : 'por visitas confirmadas'}
              </div>
              <div className="rounded-xl bg-blue-50/70 border border-blue-200 px-3 py-2 text-blue-900">
                <strong>{distribution.countsByOrigin.conversacion}</strong>{' '}
                {isEn ? 'from verified chats' : 'por chats verificados'}
              </div>
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 px-3 py-2 text-emerald-900">
                <strong>{distribution.countsByOrigin.cierre_operacion}</strong>{' '}
                {isEn ? 'closed operations' : 'cierres de operación'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reseñas recibidas con opción de respuesta oficial */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Star size={20} className="text-yellow-400 fill-yellow-400" />
          {t('reviews')} ({richReviews.length})
        </h3>
        {richReviews.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">{t('noReviews')}</p>
        ) : (
          <div className="space-y-4">
            {richReviews.map((r: any) => (
              <div key={r.id} className="border rounded-xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      {estrellasRender(r.puntuacion, 14)}
                      <span className="text-sm font-bold ml-1">{r.puntuacion}/5</span>
                    </div>
                    {r.autor_nombre && (
                      <span className="text-xs font-semibold text-gray-700">
                        · {r.autor_nombre}
                      </span>
                    )}
                    {originBadge(r.tipo_interaccion)}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(r.creado_en).toLocaleDateString(isEn ? 'en-US' : 'es-VE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {r.producto_titulo && (
                  <p className="text-xs font-medium text-gray-500 m-0">
                    🏠 {r.producto_titulo}
                    {r.vendedor_nombre && r.vendedor_id !== userId
                      ? ` · 👤 ${r.vendedor_nombre}`
                      : ''}
                  </p>
                )}

                {r.comentario && <p className="text-sm text-gray-700 m-0">{r.comentario}</p>}

                {r.respuesta_vendedor && replyOpenId !== r.id && (
                  <div className="rounded-lg bg-[#f7f4ee] border-l-4 border-[#16294B] px-3.5 py-2.5 text-xs">
                    <p className="font-bold text-[#16294B] mb-1">
                      {isEn ? 'Your official response:' : 'Tu respuesta oficial:'}
                    </p>
                    <p className="text-gray-700 m-0">{r.respuesta_vendedor}</p>
                  </div>
                )}

                {replyOpenId === r.id ? (
                  <div className="pt-2 space-y-2">
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={replyDrafts[r.id] ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      placeholder={
                        isEn
                          ? 'Thank the client or add professional context (public on your storefront)…'
                          : 'Agradece al cliente o añade contexto profesional (visible en tu escaparate público)…'
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyOpenId(null)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        {isEn ? 'Cancel' : 'Cancelar'}
                      </button>
                      <button
                        type="button"
                        disabled={savingReplyId === r.id}
                        onClick={() => handleSaveReply(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#16294B] text-white px-3 py-1.5 text-xs font-bold hover:bg-[#0f1e38] disabled:opacity-50"
                      >
                        {savingReplyId === r.id && <Loader2 size={12} className="animate-spin" />}
                        <span>{isEn ? 'Publish reply' : 'Publicar respuesta'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setReplyOpenId(r.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#16294B] hover:underline"
                    >
                      <Reply size={13} />
                      <span>
                        {r.respuesta_vendedor
                          ? isEn
                            ? 'Edit official reply'
                            : 'Editar respuesta'
                          : isEn
                            ? 'Reply publicly'
                            : 'Responder públicamente'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estadísticas */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Activity size={20} className="text-brand-primary" />
          {t('stats')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-brand-primary">{numPubsActivas}</p>
            <p className="text-xs text-gray-500 mt-1">{t('activeListings')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-green-600">{numPubsVendidas}</p>
            <p className="text-xs text-gray-500 mt-1">{t('soldPaused')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-yellow-500">{antiguedadDias}</p>
            <p className="text-xs text-gray-500 mt-1">{t('daysOnPlatform')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-3xl font-black text-purple-600">{verificado ? '✅' : '⏳'}</p>
            <p className="text-xs text-gray-500 mt-1">{t('verification')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
