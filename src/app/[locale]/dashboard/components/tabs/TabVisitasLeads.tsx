'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Video,
  XCircle,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { isOptimizableImageSrc } from '@/lib/image-src'

interface VisitaItem {
  id: string
  inmueble_id: string
  nombre_contacto: string
  telefono_contacto: string
  email_contacto: string | null
  modalidad: 'presencial' | 'videollamada' | 'llamada'
  fecha_preferida: string | null
  franja_horaria: string
  mensaje: string | null
  estado: 'pendiente' | 'confirmada' | 'atendida' | 'cancelada'
  nota_vendedor: string | null
  creado_en: string
  inmueble: {
    id: string
    titulo: string
    slug?: string | null
    imagen_url?: string | null
    precio?: number | null
    moneda?: string | null
    ciudad?: string | null
    estado?: string | null
    zona?: string | null
  } | null
}

function buildWhatsAppReplyHref(phone: string, contactName: string, propertyTitle: string, isEn: boolean): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length < 7) return null
  const intl = digits.startsWith('0') && digits.length === 11 ? `58${digits.slice(1)}` : digits
  const msg = isEn
    ? `Hi ${contactName}, I received your visit request for "${propertyTitle}" on Venezuela Inmuebles. Let's coordinate the schedule!`
    : `Hola ${contactName}, recibí tu solicitud de visita para «${propertyTitle}» en Venezuela Inmuebles. ¡Coordinemos el horario!`
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
}

