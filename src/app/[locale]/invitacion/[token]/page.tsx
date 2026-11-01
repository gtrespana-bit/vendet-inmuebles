'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { supabase } from '@/lib/supabase'
import { isOptimizableImageSrc } from '@/lib/image-src'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react'

interface InvitePayload {
  invitacion: {
    rol: 'admin' | 'agente'
    emailDestino: string | null
    expira_en: string
  }
  agencia: {
    id: string
    nombre: string
    descripcion: string | null
    logo_url: string | null
    invitadoPor: string
  }
}

export default function InvitacionAgenciaPage() {
  const params = useParams<{ locale: string; token: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const { user, session, loading: authLoading } = useAuth()

  const en = params?.locale === 'en' || pathname?.startsWith('/en')
  const token = String(params?.token || '').trim()

  const [loading, setLoading] = useState(true)
  const [inviteData, setInviteData] = useState<InvitePayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadInvite() {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/agencia/invitaciones/aceptar?token=${encodeURIComponent(token)}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.ok) {
          setLoadError(
            json.error ||
              (en ? 'This invitation link is invalid or has expired.' : 'Este enlace de invitación no es válido o ya expiró.')
          )
        } else {
          setInviteData({ invitacion: json.invitacion, agencia: json.agencia })
        }
      } catch {
        if (!cancelled) {
          setLoadError(en ? 'Could not verify the invitation.' : 'No pudimos verificar la invitación.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (token) loadInvite()
    else {
      setLoadError(en ? 'Missing invitation token.' : 'Falta el código de invitación.')
      setLoading(false)
    }
    return () => {
      cancelled = true
    }
  }, [token, en])

  const returnPath = `/invitacion/${encodeURIComponent(token)}`
  const registerHref = `/register?redirect=${encodeURIComponent(returnPath)}&invitacion=1${
    inviteData?.invitacion.emailDestino
      ? `&email=${encodeURIComponent(inviteData.invitacion.emailDestino)}`
      : ''
  }`
  const loginHref = `/login?redirect=${encodeURIComponent(returnPath)}`

  const emailMismatch = Boolean(
    session &&
      user?.email &&
      inviteData?.invitacion.emailDestino &&
      user.email.trim().toLowerCase() !== inviteData.invitacion.emailDestino.trim().toLowerCase()
  )

  async function handleAccept() {
    setAccepting(true)
    setAcceptError(null)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/agencia/invitaciones/aceptar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setAcceptError(json.error || (en ? 'Could not accept invitation.' : 'No se pudo aceptar la invitación.'))
        setAccepting(false)
        return
      }
      setAccepted(true)
      setTimeout(() => {
        router.push(`${en ? '/en' : ''}/dashboard?tab=equipo`)
      }, 1200)
    } catch {
      setAcceptError(en ? 'Connection error while accepting.' : 'Error de conexión al aceptar la invitación.')
      setAccepting(false)
    }
  }

  async function handleSwitchAccount() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12 bg-[#FAF8F4]">
      <div className="w-full max-w-lg bg-white border border-[#E5DEC9] rounded-2xl shadow-lg p-7 sm:p-9">
        {loading || authLoading ? (
          <div className="py-14 text-center">
            <Loader2 className="w-9 h-9 animate-spin text-brand-primary mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {en ? 'Verifying agency invitation...' : 'Verificando invitación de agencia...'}
            </p>
          </div>
        ) : loadError || !inviteData ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {en ? 'Invitation unavailable' : 'Invitación no disponible'}
            </h1>
            <p className="text-gray-600 text-sm mb-6">{loadError}</p>
            <LocalLink
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-bold text-sm hover:opacity-95 transition"
            >
              {en ? 'Go to dashboard' : 'Ir a mi panel'}
            </LocalLink>
          </div>
        ) : accepted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={34} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {en ? 'Welcome to the team!' : '¡Ya formas parte del equipo!'}
            </h1>
            <p className="text-gray-600 text-sm mb-4">
              {en
                ? `Your account is now linked to ${inviteData.agencia.nombre}. Redirecting to your agency panel...`
                : `Tu cuenta quedó vinculada a ${inviteData.agencia.nombre}. Te estamos llevando a tu panel de equipo...`}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
              <div className="w-16 h-16 rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] flex items-center justify-center overflow-hidden shrink-0">
                {inviteData.agencia.logo_url ? (
                  <Image
                    src={inviteData.agencia.logo_url}
                    alt={inviteData.agencia.nombre}
                    width={64}
                    height={64}
                    unoptimized={!isOptimizableImageSrc(inviteData.agencia.logo_url)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-brand-primary" />
                )}
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-2.5 py-0.5 rounded-full mb-1">
                  <Users size={12} />
                  {en ? 'Official Team Invitation' : 'Invitación de Equipo Inmobiliario'}
                </span>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {inviteData.agencia.nombre}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {en
                    ? `Invited by ${inviteData.agencia.invitadoPor} · Role: ${
                        inviteData.invitacion.rol === 'admin' ? 'Agency Admin' : 'Real Estate Agent'
                      }`
                    : `Invitado por ${inviteData.agencia.invitadoPor} · Rol: ${
                        inviteData.invitacion.rol === 'admin' ? 'Administrador de Agencia' : 'Agente Inmobiliario'
                      }`}
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F4] border border-[#EAE3D2] rounded-xl p-4 mb-6 space-y-2.5 text-sm text-gray-700">
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck size={17} className="text-emerald-600 shrink-0" />
                {en ? 'What joining this agency enables for you:' : 'Qué incluye unirte a esta agencia:'}
              </p>
              <ul className="space-y-1.5 text-xs sm:text-sm text-gray-600 pl-6 list-disc">
                <li>
                  {en
                    ? 'Unlimited active listings under the agency portfolio with up to 30 photos, video & floor plans.'
                    : 'Publicación de inmuebles sin límite bajo la cartera de la agencia, con hasta 30 fotos, vídeo y planos.'}
                </li>
                <li>
                  {en
                    ? 'Buyers contact you directly via internal chat, WhatsApp and phone on your assigned properties.'
                    : 'Los clientes te contactan directo a tu chat, WhatsApp y teléfono en cada inmueble que tengas asignado.'}
                </li>
                <li>
                  {en
                    ? 'Your profile appears on the official agency storefront with promotional credits managed by the agency.'
                    : 'Apareces en el escaparate oficial de la inmobiliaria y puedes recibir créditos de promoción asignados por la agencia.'}
                </li>
              </ul>
            </div>

            {inviteData.invitacion.emailDestino && (
              <p className="text-xs text-gray-500 mb-4">
                {en ? 'Issued for email:' : 'Invitación dirigida al correo:'}{' '}
                <strong className="text-gray-800">{inviteData.invitacion.emailDestino}</strong>
              </p>
            )}

            {acceptError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-sm mb-4 flex items-start gap-2">
                <AlertCircle size={17} className="shrink-0 mt-0.5" />
                <span>{acceptError}</span>
              </div>
            )}

            {!session ? (
              <div className="space-y-3">
                <LocalLink
                  href={registerHref}
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand-primary text-white py-3.5 px-5 rounded-xl font-bold text-sm hover:opacity-95 transition"
                >
                  {en ? 'Create free agent account & join' : 'Crear mi cuenta gratis y unirme'}
                  <ArrowRight size={16} />
                </LocalLink>
                <LocalLink
                  href={loginHref}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-800 py-3 px-5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                >
                  {en ? 'I already have an account · Sign in' : 'Ya tengo cuenta · Iniciar sesión'}
                </LocalLink>
              </div>
            ) : emailMismatch ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 text-xs sm:text-sm">
                  {en
                    ? `You are signed in as ${user?.email}, but this invitation was sent specifically to ${inviteData.invitacion.emailDestino}.`
                    : `Tienes sesión iniciada como ${user?.email}, pero esta invitación fue enviada para ${inviteData.invitacion.emailDestino}.`}
                </div>
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-800 py-3 px-5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
                >
                  <LogOut size={16} />
                  {en ? 'Sign out & switch account' : 'Cerrar sesión para entrar con ese correo'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 text-center">
                  {en ? 'Signed in as' : 'Conectado como'}{' '}
                  <strong className="text-gray-800">{user?.email}</strong>
                </p>
                <button
                  type="button"
                  disabled={accepting}
                  onClick={handleAccept}
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand-primary text-white py-3.5 px-5 rounded-xl font-bold text-sm hover:opacity-95 transition disabled:opacity-50"
                >
                  {accepting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {en ? 'Joining agency...' : 'Vinculando cuenta...'}
                    </>
                  ) : (
                    <>
                      {en
                        ? `Accept & join ${inviteData.agencia.nombre}`
                        : `Aceptar invitación y unirme a ${inviteData.agencia.nombre}`}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
