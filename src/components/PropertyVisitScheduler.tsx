'use client'

import { useEffect, useState } from 'react'
import { CalendarCheck, CheckCircle2, Loader2, Phone, Video, MapPin } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

interface PropertyVisitSchedulerProps {
  propertyId: string
  ownerId?: string | null
  locale: string
}

export default function PropertyVisitScheduler({
  propertyId,
  ownerId,
  locale,
}: PropertyVisitSchedulerProps) {
  const { user } = useAuth()
  const isEn = locale === 'en'

  const [open, setOpen] = useState(false)
  const [modalidad, setModalidad] = useState<'presencial' | 'videollamada' | 'llamada'>('presencial')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [fechaPreferida, setFechaPreferida] = useState('')
  const [franjaHoraria, setFranjaHoraria] = useState<'manana' | 'tarde' | 'fin_de_semana' | 'flexible'>('flexible')
  const [mensaje, setMensaje] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!user) return
    if (user.email) setEmail((prev) => prev || user.email || '')

    if (isSupabaseConfigured()) {
      supabase
        .from('perfiles')
        .select('nombre, telefono')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }: { data: { nombre?: string | null; telefono?: string | null } | null }) => {
          if (cancelled || !data) return
          if (data.nombre) setNombre((prev) => prev || String(data.nombre))
          if (data.telefono) setTelefono((prev) => prev || String(data.telefono))
        })
        .catch(() => undefined)
    }

    return () => {
      cancelled = true
    }
  }, [user])

  // El propietario del inmueble no necesita agendarse una visita a sí mismo
  if (user && ownerId && user.id === ownerId) return null

  const minDate = new Date().toISOString().slice(0, 10)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setErrorMsg(null)

    try {
      const authHeaders = user ? await getSupabaseAuthHeaders() : {}
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          inmuebleId: propertyId,
          nombre,
          telefono,
          email: email || undefined,
          modalidad,
          fechaPreferida: fechaPreferida || undefined,
          franjaHoraria,
          mensaje: mensaje || undefined,
          website,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(
          json.error ||
            (isEn ? 'Could not send your request. Try again.' : 'No se pudo enviar tu solicitud.'),
        )
        return
      }

      setSubmitted(true)
    } catch {
      setErrorMsg(isEn ? 'Connection error. Please try again.' : 'Error de conexión. Intenta nuevamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section
      className="rounded-2xl border border-[#e5dfd5] bg-[#faf8f4] p-4 shadow-sm"
      aria-labelledby="visit-scheduler-title"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8C6526] m-0">
            {isEn ? 'Direct scheduling' : 'Sin registro obligatorio'}
          </p>
          <h2 id="visit-scheduler-title" className="text-base font-bold text-[#16294B] mt-0.5 mb-1">
            {isEn ? 'Schedule a visit or video tour' : 'Agendar visita o videollamada'}
          </h2>
        </div>
        <CalendarCheck size={19} className="text-[#16294B] shrink-0 mt-0.5" aria-hidden="true" />
      </div>

      {submitted ? (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-emerald-900">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 size={17} className="text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{isEn ? 'Request sent!' : '¡Solicitud enviada al asesor!'}</span>
          </div>
          <p className="text-xs text-emerald-800 mt-1.5 mb-0 leading-relaxed">
            {isEn
              ? 'The listing advisor received your details and preferred schedule to confirm via WhatsApp or phone.'
              : 'El anunciante recibió tus datos y horario sugerido para confirmarte por WhatsApp o llamada.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false)
              setOpen(false)
              setMensaje('')
            }}
            className="mt-2.5 text-xs font-semibold text-emerald-800 underline"
          >
            {isEn ? 'Done' : 'Cerrar'}
          </button>
        </div>
      ) : !open ? (
        <div className="mt-2">
          <p className="text-xs text-[#64748B] leading-relaxed mb-3">
            {isEn
              ? 'Leave your WhatsApp or phone and choose when you would like to visit in person or via video call.'
              : 'Deja tu WhatsApp o teléfono y elige qué día prefieres conocer el inmueble en persona o por videollamada.'}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#16294B] bg-white hover:bg-[#16294B] text-[#16294B] hover:text-white font-semibold text-sm px-4 py-2.5 transition"
          >
            <CalendarCheck size={16} aria-hidden="true" />
            <span>{isEn ? 'Choose date & request visit' : 'Elegir horario y solicitar visita'}</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {/* Honeypot oculto para bots */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="visit-website-hp">Website</label>
            <input
              id="visit-website-hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={isEn ? 'Visit mode' : 'Modalidad'}>
            {[
              { id: 'presencial' as const, icon: MapPin, es: 'Presencial', en: 'In person' },
              { id: 'videollamada' as const, icon: Video, es: 'Video 360°', en: 'Video call' },
              { id: 'llamada' as const, icon: Phone, es: 'Llamada', en: 'Phone call' },
            ].map((opt) => {
              const Icon = opt.icon
              const active = modalidad === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModalidad(opt.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-[#16294B] text-white border-[#16294B]'
                      : 'bg-white text-[#334155] border-[#d8d2c7] hover:border-[#16294B]'
                  }`}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{isEn ? opt.en : opt.es}</span>
                </button>
              )
            })}
          </div>

          <div>
            <label htmlFor="visit-name" className="block text-xs font-semibold text-[#334155] mb-1">
              {isEn ? 'Your name *' : 'Tu nombre *'}
            </label>
            <input
              id="visit-name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={isEn ? 'Full name' : 'Nombre y apellido'}
              className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm text-[#1E293B]"
            />
          </div>

          <div>
            <label htmlFor="visit-phone" className="block text-xs font-semibold text-[#334155] mb-1">
              {isEn ? 'WhatsApp or phone *' : 'WhatsApp o teléfono *'}
            </label>
            <input
              id="visit-phone"
              type="tel"
              required
              maxLength={30}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+58 412 1234567"
              className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm text-[#1E293B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="visit-date" className="block text-xs font-semibold text-[#334155] mb-1">
                {isEn ? 'Preferred date' : 'Fecha sugerida'}
              </label>
              <input
                id="visit-date"
                type="date"
                min={minDate}
                value={fechaPreferida}
                onChange={(e) => setFechaPreferida(e.target.value)}
                className="w-full rounded-xl border border-[#d8d2c7] bg-white px-2.5 py-2 text-xs text-[#1E293B]"
              />
            </div>
            <div>
              <label htmlFor="visit-slot" className="block text-xs font-semibold text-[#334155] mb-1">
                {isEn ? 'Time slot' : 'Horario'}
              </label>
              <select
                id="visit-slot"
                value={franjaHoraria}
                onChange={(e) => setFranjaHoraria(e.target.value as any)}
                className="w-full rounded-xl border border-[#d8d2c7] bg-white px-2.5 py-2 text-xs text-[#1E293B]"
              >
                <option value="flexible">{isEn ? 'Flexible' : 'Flexible'}</option>
                <option value="manana">{isEn ? 'Morning' : 'Mañana'}</option>
                <option value="tarde">{isEn ? 'Afternoon' : 'Tarde'}</option>
                <option value="fin_de_semana">{isEn ? 'Weekend' : 'Fin de semana'}</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="visit-email" className="block text-xs font-semibold text-[#334155] mb-1">
              {isEn ? 'Email (optional)' : 'Correo electrónico (opcional)'}
            </label>
            <input
              id="visit-email"
              type="email"
              maxLength={160}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm text-[#1E293B]"
            />
          </div>

          <div>
            <label htmlFor="visit-note" className="block text-xs font-semibold text-[#334155] mb-1">
              {isEn ? 'Brief question or note' : 'Comentario opcional'}
            </label>
            <textarea
              id="visit-note"
              rows={2}
              maxLength={800}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={
                isEn
                  ? 'E.g. Does the building have a power plant and water well?'
                  : 'Ej.: ¿Acepta financiamiento corto o cuenta con planta eléctrica?'
              }
              className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-xs text-[#1E293B]"
            />
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 m-0">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-gray-50"
            >
              {isEn ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#16294B] hover:bg-[#0f1e38] text-white font-bold text-xs px-4 py-2.5 transition disabled:opacity-60"
            >
              {sending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              <span>{isEn ? 'Send visit request' : 'Enviar solicitud'}</span>
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
