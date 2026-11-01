'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { isOptimizableImageSrc } from '@/lib/image-src'
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Check,
  Coins,
  Copy,
  Edit,
  Eye,
  Loader2,
  Mail,
  MessageCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'

interface AgencyMember {
  user_id: string
  membership_id: string | null
  nombre: string
  email: string | null
  telefono: string | null
  foto_perfil_url: string | null
  verificado: boolean
  slug: string | null
  rol: 'admin' | 'agente'
  esDueno: boolean
  credito_balance: number | null
  inmueblesActivos: number
  inmueblesTotales: number
  visitasTotales: number
}

interface PendingInvite {
  id: string
  email: string | null
  rol: 'admin' | 'agente'
  estado: string
  expira_en: string
  creado_en: string
}

interface AgencyProperty {
  id: string
  titulo: string
  slug: string | null
  precio: number | null
  moneda: string | null
  estado: string | null
  ciudad: string | null
  activo: boolean
  vendido: boolean
  visitas: number | null
  main_image_url: string | null
  operacion_nombre: string | null
  agente_asignado_id: string | null
  agente_nombre: string | null
}

interface AgencyState {
  agencia: {
    id: string
    nombre: string
    descripcion: string | null
    logo_url: string | null
    owner_id: string
    slug: string | null
    rol: 'admin' | 'agente'
    esDueno: boolean
    esAdmin: boolean
    planAgenciaActivo: boolean
    totalCarteraActiva: number
    visitasCarteraTotal: number
  } | null
  miembros: AgencyMember[]
  invitaciones: PendingInvite[]
  cartera: AgencyProperty[]
  creditosAgencia: {
    planRestantes: number
    comprados: number
    totalDisponibles: number
  } | null
}