export default function TabVisitasLeads({
  onToast,
}: {
  onToast?: (msg: string | null) => void
}) {
  const locale = useLocale()
  const isEn = locale === 'en'

  const [items, setItems] = useState<VisitaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'todas' | 'pendiente' | 'confirmada' | 'atendida' | 'cancelada'>('todas')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/visitas', {
        headers: await getSupabaseAuthHeaders(),
      })
      if (!res.ok) return
      const json = await res.json()
      const loaded: VisitaItem[] = Array.isArray(json.items) ? json.items : []
      setItems(loaded)
      const drafts: Record<string, string> = {}
      for (const row of loaded) {
        drafts[row.id] = row.nota_vendedor || ''
      }
      setNotesDraft(drafts)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  async function updateVisit(id: string, payload: { estado?: VisitaItem['estado']; nota_vendedor?: string }) {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/visitas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getSupabaseAuthHeaders()),
        },
        body: JSON.stringify({ id, ...payload }),
      })
      if (!res.ok) throw new Error('Error')
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(payload.estado ? { estado: payload.estado } : {}),
                ...(payload.nota_vendedor !== undefined ? { nota_vendedor: payload.nota_vendedor } : {}),
              }
            : item,
        ),
      )
      if (onToast) {
        onToast(isEn ? 'Visit status updated' : 'Solicitud actualizada')
        setTimeout(() => onToast(null), 3000)
      }
    } catch {
      if (onToast) {
        onToast(isEn ? 'Could not update request' : 'No se pudo actualizar la solicitud')
        setTimeout(() => onToast(null), 3000)
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = filter === 'todas' ? items : items.filter((i) => i.estado === filter)
  const pendingCount = items.filter((i) => i.estado === 'pendiente').length

  const slotLabel = (slot: string) => {
    const mapEs: Record<string, string> = {
      manana: 'Mañana',
      tarde: 'Tarde',
      fin_de_semana: 'Fin de semana',
      flexible: 'Horario flexible',
    }
    const mapEn: Record<string, string> = {
      manana: 'Morning',
      tarde: 'Afternoon',
      fin_de_semana: 'Weekend',
      flexible: 'Flexible',
    }
    return (isEn ? mapEn[slot] : mapEs[slot]) || slot
  }

  const statusBadge = (estado: VisitaItem['estado']) => {
    switch (estado) {
      case 'confirmada':
        return 'bg-blue-100 text-blue-800'
      case 'atendida':
        return 'bg-emerald-100 text-emerald-800'
      case 'cancelada':
        return 'bg-slate-200 text-slate-600'
      default:
        return 'bg-amber-100 text-amber-900'
    }
  }

  const statusLabel = (estado: VisitaItem['estado']) => {
    const es: Record<VisitaItem['estado'], string> = {
      pendiente: 'Pendiente',
      confirmada: 'Confirmada',
      atendida: 'Atendida',
      cancelada: 'Cancelada',
    }
    const en: Record<VisitaItem['estado'], string> = {
      pendiente: 'Pending',
      confirmada: 'Confirmed',
      atendida: 'Completed',
      cancelada: 'Cancelled',
    }
    return isEn ? en[estado] : es[estado]
  }

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-visits-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dashboard-page__eyebrow">{isEn ? 'Leads & appointments' : 'Agenda comercial'}</p>
          <h2 id="dashboard-visits-title" className="m-0 font-heading text-2xl font-normal text-[#1A2333]">
            {isEn ? 'Scheduled visits & inquiries' : 'Solicitudes de visita y leads'}
          </h2>
          <p className="text-xs text-[#64748B] mt-1 mb-0">
            {isEn
              ? 'Manage visit requests received on your properties or assigned agency listings.'
              : 'Gestiona las citas presenciales y videollamadas solicitadas sobre tus inmuebles o cartera asignada.'}
          </p>
        </div>

        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold">
            <Clock3 size={13} aria-hidden="true" />
            {pendingCount} {isEn ? 'pending' : pendingCount === 1 ? 'pendiente' : 'pendientes'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {(['todas', 'pendiente', 'confirmada', 'atendida', 'cancelada'] as const).map((key) => {
          const labelsEs = {
            todas: 'Todas',
            pendiente: 'Pendientes',
            confirmada: 'Confirmadas',
            atendida: 'Atendidas',
            cancelada: 'Canceladas',
          }
          const labelsEn = {
            todas: 'All',
            pendiente: 'Pending',
            confirmada: 'Confirmed',
            atendida: 'Completed',
            cancelada: 'Cancelled',
          }
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                active
                  ? 'bg-[#16294B] text-white border-[#16294B]'
                  : 'bg-white text-[#475569] border-[#e2dcd1] hover:border-[#16294B]'
              }`}
            >
              {isEn ? labelsEn[key] : labelsEs[key]}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">
          <Loader2 size={22} className="animate-spin mx-auto mb-2" />
          {isEn ? 'Loading visit requests…' : 'Cargando solicitudes de visita…'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#e6dfd3] bg-[#faf8f4] p-8 text-center">
          <CalendarCheck size={32} className="mx-auto mb-3 text-[#8C6526]" aria-hidden="true" />
          <h3 className="font-heading text-lg font-normal text-[#16294B] mb-1">
            {isEn ? 'No visit requests in this view' : 'Aún no hay solicitudes en esta vista'}
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-0">
            {isEn
              ? 'Buyers can schedule in-person visits or video tours directly from each property page without mandatory sign-up.'
              : 'Los interesados pueden solicitar visitas presenciales o videollamadas directamente desde la ficha de cada inmueble, incluso sin tener cuenta.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const propTitle = item.inmueble?.titulo || (isEn ? 'Property' : 'Inmueble')
            const propHref = `/inmueble/${item.inmueble?.slug || item.inmueble_id}`
            const propImg = item.inmueble?.imagen_url || '/sinimagen.webp'
            const waHref = buildWhatsAppReplyHref(
              item.telefono_contacto,
              item.nombre_contacto,
              propTitle,
              isEn,
            )

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e6dfd3] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <LocalLink
                      href={propHref}
                      className="relative h-16 w-20 shrink-0 rounded-xl overflow-hidden bg-slate-100"
                    >
                      <Image
                        src={propImg}
                        alt=""
                        fill
                        sizes="80px"
                        unoptimized={!isOptimizableImageSrc(propImg)}
                        className="object-cover"
                      />
                    </LocalLink>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(item.estado)}`}
                        >
                          {statusLabel(item.estado)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f1ea] px-2.5 py-0.5 text-[11px] font-semibold text-[#16294B]">
                          {item.modalidad === 'videollamada' ? (
                            <Video size={12} />
                          ) : item.modalidad === 'llamada' ? (
                            <Phone size={12} />
                          ) : (
                            <MapPin size={12} />
                          )}
                          {item.modalidad === 'videollamada'
                            ? isEn
                              ? 'Video tour'
                              : 'Videollamada'
                            : item.modalidad === 'llamada'
                              ? isEn
                                ? 'Phone call'
                                : 'Llamada'
                              : isEn
                                ? 'In-person visit'
                                : 'Visita presencial'}
                        </span>
                      </div>

                      <LocalLink
                        href={propHref}
                        className="font-bold text-sm text-[#16294B] hover:underline block truncate no-underline"
                      >
                        {propTitle}
                      </LocalLink>

                      <p className="text-xs text-[#334155] mt-1 mb-0">
                        <strong>{item.nombre_contacto}</strong> · {item.telefono_contacto}
                        {item.fecha_preferida ? ` · 📅 ${item.fecha_preferida}` : ''} ·{' '}
                        {slotLabel(item.franja_horaria)}
                      </p>

                      {item.mensaje && (
                        <p className="mt-2 rounded-xl bg-[#faf8f4] border border-[#ece6da] px-3 py-2 text-xs text-[#334155] mb-0">
                          “{item.mensaje}”
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 no-underline transition"
                      >
                        <MessageCircle size={14} aria-hidden="true" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <a
                      href={`tel:${item.telefono_contacto.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#d8d2c7] bg-white hover:bg-slate-50 text-[#16294B] text-xs font-semibold px-3 py-2 no-underline"
                    >
                      <Phone size={13} aria-hidden="true" />
                      <span>{isEn ? 'Call' : 'Llamar'}</span>
                    </a>
                    {item.email_contacto && (
                      <a
                        href={`mailto:${item.email_contacto}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#d8d2c7] bg-white hover:bg-slate-50 text-[#16294B] text-xs font-semibold px-3 py-2 no-underline"
                      >
                        <Mail size={13} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#f0ebe1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={updatingId === item.id || item.estado === 'confirmada'}
                      onClick={() => updateVisit(item.id, { estado: 'confirmada' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                    >
                      <CalendarCheck size={12} /> {isEn ? 'Confirm' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item.id || item.estado === 'atendida'}
                      onClick={() => updateVisit(item.id, { estado: 'atendida' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} /> {isEn ? 'Mark completed' : 'Marcar atendida'}
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === item.id || item.estado === 'cancelada'}
                      onClick={() => updateVisit(item.id, { estado: 'cancelada' })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                    >
                      <XCircle size={12} /> {isEn ? 'Cancel' : 'Cancelar'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <input
                      type="text"
                      maxLength={500}
                      value={notesDraft[item.id] ?? ''}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder={isEn ? 'Private note…' : 'Nota privada de seguimiento…'}
                      className="flex-1 rounded-lg border border-[#dfd8cc] px-2.5 py-1 text-xs"
                    />
                    <button
                      type="button"
                      disabled={updatingId === item.id}
                      onClick={() =>
                        updateVisit(item.id, { nota_vendedor: notesDraft[item.id] ?? '' })
                      }
                      className="rounded-lg bg-[#16294B] text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-[#0f1e38] disabled:opacity-50"
                    >
                      {isEn ? 'Save' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
