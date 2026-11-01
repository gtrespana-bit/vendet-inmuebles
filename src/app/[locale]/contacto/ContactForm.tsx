'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { AlertCircle, ArrowUpRight, CheckCircle, Loader2, Mail, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'

const SUBJECT_KEYS = [
  'subject_general',
  'subject_report',
  'subject_account',
  'subject_suggestion',
  'subject_other',
] as const

const SUPPORT_EMAIL = 'soporte@venezuela-inmuebles.online'

export default function ContactPage() {
  const t = useTranslations('contact')
  const subjects = SUBJECT_KEYS.map(key => t(key))
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [asunto, setAsunto] = useState(subjects[0])
  const [mensaje, setMensaje] = useState('')
  const [telefono, setTelefono] = useState('')
  const [solicitarLlamada, setSolicitarLlamada] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')
  const [sentEmail, setSentEmail] = useState('')

  useEffect(() => {
    const orden = new URLSearchParams(window.location.search).get('orden')?.trim()
    if (orden && /^[0-9a-f-]{8,64}$/i.test(orden)) {
      setAsunto(subjects[2] || subjects[0])
      setMensaje((prev) => prev || `Revisión manual de orden de pago: ${orden}\n`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEnviando(true)
    setEstado('idle')
    setErrorText('')

    try {
      const response = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, asunto, mensaje, telefono: solicitarLlamada ? telefono : undefined, solicitarLlamada }),
      })
      const data = await response.json()

      if (!response.ok) {
        setEstado('error')
        setErrorText(data.error || t('sendError'))
        return
      }

      setSentEmail(email)
      setEstado('success')
      setNombre('')
      setEmail('')
      setAsunto(subjects[0])
      setMensaje('')
    } catch {
      setEstado('error')
      setErrorText(t('connectError'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FBF9F3]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8">
          <section className="flex flex-col justify-between bg-brand-dark p-7 text-white sm:p-10">
            <div>
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-text)]">{t('otherContact')}</p>
              <h1 className="max-w-md font-heading text-4xl leading-[1.08] sm:text-5xl">{t('title')}</h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/75 sm:text-base">{t('desc')}</p>
            </div>

            <div className="mt-12 border-t border-white/20 pt-6">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/20 text-[var(--gold-text)]">
                  <Mail size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Email</p>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-accent sm:text-base">
                    {SUPPORT_EMAIL}<ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="border border-[#e4ddd2] bg-white p-5 shadow-[0_12px_36px_rgba(53,35,38,0.05)] sm:p-8 lg:p-10" aria-labelledby="contact-form-title">
            {estado === 'success' ? (
              <div className="flex min-h-[28rem] flex-col items-start justify-center" role="status" aria-live="polite">
                <span className="flex h-14 w-14 items-center justify-center border border-[#d7e5d8] bg-[#f1f7f1] text-[#356a43]">
                  <CheckCircle size={28} aria-hidden="true" />
                </span>
                <h2 id="contact-form-title" className="mt-6 font-heading text-3xl text-brand-dark">{t('sent')}</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-[#70655d]">{t('sentDesc', { email: sentEmail })}</p>
                <button
                  type="button"
                  onClick={() => setEstado('idle')}
                  className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-brand-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                >
                  {t('sendAnother')} <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <div className="mb-7 border-b border-[#e8e1d7] pb-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8d6f3d]">{t('title')}</p>
                  <h2 id="contact-form-title" className="font-heading text-2xl text-brand-dark sm:text-3xl">{t('sendMessage')}</h2>
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="solicitarLlamada"
                      checked={solicitarLlamada}
                      onChange={e => setSolicitarLlamada(e.target.checked)}
                      className="mt-1"
                    />
                    <label htmlFor="solicitarLlamada" className="text-sm text-[#333D4C]">
                      Solicitar devolución de llamada telefónica (Exclusivo para usuarios del plan Agencia)
                    </label>
                  </div>
                  
                  {solicitarLlamada && (
                    <div className="pt-2 animate-fadeIn">
                      <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-semibold text-[#333D4C]">Teléfono</label>
                      <input
                        type="tel"
                        id="contact-phone"
                        value={telefono}
                        onChange={e => setTelefono(e.target.value)}
                        required={solicitarLlamada}
                        placeholder="+58 412 1234567"
                        className="w-full border border-[#DCD6C6] bg-[#fffdfa] px-4 py-3 text-sm leading-6 text-brand-dark outline-none transition placeholder:text-[#6E7684] focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                      />
                    </div>
                  )}

                  {estado === 'error' && (
                  <div role="alert" className="mb-5 flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{errorText}</span>
                  </div>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-[#333D4C]">{t('name')}</label>
                      <input
                        id="contact-name"
                        type="text"
                        value={nombre}
                        onChange={event => setNombre(event.target.value)}
                        required
                        autoComplete="name"
                        placeholder={t('namePlaceholder')}
                        className="min-h-12 w-full border border-[#DCD6C6] bg-[#fffdfa] px-4 py-3 text-sm text-brand-dark outline-none transition placeholder:text-[#6E7684] focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="mb-1.5 block text-sm font-semibold text-[#333D4C]">{t('email')}</label>
                      <input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        required
                        autoComplete="email"
                        placeholder={t('emailPlaceholder')}
                        className="min-h-12 w-full border border-[#DCD6C6] bg-[#fffdfa] px-4 py-3 text-sm text-brand-dark outline-none transition placeholder:text-[#6E7684] focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className="mb-1.5 block text-sm font-semibold text-[#333D4C]">{t('subject')}</label>
                    <select
                      id="contact-subject"
                      value={asunto}
                      onChange={event => setAsunto(event.target.value)}
                      className="min-h-12 w-full border border-[#DCD6C6] bg-[#fffdfa] px-4 py-3 text-sm text-brand-dark outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                    >
                      {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold text-[#333D4C]">{t('message')}</label>
                    <textarea
                      id="contact-message"
                      rows={6}
                      value={mensaje}
                      onChange={event => setMensaje(event.target.value)}
                      required
                      placeholder={t('messagePlaceholder')}
                      className="w-full resize-y border border-[#DCD6C6] bg-[#fffdfa] px-4 py-3 text-sm leading-6 text-brand-dark outline-none transition placeholder:text-[#6E7684] focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={enviando}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-brand-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto sm:min-w-48"
                  >
                    {enviando ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />{t('sending')}</> : <><Send size={17} aria-hidden="true" />{t('send')}</>}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
