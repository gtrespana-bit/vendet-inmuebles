'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  UserCheck,
  Video,
  XCircle,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { isOptimizableImageSrc } from '@/lib/image-src'
import {
  buildGoogleCalendarUrl,
  buildVisitIcsContent,
  buildVisitsCsv,
} from '@/lib/visit-calendar'

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
  agente_nombre?: string | null
  asesor_contacto?: {
    nombre: string | null
    telefono: string | null
  } | null
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

function buildWhatsAppReplyHref(
  phone: string,
  contactName: string,
  propertyTitle: string,
  isEn: boolean,
  isBuyerToAdvisor = false,
): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length < 7) return null
  const intl = digits.startsWith('0') && digits.length === 11 ? `58${digits.slice(1)}` : digits
  const msg = isBuyerToAdvisor
    ? isEn
      ? `Hi${contactName ? ` ${contactName}` : ''}, I requested a visit for "${propertyTitle}" on Venezuela Inmuebles and wanted to confirm the schedule.`
      : `Hola${contactName ? ` ${contactName}` : ''}, solicité una visita para «${propertyTitle}» en Venezuela Inmuebles y quería coordinar el horario.`
    : isEn
      ? `Hi ${contactName}, I received your visit request for "${propertyTitle}" on Venezuela Inmuebles. Let's coordinate the schedule!`
      : `Hola ${contactName}, recibí tu solicitud de visita para «${propertyTitle}» en Venezuela Inmuebles. ¡Coordinemos el horario!`
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function TabVisitasLeads({
  onToast,
  onStatusChange,
}: {
  onToast?: (msg: string | null) => void
  onStatusChange?: () => void
}) {
  const locale = useLocale()
  const isEn = locale === 'en'

  const [viewMode, setViewMode] = useState<'received' | 'sent'>('received')
  const [items, setItems] = useState<VisitaItem[]>([])
  const [sentItems, setSentItems] = useState<VisitaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<
    'todas' | 'pendiente' | 'confirmada' | 'atendida' | 'cancelada'
  >('todas')
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
      const loadedReceived: VisitaItem[] = Array.isArray(json.items) ? json.items : []
      const loadedSent: VisitaItem[] = Array.isArray(json.sentItems) ? json.sentItems : []
      setItems(loadedReceived)
      setSentItems(loadedSent)
      if (loadedReceived.length === 0 && loadedSent.length > 0) {
        setViewMode('sent')
      }
      const drafts: Record<string, string> = {}
      for (const row of loadedReceived) {
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

  const [reviewOpenVisitId, setReviewOpenVisitId] = useState<string | null>(null)
  const [reviewScore, setReviewScore] = useState<number>(5)
  const [reviewComment, setReviewComment] = useState<string>('')
  const [submittingReview, setSubmittingReview] = useState<boolean>(false)
  const [reviewedVisitIds, setReviewedVisitIds] = useState<Record<string, boolean>>({})

  async function submitVisitReview(item: VisitaItem) {
    if (submittingReview) return
    setSubmittingReview(true)
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getSupabaseAuthHeaders()),
      }
      const res = await fetch('/api/resenas', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          producto_id: item.inmueble_id,
          puntuacion: reviewScore,
          comentario: reviewComment.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) {
          setReviewedVisitIds((prev) => ({ ...prev, [item.id]: true }))
          setReviewOpenVisitId(null)
        }
        onToast?.(
          json.error ||
            (isEn ? 'Could not submit verified review' : 'No se pudo registrar la calificación'),
        )
        return
      }
      setReviewedVisitIds((prev) => ({ ...prev, [item.id]: true }))
      setReviewOpenVisitId(null)
      setReviewComment('')
      setReviewScore(5)
      onToast?.(
        isEn
          ? '⭐ Thank you! Your verified tour review has been published.'
          : '⭐ ¡Gracias! Tu reseña de visita confirmada ya es pública.',
      )
      setTimeout(() => onToast?.(null), 4000)
    } catch {
      onToast?.(isEn ? 'Connection error' : 'Error de conexión')
    } finally {
      setSubmittingReview(false)
    }
  }

  async function updateVisit(
    id: string,
    payload: { estado?: VisitaItem['estado']; nota_vendedor?: string },
    targetList: 'received' | 'sent' = 'received',
  ) {
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

      const applyPatch = (list: VisitaItem[]) =>
        list.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(payload.estado ? { estado: payload.estado } : {}),
                ...(payload.nota_vendedor !== undefined
                  ? { nota_vendedor: payload.nota_vendedor }
                  : {}),
              }
            : item,
        )

      if (targetList === 'sent') {
        setSentItems(applyPatch)
      } else {
        setItems(applyPatch)
      }

      if (onStatusChange && payload.estado) {
        onStatusChange()
      }
      if (onToast) {
        onToast(
          payload.estado === 'confirmada'
            ? isEn
              ? 'Visit confirmed & buyer notified'
              : 'Visita confirmada y comprador notificado'
            : isEn
              ? 'Visit status updated'
              : 'Solicitud actualizada',
        )
        setTimeout(() => onToast(null), 3500)
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

  const modalityLabel = (mod: VisitaItem['modalidad']) => {
    if (mod === 'videollamada') return isEn ? 'Video tour' : 'Videollamada'
    if (mod === 'llamada') return isEn ? 'Phone call' : 'Llamada'
    return isEn ? 'In-person visit' : 'Visita presencial'
  }

  const activeList = viewMode === 'sent' ? sentItems : items
  const filtered = filter === 'todas' ? activeList : activeList.filter((i) => i.estado === filter)
  const pendingCount = items.filter((i) => i.estado === 'pendiente').length

  function handleExportCsv() {
    if (items.length === 0) return
    const csv = buildVisitsCsv(
      items.map((item) => ({
        createdAt: item.creado_en?.slice(0, 16).replace('T', ' ') || '',
        status: statusLabel(item.estado),
        propertyTitle: item.inmueble?.titulo || item.inmueble_id,
        location: [item.inmueble?.zona, item.inmueble?.ciudad, item.inmueble?.estado]
          .filter(Boolean)
          .join(', '),
        modality: modalityLabel(item.modalidad),
        preferredDate: item.fecha_preferida,
        timeSlot: slotLabel(item.franja_horaria),
        contactName: item.nombre_contacto,
        contactPhone: item.telefono_contacto,
        contactEmail: item.email_contacto,
        assignedAgent: item.agente_nombre,
        message: item.mensaje,
        sellerNote: item.nota_vendedor,
      })),
      isEn ? 'en' : 'es',
    )
    const today = new Date().toISOString().slice(0, 10)
    downloadTextFile(`visitas-leads-${today}.csv`, csv, 'text/csv;charset=utf-8')
  }

  function handleDownloadIcs(item: VisitaItem, counterparty: string | null) {
    if (!item.fecha_preferida) return
    const propTitle = item.inmueble?.titulo || (isEn ? 'Property' : 'Inmueble')
    const slugOrId = item.inmueble?.slug || item.inmueble_id
    const propUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${isEn ? '/en' : ''}/inmueble/${slugOrId}`
        : `https://venezuela-inmuebles.online/inmueble/${slugOrId}`
    const location = [item.inmueble?.zona, item.inmueble?.ciudad, item.inmueble?.estado]
      .filter(Boolean)
      .join(', ')

    const ics = buildVisitIcsContent({
      id: item.id,
      propertyTitle: propTitle,
      propertyUrl: propUrl,
      location: location || 'Venezuela',
      modalidad: item.modalidad,
      fechaPreferida: item.fecha_preferida,
      franjaHoraria: item.franja_horaria,
      counterpartyName: counterparty,
      notes: item.nota_vendedor || item.mensaje,
      locale: isEn ? 'en' : 'es',
    })
    if (!ics) return
    downloadTextFile(`visita-${item.fecha_preferida}.ics`, ics, 'text/calendar;charset=utf-8')
  }

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-visits-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dashboard-page__eyebrow">
            {isEn ? 'Leads & appointments' : 'Agenda comercial y visitas'}
          </p>
          <h2
            id="dashboard-visits-title"
            className="m-0 font-heading text-2xl font-normal text-[#1A2333]"
          >
            {isEn ? 'Scheduled visits & inquiries' : 'Solicitudes de visita y leads'}
          </h2>
          <p className="text-xs text-[#64748B] mt-1 mb-0">
            {isEn
              ? 'Manage buyer leads on your properties or track visits you have requested.'
              : 'Gestiona los leads de tus anuncios o haz seguimiento a las visitas que solicitaste como comprador.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold">
              <Clock3 size={13} aria-hidden="true" />
              {pendingCount} {isEn ? 'pending' : pendingCount === 1 ? 'pendiente' : 'pendientes'}
            </span>
          )}

          {viewMode === 'received' && items.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8d2c7] bg-white hover:bg-[#f7f4ee] px-3 py-1.5 text-xs font-semibold text-[#16294B] transition"
            >
              <Download size={13} aria-hidden="true" />
              <span>{isEn ? 'Export CSV' : 'Exportar CSV'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Selector de bandeja: Leads recibidos vs. Mis visitas agendadas */}
      <div className="inline-flex rounded-xl bg-[#f4f1ea] p-1 mb-4">
        <button
          type="button"
          onClick={() => {
            setViewMode('received')
            setFilter('todas')
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
            viewMode === 'received'
              ? 'bg-[#16294B] text-white shadow-sm'
              : 'text-[#475569] hover:text-[#16294B]'
          }`}
        >
          <span>{isEn ? 'Received leads' : 'Leads recibidos'}</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              viewMode === 'received' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#475569]'
            }`}
          >
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('sent')
            setFilter('todas')
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
            viewMode === 'sent'
              ? 'bg-[#16294B] text-white shadow-sm'
              : 'text-[#475569] hover:text-[#16294B]'
          }`}
        >
          <span>{isEn ? 'My scheduled visits' : 'Mis visitas agendadas'}</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              viewMode === 'sent' ? 'bg-white/20 text-white' : 'bg-black/5 text-[#475569]'
            }`}
          >
            {sentItems.length}
          </span>
        </button>
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
            {viewMode === 'sent'
              ? isEn
                ? 'You have not scheduled any visits yet'
                : 'Aún no has agendado visitas como comprador'
              : isEn
                ? 'No visit requests in this view'
                : 'Aún no hay solicitudes en esta vista'}
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-4">
            {viewMode === 'sent'
              ? isEn
                ? 'Open any property listing and choose your preferred day and time to request an in-person tour or video call.'
                : 'Entra en la ficha de cualquier inmueble que te interese y elige día y horario para solicitar una visita presencial o videollamada.'
              : isEn
                ? 'Buyers can schedule in-person visits or video tours directly from each property page without mandatory sign-up.'
                : 'Los interesados pueden solicitar visitas presenciales o videollamadas directamente desde la ficha de cada inmueble, incluso sin tener cuenta.'}
          </p>
          {viewMode === 'sent' && (
            <LocalLink
              href="/catalogo"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#16294B] text-white text-xs font-bold px-4 py-2.5 no-underline hover:bg-[#0f1e38] transition"
            >
              {isEn ? 'Browse properties' : 'Explorar inmuebles'}
            </LocalLink>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const propTitle = item.inmueble?.titulo || (isEn ? 'Property' : 'Inmueble')
            const propHref = `/inmueble/${item.inmueble?.slug || item.inmueble_id}`
            const propImg = item.inmueble?.imagen_url || '/sinimagen.webp'
            const propLocation = [
              item.inmueble?.zona,
              item.inmueble?.ciudad,
              item.inmueble?.estado,
            ]
              .filter(Boolean)
              .join(', ')

            const isSentView = viewMode === 'sent'
            const advisorPhone = item.asesor_contacto?.telefono || null
            const advisorName = item.asesor_contacto?.nombre || null

            const waHref = isSentView
              ? advisorPhone
                ? buildWhatsAppReplyHref(advisorPhone, advisorName || '', propTitle, isEn, true)
                : null
              : buildWhatsAppReplyHref(
                  item.telefono_contacto,
                  item.nombre_contacto,
                  propTitle,
                  isEn,
                  false,
                )

            const gcalHref = item.fecha_preferida
              ? buildGoogleCalendarUrl({
                  id: item.id,
                  propertyTitle: propTitle,
                  propertyUrl: `https://venezuela-inmuebles.online${propHref}`,
                  location: propLocation || 'Venezuela',
                  modalidad: item.modalidad,
                  fechaPreferida: item.fecha_preferida,
                  franjaHoraria: item.franja_horaria,
                  counterpartyName: isSentView ? advisorName : item.nombre_contacto,
                  notes: item.nota_vendedor || item.mensaje,
                  locale: isEn ? 'en' : 'es',
                })
              : null

            return (
              <article
                key={`${viewMode}-${item.id}`}
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
                          {modalityLabel(item.modalidad)}
                        </span>
                        {!isSentView && item.agente_nombre && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-800 px-2.5 py-0.5 text-[11px] font-semibold">
                            <UserCheck size={11} aria-hidden="true" />
                            {item.agente_nombre}
                          </span>
                        )}
                      </div>

                      <LocalLink
                        href={propHref}
                        className="font-bold text-sm text-[#16294B] hover:underline block truncate no-underline"
                      >
                        {propTitle}
                      </LocalLink>

                      {isSentView ? (
                        <p className="text-xs text-[#334155] mt-1 mb-0">
                          {advisorName && (
                            <>
                              <strong>{isEn ? 'Advisor:' : 'Asesor:'}</strong> {advisorName} ·{' '}
                            </>
                          )}
                          {item.fecha_preferida ? `📅 ${item.fecha_preferida} · ` : ''}
                          {slotLabel(item.franja_horaria)}
                        </p>
                      ) : (
                        <p className="text-xs text-[#334155] mt-1 mb-0">
                          <strong>{item.nombre_contacto}</strong> · {item.telefono_contacto}
                          {item.fecha_preferida ? ` · 📅 ${item.fecha_preferida}` : ''} ·{' '}
                          {slotLabel(item.franja_horaria)}
                        </p>
                      )}

                      {item.mensaje && (
                        <p className="mt-2 rounded-xl bg-[#faf8f4] border border-[#ece6da] px-3 py-2 text-xs text-[#334155] mb-0">
                          “{item.mensaje}”
                        </p>
                      )}

                      {isSentView && item.nota_vendedor && (
                        <p className="mt-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900 mb-0">
                          <strong>{isEn ? 'Advisor response:' : 'Respuesta del asesor:'}</strong>{' '}
                          {item.nota_vendedor}
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
                    {!isSentView && (
                      <a
                        href={`tel:${item.telefono_contacto.replace(/[^\d+]/g, '')}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#d8d2c7] bg-white hover:bg-slate-50 text-[#16294B] text-xs font-semibold px-3 py-2 no-underline"
                      >
                        <Phone size={13} aria-hidden="true" />
                        <span>{isEn ? 'Call' : 'Llamar'}</span>
                      </a>
                    )}
                    {!isSentView && item.email_contacto && (
                      <a
                        href={`mailto:${item.email_contacto}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#d8d2c7] bg-white hover:bg-slate-50 text-[#16294B] text-xs font-semibold px-3 py-2 no-underline"
                      >
                        <Mail size={13} aria-hidden="true" />
                      </a>
                    )}
                    {gcalHref && item.estado !== 'cancelada' && (
                      <>
                        <a
                          href={gcalHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-[#d8d2c7] bg-white hover:bg-[#f7f4ee] text-[#16294B] text-xs font-semibold px-2.5 py-2 no-underline"
                          title={isEn ? 'Add to Google Calendar' : 'Añadir a Google Calendar'}
                        >
                          <CalendarPlus size={13} aria-hidden="true" />
                          <span>Calendar</span>
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadIcs(
                              item,
                              isSentView ? advisorName : item.nombre_contacto,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-[#d8d2c7] bg-white hover:bg-[#f7f4ee] text-[#16294B] text-xs font-semibold px-2.5 py-2"
                          title={isEn ? 'Download .ics calendar file' : 'Descargar archivo .ics'}
                        >
                          <Download size={12} aria-hidden="true" />
                          <span>.ics</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isSentView ? (
                  <div className="mt-3 pt-3 border-t border-[#f0ebe1] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {(item.estado === 'confirmada' || item.estado === 'atendida') && (
                        reviewedVisitIds[item.id] ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={13} />
                            {isEn ? 'Verified review submitted' : 'Calificación enviada'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewOpenVisitId(reviewOpenVisitId === item.id ? null : item.id)
                              setReviewScore(5)
                              setReviewComment('')
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold transition"
                          >
                            <Star size={13} className="fill-amber-400 text-amber-500" />
                            <span>
                              {isEn ? 'Rate advisor attention' : 'Calificar atención del asesor'}
                            </span>
                          </button>
                        )
                      )}

                      {(item.estado === 'pendiente' || item.estado === 'confirmada') && (
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => updateVisit(item.id, { estado: 'cancelada' }, 'sent')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1 text-xs font-semibold disabled:opacity-50 ml-auto"
                        >
                          <XCircle size={13} />{' '}
                          {isEn ? 'Cancel my request' : 'Cancelar mi solicitud'}
                        </button>
                      )}
                    </div>

                    {reviewOpenVisitId === item.id && (
                      <div className="rounded-xl border border-[#e7dfd1] bg-[#faf8f4] p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#16294B]">
                            {isEn
                              ? 'How was your visit / video tour experience?'
                              : '¿Cómo fue la puntualidad y atención durante la visita?'}
                          </span>
                          <div className="inline-flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewScore(star)}
                                aria-label={`${star} ${isEn ? 'stars' : 'estrellas'}`}
                                className="p-0.5"
                              >
                                <Star
                                  size={18}
                                  className={
                                    star <= reviewScore
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-300'
                                  }
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder={
                            isEn
                              ? 'Optional comment about communication, accuracy of photos, punctuality…'
                              : 'Comentario opcional sobre puntualidad, trato y veracidad del inmueble…'
                          }
                          className="w-full rounded-lg border border-[#dfd8cc] bg-white px-3 py-1.5 text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewOpenVisitId(null)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            {isEn ? 'Cancel' : 'Cancelar'}
                          </button>
                          <button
                            type="button"
                            disabled={submittingReview}
                            onClick={() => submitVisitReview(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#16294B] text-white px-3 py-1 text-xs font-bold hover:bg-[#0f1e38] disabled:opacity-50"
                          >
                            {submittingReview && <Loader2 size={12} className="animate-spin" />}
                            <span>{isEn ? 'Submit review' : 'Publicar calificación'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-[#f0ebe1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={updatingId === item.id || item.estado === 'confirmada'}
                        onClick={() =>
                          updateVisit(item.id, {
                            estado: 'confirmada',
                            ...(notesDraft[item.id] !== undefined
                              ? { nota_vendedor: notesDraft[item.id] }
                              : {}),
                          })
                        }
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
                        placeholder={
                          isEn
                            ? 'Note for follow-up / confirmation…'
                            : 'Nota de seguimiento o confirmación…'
                        }
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
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