export default function TabEquipo({
  userId,
  onToast,
  onRefreshDashboard,
  onBoost,
  onDestacar,
}: {
  userId: string
  onToast: (msg: string | null) => void
  onRefreshDashboard: () => void
  onBoost?: (target: { productId: string; titulo: string }) => void
  onDestacar?: (target: { productId: string; titulo: string }) => void
}) {
  const locale = useLocale()
  const en = locale === 'en'

  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<AgencyState>({
    agencia: null,
    miembros: [],
    invitaciones: [],
    cartera: [],
    creditosAgencia: null,
  })

  // Formulario de invitación
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'agente' | 'admin'>('agente')
  const [inviting, setInviting] = useState(false)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [lastInviteEmailSent, setLastInviteEmailSent] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Modal asignar créditos
  const [creditModalMember, setCreditModalMember] = useState<AgencyMember | null>(null)
  const [creditAmount, setCreditAmount] = useState<number>(5)
  const [transferringCredits, setTransferringCredits] = useState(false)

  // Modal desvincular miembro + reasignación de cartera
  const [removeModalMember, setRemoveModalMember] = useState<AgencyMember | null>(null)
  const [reassignTargetId, setReassignTargetId] = useState<string>('')
  const [removingMember, setRemovingMember] = useState(false)

  // Filtros de cartera
  const [agentFilter, setAgentFilter] = useState<string>('todos')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [reassigningPropertyId, setReassigningPropertyId] = useState<string | null>(null)

  const showToast = useCallback(
    (msg: string) => {
      onToast(msg)
      setTimeout(() => onToast(null), 4200)
    },
    [onToast]
  )

  const loadAgency = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/agencia', { headers })
      const json = await res.json()
      if (res.ok) {
        setState({
          agencia: json.agencia || null,
          miembros: json.miembros || [],
          invitaciones: json.invitaciones || [],
          cartera: json.cartera || [],
          creditosAgencia: json.creditosAgencia || null,
        })
      }
    } catch {
      // ignore transient error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAgency()
  }, [loadAgency])

  const agencia = state.agencia

  const filteredCartera = useMemo(() => {
    return state.cartera.filter((item) => {
      if (agentFilter !== 'todos' && (item.agente_asignado_id || agencia?.owner_id) !== agentFilter) {
        return false
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        const hay = `${item.titulo || ''} ${item.ciudad || ''} ${item.estado || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [state.cartera, agentFilter, searchTerm, agencia?.owner_id])

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setLastInviteUrl(null)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/agencia/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          email: inviteEmail.trim() || null,
          rol: inviteRole,
          locale,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || (en ? 'Could not create invitation' : 'No se pudo generar la invitación'))
      } else {
        setLastInviteUrl(json.inviteUrl)
        setLastInviteEmailSent(Boolean(json.emailEnviado))
        setInviteEmail('')
        showToast(
          json.emailEnviado
            ? (en ? 'Invitation sent by email and link ready to share' : 'Invitación enviada por correo y enlace listo para compartir')
            : (en ? 'Invitation link generated' : 'Enlace de invitación generado')
        )
        await loadAgency()
      }
    } catch {
      showToast(en ? 'Connection error creating invitation' : 'Error de conexión al crear la invitación')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevokeInvite(id: string) {
    const headers = await getSupabaseAuthHeaders()
    const res = await fetch(`/api/agencia/invitaciones?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    })
    if (res.ok) {
      showToast(en ? 'Invitation revoked' : 'Invitación revocada')
      await loadAgency()
    }
  }

  async function handleCopyInviteUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      // ignore
    }
  }

  async function handleRoleChange(memberUserId: string, newRole: 'admin' | 'agente') {
    const headers = await getSupabaseAuthHeaders()
    const res = await fetch('/api/agencia/miembros', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ action: 'change_role', userId: memberUserId, rol: newRole }),
    })
    const json = await res.json()
    if (!res.ok) {
      showToast(json.error || (en ? 'Could not update role' : 'No se pudo actualizar el rol'))
      return
    }
    showToast(en ? 'Member role updated' : 'Rol del miembro actualizado')
    await loadAgency()
  }

  async function handleTransferCredits(e: React.FormEvent) {
    e.preventDefault()
    if (!creditModalMember) return
    setTransferringCredits(true)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/agencia/miembros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          action: 'transfer_credits',
          agenteId: creditModalMember.user_id,
          cantidad: creditAmount,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || (en ? 'Could not transfer credits' : 'No se pudieron asignar los créditos'))
      } else {
        showToast(
          en
            ? `Assigned ${creditAmount} credits to ${creditModalMember.nombre}`
            : `Asignados ${creditAmount} créditos a ${creditModalMember.nombre}`
        )
        setCreditModalMember(null)
        await loadAgency()
        onRefreshDashboard()
      }
    } finally {
      setTransferringCredits(false)
    }
  }

  async function handleConfirmRemoveMember() {
    if (!removeModalMember) return
    setRemovingMember(true)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/agencia/miembros', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          userId: removeModalMember.user_id,
          reasignarA: reassignTargetId || agencia?.owner_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || (en ? 'Could not unlink member' : 'No se pudo desvincular al miembro'))
      } else {
        const isSelf = removeModalMember.user_id === userId
        showToast(
          isSelf
            ? (en ? 'You have left the agency' : 'Te has desvinculado de la agencia')
            : (en
                ? `Agent removed. ${json.inmuebles_reasignados || 0} properties reassigned.`
                : `Agente desvinculado. ${json.inmuebles_reasignados || 0} inmuebles reasignados en tu cartera.`)
        )
        setRemoveModalMember(null)
        await loadAgency()
        onRefreshDashboard()
      }
    } finally {
      setRemovingMember(false)
    }
  }

  async function handleReassignProperty(inmuebleId: string, agenteAsignadoId: string) {
    setReassigningPropertyId(inmuebleId)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/agencia/cartera', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ inmuebleId, agenteAsignadoId }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || (en ? 'Could not reassign property' : 'No se pudo reasignar el inmueble'))
      } else {
        showToast(en ? 'Property reassigned successfully' : 'Inmueble reasignado al agente seleccionado')
        await loadAgency()
        onRefreshDashboard()
      }
    } finally {
      setReassigningPropertyId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          {en ? 'Loading agency & team management...' : 'Cargando panel de agencia y equipo...'}
        </p>
      </div>
    )
  }

  // Vista informativa para cuentas Gratuita / Profesional que aún no pertenecen a una agencia
  if (!agencia) {
    return (
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-7 sm:p-10">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full mb-3">
            <Building2 size={14} />
            {en ? 'Agency & Multi-Agent System' : 'Sistema de Agencia y Equipo de Agentes'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            {en
              ? 'Manage your entire brokerage team and protect your property portfolio'
              : 'Gestiona tu equipo de asesores y protege el 100 % de la cartera de tu inmobiliaria'}
          </h2>
          <p className="text-gray-600 text-sm sm:text-base mb-6 leading-relaxed">
            {en
              ? 'With the Agency Plan, you can invite unlimited real estate agents by email or link, assign properties to each advisor so buyers contact them directly, allocate promotional credits, and keep every listing inside your agency even if an agent leaves.'
              : 'Con el Plan Agencia puedes incorporar asesores por correo o enlace de invitación, asignar cada propiedad a su agente captador para que reciba directo el chat y WhatsApp, repartir créditos promocionales y conservar toda la cartera si un asesor deja la inmobiliaria.'}
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-7">
            <div className="bg-[#FAF8F4] border border-[#EAE3D2] rounded-xl p-4">
              <p className="font-bold text-gray-900 text-sm mb-1">
                {en ? '1. Invite agents in seconds' : '1. Invita agentes por correo o WhatsApp'}
              </p>
              <p className="text-xs text-gray-600">
                {en
                  ? 'Agents join with a free account and automatically inherit unlimited listings & 30 photos under your agency.'
                  : 'Tus asesores entran con una cuenta gratuita y heredan publicaciones ilimitadas y hasta 30 fotos bajo tu agencia.'}
              </p>
            </div>
            <div className="bg-[#FAF8F4] border border-[#EAE3D2] rounded-xl p-4">
              <p className="font-bold text-gray-900 text-sm mb-1">
                {en ? '2. Protected & reassignable portfolio' : '2. Cartera protegida y reasignable'}
              </p>
              <p className="text-xs text-gray-600">
                {en
                  ? 'Reassign listings between advisors in one click. If an agent leaves, your agency never loses a single listing.'
                  : 'Rota o reasigna inmuebles entre agentes en un clic. Si un asesor sale del equipo, la inmobiliaria conserva todos los anuncios.'}
              </p>
            </div>
          </div>

          <LocalLink
            href="/planes"
            className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3.5 rounded-xl font-bold text-sm hover:opacity-95 transition"
          >
            {en ? 'Activate Agency Plan (30-day free trial)' : 'Activar Plan Agencia (30 días gratis)'}
            <ArrowUpRight size={17} />
          </LocalLink>
        </div>
      </div>
    )
  }

  const storefrontPath = `/vendedor/${agencia.slug || agencia.owner_id}`
  const waShareMessage = lastInviteUrl
    ? en
      ? `Join our real estate team at ${agencia.nombre} on Venezuela Inmuebles: ${lastInviteUrl}`
      : `Hola, únete a nuestro equipo inmobiliario de ${agencia.nombre} en Venezuela Inmuebles desde este enlace oficial: ${lastInviteUrl}`
    : ''

  return (
    <div className="space-y-6">
      {/* Cabecera ejecutiva de la Agencia */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] flex items-center justify-center overflow-hidden shrink-0">
              {agencia.logo_url ? (
                <Image
                  src={agencia.logo_url}
                  alt={agencia.nombre}
                  width={64}
                  height={64}
                  unoptimized={!isOptimizableImageSrc(agencia.logo_url)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8 text-brand-primary" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-2.5 py-0.5 rounded-full">
                  <Building2 size={12} />
                  {agencia.esDueno
                    ? (en ? 'Agency Owner' : 'Titular de Agencia')
                    : agencia.esAdmin
                      ? (en ? 'Agency Admin' : 'Administrador de Agencia')
                      : (en ? 'Linked Agent' : 'Agente Vinculado')}
                </span>
                {agencia.planAgenciaActivo ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    <Check size={12} />
                    {en ? 'Unlimited portfolio active' : 'Cartera ilimitada activa'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    <AlertCircle size={12} />
                    {en ? 'Agency plan inactive' : 'Plan Agencia inactivo'}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{agencia.nombre}</h2>
              {agencia.descripcion && (
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">{agencia.descripcion}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadAgency}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <RefreshCw size={14} />
              {en ? 'Refresh' : 'Actualizar'}
            </button>
            <LocalLink
              href={storefrontPath}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FAF8F4] border border-[#DFD6BF] text-xs font-bold text-gray-900 hover:bg-[#F3EEE3] transition"
            >
              {en ? 'Public Agency Storefront' : 'Ver escaparate de la agencia'}
              <ArrowUpRight size={14} />
            </LocalLink>
            <LocalLink
              href="/publicar-inmueble"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:opacity-95 transition"
            >
              <Package size={14} />
              {en ? 'Publish property' : 'Publicar inmueble'}
            </LocalLink>
          </div>
        </div>

        {/* KPIs de la agencia */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-5">
          <div className="bg-[#FAF8F4] border border-[#ECE5D5] rounded-xl p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Users size={14} className="text-brand-primary" />
              {en ? 'Active Team' : 'Equipo activo'}
            </p>
            <p className="text-2xl font-bold text-gray-900">{state.miembros.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {en ? 'Owner + linked advisors' : 'Titular y agentes vinculados'}
            </p>
          </div>

          <div className="bg-[#FAF8F4] border border-[#ECE5D5] rounded-xl p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Package size={14} className="text-brand-primary" />
              {en ? 'Active Portfolio' : 'Cartera activa'}
            </p>
            <p className="text-2xl font-bold text-gray-900">{agencia.totalCarteraActiva}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {en ? 'Properties under agency' : 'Inmuebles publicados por el equipo'}
            </p>
          </div>

          <div className="bg-[#FAF8F4] border border-[#ECE5D5] rounded-xl p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Eye size={14} className="text-brand-primary" />
              {en ? 'Portfolio Views' : 'Visitas de cartera'}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat(en ? 'en-US' : 'es-VE').format(agencia.visitasCarteraTotal)}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {en ? 'Cumulative across all agents' : 'Acumuladas entre todos los agentes'}
            </p>
          </div>

          <div className="bg-[#FAF8F4] border border-[#ECE5D5] rounded-xl p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Coins size={14} className="text-amber-600" />
              {agencia.esDueno
                ? (en ? 'Agency Credits' : 'Créditos de agencia')
                : (en ? 'My Assigned Credits' : 'Mis créditos asignados')}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {agencia.esDueno
                ? (state.creditosAgencia?.totalDisponibles ?? 0)
                : (state.miembros.find((m) => m.user_id === userId)?.credito_balance ?? 0)}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {agencia.esDueno && state.creditosAgencia
                ? (en
                    ? `${state.creditosAgencia.planRestantes} monthly + ${state.creditosAgencia.comprados} purchased`
                    : `${state.creditosAgencia.planRestantes} del plan + ${state.creditosAgencia.comprados} comprados`)
                : (en ? 'Available to boost your listings' : 'Disponibles para impulsar tus captaciones')}
            </p>
          </div>
        </div>
      </div>

      {/* Guía operativa rápida para el dueño/admin */}
      {agencia.esAdmin && (
        <div className="bg-[#FAF8F4] border border-[#E5DEC9] rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-primary mb-2.5 flex items-center gap-1.5">
            <Sparkles size={14} />
            {en ? 'How agency team control works' : 'Cómo funciona el control de agentes en tu cuenta'}
          </p>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-gray-700 leading-relaxed">
            <div className="bg-white/80 rounded-xl p-3.5 border border-[#ECE5D5]">
              <strong className="text-gray-900 block mb-1">
                {en ? '1. Add agents via invite' : '1. Incorpora asesores con 1 enlace'}
              </strong>
              {en
                ? 'Enter their email (or leave blank to generate a WhatsApp link). If they do not have an account yet, they register for free and join automatically.'
                : 'Ingresa su correo (o déjalo vacío para generar un enlace por WhatsApp). Si el asesor no tiene cuenta, se registra gratis y queda vinculado con anuncios ilimitados y 30 fotos.'}
            </div>
            <div className="bg-white/80 rounded-xl p-3.5 border border-[#ECE5D5]">
              <strong className="text-gray-900 block mb-1">
                {en ? '2. Direct leads, agency ownership' : '2. Atención directa y cartera protegida'}
              </strong>
              {en
                ? 'Every property belongs to your agency portfolio, while calls, WhatsApp & chat route to the assigned agent. Reassign properties anytime.'
                : 'Todo anuncio pertenece a la cartera de tu inmobiliaria, pero las llamadas, WhatsApp y chat van al agente asignado. Si un asesor sale, reasignas sus inmuebles sin perderlos.'}
            </div>
            <div className="bg-white/80 rounded-xl p-3.5 border border-[#ECE5D5]">
              <strong className="text-gray-900 block mb-1">
                {en ? '3. Controlled credit allocation' : '3. Control estricto de créditos'}
              </strong>
              {en
                ? 'Agents cannot spend your 20 monthly credits on their own. Boost any listing yourself or allocate exact credits to each advisor.'
                : 'Ningún agente puede gastar tus 20 créditos mensuales sin permiso: impulsa tú mismo cualquier inmueble o transfiere créditos exactos a cada asesor.'}
            </div>
          </div>
        </div>
      )}

      {/* Panel de Invitación de Agentes (Dueño / Admin) */}
      {agencia.esAdmin && (
        <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus size={19} className="text-brand-primary" />
                {en ? 'Invite or Register a New Agent' : 'Añadir o Invitar Agente al Equipo'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {en
                  ? 'Send a direct email invitation or generate a unique 7-day onboarding link to share via WhatsApp.'
                  : 'Envía una invitación directa por correo o genera un enlace único (válido 7 días) para enviárselo por WhatsApp a tu asesor.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="agency-invite-email" className="sr-only">
                {en ? 'Agent email (optional for open link)' : 'Correo del agente (opcional para enlace abierto)'}
              </label>
              <input
                id="agency-invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={
                  en
                    ? 'asesor@correo.com (or leave empty to create a WhatsApp link)'
                    : 'asesor@correo.com (o déjalo vacío para crear enlace por WhatsApp)'
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-brand-primary"
              />
            </div>

            {agencia.esDueno && (
              <select
                aria-label={en ? 'Role' : 'Rol en la agencia'}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'agente' | 'admin')}
                className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm bg-white font-medium text-gray-800"
              >
                <option value="agente">{en ? 'Role: Agent' : 'Rol: Agente captador'}</option>
                <option value="admin">{en ? 'Role: Agency Admin' : 'Rol: Administrador'}</option>
              </select>
            )}

            <button
              type="submit"
              disabled={inviting || !agencia.planAgenciaActivo}
              className="inline-flex items-center justify-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-95 transition disabled:opacity-50 shrink-0"
            >
              {inviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {inviteEmail.trim()
                ? (en ? 'Send Invite & Link' : 'Enviar invitación')
                : (en ? 'Generate Join Link' : 'Generar enlace de unión')}
            </button>
          </form>

          {lastInviteUrl && (
            <div className="mt-4 bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
                <Check size={15} />
                {lastInviteEmailSent
                  ? (en
                      ? 'Email sent! You can also share this direct onboarding link via WhatsApp:'
                      : '¡Correo enviado! También puedes compartirle este enlace directo por WhatsApp:')
                  : (en
                      ? 'Onboarding link ready! Share it with your agent:'
                      : '¡Enlace listo! Envíalo a tu agente para que se registre o vincule su cuenta:')}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  readOnly
                  value={lastInviteUrl}
                  className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-800"
                />
                <button
                  type="button"
                  onClick={() => handleCopyInviteUrl(lastInviteUrl)}
                  className="inline-flex items-center justify-center gap-1.5 bg-white border border-emerald-300 text-emerald-900 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 transition"
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  {copiedLink ? (en ? 'Copied!' : '¡Copiado!') : (en ? 'Copy link' : 'Copiar enlace')}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(waShareMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 bg-[#25D366] text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:opacity-95 transition"
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </a>
              </div>
            </div>
          )}

          {state.invitaciones.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">
                {en ? 'Pending Invitations' : 'Invitaciones pendientes de aceptar'} ({state.invitaciones.length})
              </p>
              <div className="space-y-2">
                {state.invitaciones.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-[#FAF8F4] border border-[#ECE5D5] rounded-xl px-4 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Mail size={14} className="text-gray-400" />
                      <span className="font-semibold text-gray-900">
                        {inv.email || (en ? 'Open invitation link' : 'Enlace abierto de invitación')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 font-medium">
                        {inv.rol === 'admin' ? 'Admin' : (en ? 'Agent' : 'Agente')}
                      </span>
                      <span className="text-gray-400">
                        {en ? 'Expires' : 'Vence'}{' '}
                        {new Date(inv.expira_en).toLocaleDateString(en ? 'en-US' : 'es-VE')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                    >
                      <Trash2 size={13} />
                      {en ? 'Revoke' : 'Revocar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista y control de Miembros del Equipo */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users size={19} className="text-brand-primary" />
              {en ? 'Agency Team Members' : 'Miembros del Equipo'} ({state.miembros.length})
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {agencia.esDueno
                ? (en
                    ? 'Monitor active listings, views, roles and assign promotional credits to each agent.'
                    : 'Supervisa las captaciones activas, visitas, roles y asigna créditos promocionales a cada asesor.')
                : (en
                    ? 'Active advisors belonging to your real estate agency.'
                    : 'Asesores activos que integran tu agencia inmobiliaria.')}
            </p>
          </div>

          {!agencia.esDueno && (
            <button
              type="button"
              onClick={() => {
                const me = state.miembros.find((m) => m.user_id === userId)
                if (me) {
                  setRemoveModalMember(me)
                  setReassignTargetId(agencia.owner_id)
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 border border-red-200 rounded-xl px-3 py-2"
            >
              <UserMinus size={14} />
              {en ? 'Leave agency' : 'Salir de la agencia'}
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-100">
          {state.miembros.map((member) => {
            const canRemove =
              !member.esDueno &&
              (agencia.esDueno || (agencia.esAdmin && member.rol !== 'admin'))

            return (
              <div
                key={member.user_id}
                className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-[#F4EFE6] border border-[#E5DEC9] flex items-center justify-center overflow-hidden shrink-0 font-bold text-brand-primary">
                    {member.foto_perfil_url ? (
                      <Image
                        src={member.foto_perfil_url}
                        alt={member.nombre}
                        width={44}
                        height={44}
                        unoptimized={!isOptimizableImageSrc(member.foto_perfil_url)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      member.nombre.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LocalLink
                        href={`/vendedor/${member.slug || member.user_id}`}
                        className="font-bold text-gray-900 hover:text-brand-primary transition text-sm sm:text-base"
                      >
                        {member.nombre}
                      </LocalLink>
                      {member.verificado && (
                        <span
                          title={en ? 'Verified identity' : 'Identidad verificada'}
                          className="text-emerald-600 inline-flex items-center"
                        >
                          <ShieldCheck size={15} />
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          member.esDueno
                            ? 'bg-brand-primary text-white'
                            : member.rol === 'admin'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {member.esDueno
                          ? (en ? 'Owner' : 'Titular')
                          : member.rol === 'admin'
                            ? 'Admin'
                            : (en ? 'Agent' : 'Agente')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-0.5">
                      {member.email && <span>{member.email}</span>}
                      {member.telefono && <span>· {member.telefono}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-4 bg-[#FAF8F4] border border-[#ECE5D5] rounded-xl px-3.5 py-2 text-xs">
                    <div>
                      <span className="text-gray-500 block">{en ? 'Active' : 'Activos'}</span>
                      <strong className="text-gray-900 text-sm">{member.inmueblesActivos}</strong>
                    </div>
                    <div className="h-6 w-px bg-gray-200" />
                    <div>
                      <span className="text-gray-500 block">{en ? 'Views' : 'Visitas'}</span>
                      <strong className="text-gray-900 text-sm">{member.visitasTotales}</strong>
                    </div>
                    {member.credito_balance !== null && !member.esDueno && (
                      <>
                        <div className="h-6 w-px bg-gray-200" />
                        <div>
                          <span className="text-gray-500 block">{en ? 'Credits' : 'Créditos'}</span>
                          <strong className="text-amber-700 text-sm">{member.credito_balance}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  {agencia.esDueno && !member.esDueno && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setCreditModalMember(member)
                          setCreditAmount(5)
                        }}
                        className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition"
                      >
                        <Coins size={14} />
                        {en ? 'Assign credits' : 'Asignar créditos'}
                      </button>

                      <select
                        aria-label={en ? 'Member role' : 'Rol del agente'}
                        value={member.rol}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value as 'admin' | 'agente')}
                        className="border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-700 bg-white"
                      >
                        <option value="agente">{en ? 'Agent' : 'Agente'}</option>
                        <option value="admin">Admin</option>
                      </select>
                    </>
                  )}

                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveModalMember(member)
                        setReassignTargetId(agencia.owner_id)
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 px-2.5 py-2 rounded-xl hover:bg-red-50 transition"
                    >
                      <UserMinus size={14} />
                      {en ? 'Unlink' : 'Desvincular'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Control y Reasignación de Cartera Inmobiliaria */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Package size={19} className="text-brand-primary" />
              {agencia.esAdmin
                ? (en ? 'Agency Portfolio & Agent Assignment' : 'Cartera de la Agencia y Asignación de Agentes')
                : (en ? 'My Assigned Agency Properties' : 'Mis Inmuebles Asignados en la Agencia')}{' '}
              ({filteredCartera.length})
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {agencia.esAdmin
                ? (en
                    ? 'Change which advisor attends calls, WhatsApp and chat on any property in one click.'
                    : 'Cambia en un clic qué asesor atiende las llamadas, WhatsApp y mensajes de cada inmueble.')
                : (en
                    ? 'Properties currently assigned to you under the agency.'
                    : 'Propiedades de la agencia que atiendes directamente.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {agencia.esAdmin && (
              <select
                aria-label={en ? 'Filter by agent' : 'Filtrar por agente'}
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white text-gray-800"
              >
                <option value="todos">{en ? 'All team members' : 'Todos los agentes'}</option>
                {state.miembros.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.nombre} ({m.inmueblesActivos})
                  </option>
                ))}
              </select>
            )}
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={en ? 'Search title or city...' : 'Buscar título o ciudad...'}
              className="border border-gray-300 rounded-xl px-3 py-2 text-xs bg-white"
            />
          </div>
        </div>

        {filteredCartera.length === 0 ? (
          <div className="text-center py-10 bg-[#FAF8F4] rounded-xl border border-[#ECE5D5]">
            <p className="text-sm text-gray-600 mb-3">
              {en
                ? 'No properties match the selected filter yet.'
                : 'Aún no hay inmuebles para el filtro seleccionado.'}
            </p>
            <LocalLink
              href="/publicar-inmueble"
              className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-4 py-2 rounded-xl text-xs font-bold"
            >
              {en ? 'Publish first property' : 'Publicar inmueble'}
            </LocalLink>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCartera.map((prop) => {
              const currentAgentId = prop.agente_asignado_id || agencia.owner_id
              return (
                <div
                  key={prop.id}
                  className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                      {prop.main_image_url ? (
                        <Image
                          src={prop.main_image_url}
                          alt={prop.titulo}
                          width={56}
                          height={56}
                          unoptimized={!isOptimizableImageSrc(prop.main_image_url)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <LocalLink
                        href={`/inmueble/${prop.slug || prop.id}`}
                        className="font-bold text-sm text-gray-900 hover:text-brand-primary truncate block"
                      >
                        {prop.titulo}
                      </LocalLink>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-semibold text-gray-800">
                          ${new Intl.NumberFormat('en-US').format(Number(prop.precio || 0))}
                        </span>
                        <span>· {[prop.ciudad, prop.estado].filter(Boolean).join(', ')}</span>
                        <span>· {prop.visitas || 0} {en ? 'views' : 'visitas'}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            prop.vendido
                              ? 'bg-purple-100 text-purple-800'
                              : prop.activo
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {prop.vendido
                            ? (en ? 'Sold' : 'Vendido')
                            : prop.activo
                              ? (en ? 'Active' : 'Activo')
                              : (en ? 'Paused' : 'Pausado')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {agencia.esAdmin && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-500">
                          {en ? 'Advisor:' : 'Atiende:'}
                        </span>
                        <select
                          aria-label={en ? 'Assigned advisor' : 'Agente responsable'}
                          disabled={reassigningPropertyId === prop.id}
                          value={currentAgentId}
                          onChange={(e) => handleReassignProperty(prop.id, e.target.value)}
                          className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white text-gray-800 disabled:opacity-50"
                        >
                          {state.miembros.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.nombre} {m.esDueno ? (en ? '(Owner)' : '(Titular)') : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <LocalLink
                      href={`/inmueble/editar/${prop.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Edit size={13} />
                      {en ? 'Edit' : 'Editar'}
                    </LocalLink>

                    {prop.activo && !prop.vendido && onBoost && (
                      <button
                        type="button"
                        onClick={() => onBoost({ productId: prop.id, titulo: prop.titulo })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100"
                      >
                        <Zap size={13} />
                        Boost
                      </button>
                    )}

                    {prop.activo && !prop.vendido && onDestacar && (
                      <button
                        type="button"
                        onClick={() => onDestacar({ productId: prop.id, titulo: prop.titulo })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF8F4] border border-[#DFD6BF] text-gray-800 text-xs font-bold hover:bg-[#F1EBD9]"
                      >
                        <Sparkles size={13} />
                        {en ? 'Feature' : 'Destacar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Asignar créditos del pool de la agencia a un agente */}
      {creditModalMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCreditModalMember(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {en ? `Assign credits to ${creditModalMember.nombre}` : `Asignar créditos a ${creditModalMember.nombre}`}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {en
                ? `Available in agency pool: ${state.creditosAgencia?.totalDisponibles ?? 0} credits (consumes monthly plan credits first).`
                : `Disponibles en tu agencia: ${state.creditosAgencia?.totalDisponibles ?? 0} créditos (se descuentan primero los 20 mensuales incluidos en tu plan).`}
            </p>

            <form onSubmit={handleTransferCredits} className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCreditAmount(preset)}
                    className={`py-2 rounded-xl text-sm font-bold border transition ${
                      creditAmount === preset
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {en ? 'Custom amount' : 'Cantidad exacta de créditos'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, state.creditosAgencia?.totalDisponibles || 500)}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditModalMember(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {en ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={transferringCredits || (state.creditosAgencia?.totalDisponibles ?? 0) < creditAmount}
                  className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-bold hover:opacity-95 disabled:opacity-50"
                >
                  {transferringCredits
                    ? (en ? 'Assigning...' : 'Asignando...')
                    : (en ? `Transfer ${creditAmount} credits` : `Asignar ${creditAmount} créditos`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Desvincular miembro protegiendo y reasignando toda su cartera */}
      {removeModalMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRemoveModalMember(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {removeModalMember.user_id === userId
                ? (en ? 'Leave agency team?' : '¿Salir del equipo de la agencia?')
                : (en ? `Unlink ${removeModalMember.nombre}?` : `¿Desvincular a ${removeModalMember.nombre}?`)}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 leading-relaxed">
              {removeModalMember.user_id === userId
                ? (en
                    ? `All properties published under ${agencia.nombre} belong to the agency portfolio and will be automatically reassigned to the agency owner.`
                    : `Todos los inmuebles publicados bajo ${agencia.nombre} pertenecen a la cartera de la agencia y pasarán automáticamente al titular de la inmobiliaria.`)
                : (en
                    ? `${removeModalMember.nombre} currently has ${removeModalMember.inmueblesTotales} properties in your portfolio. Choose which team member will take over their properties and chats without losing any listing:`
                    : `${removeModalMember.nombre} tiene actualmente ${removeModalMember.inmueblesTotales} inmuebles en tu cartera. Elige quién pasará a atender sus propiedades y conversaciones sin perder ningún anuncio:`)}
            </p>

            {removeModalMember.user_id !== userId && (
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {en ? 'Reassign properties & chats to:' : 'Reasignar sus inmuebles y chats a:'}
                </label>
                <select
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-white"
                >
                  {state.miembros
                    .filter((m) => m.user_id !== removeModalMember.user_id)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.nombre} {m.esDueno ? (en ? '(Agency Owner)' : '(Titular de Agencia)') : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRemoveModalMember(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                {en ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="button"
                disabled={removingMember}
                onClick={handleConfirmRemoveMember}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {removingMember
                  ? (en ? 'Processing...' : 'Procesando...')
                  : removeModalMember.user_id === userId
                    ? (en ? 'Confirm & leave' : 'Confirmar salida')
                    : (en ? 'Unlink & keep portfolio' : 'Desvincular y conservar cartera')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
