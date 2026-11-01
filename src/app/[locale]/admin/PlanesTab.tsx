'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import {
  Search,
  RefreshCw,
  Sparkles,
  Crown,
  X,
  Loader2,
  Check,
  CalendarPlus,
  Building2,
  Mail,
  Clock,
  ShieldCheck,
} from 'lucide-react'

const PLAN_LABEL: Record<string, string> = {
  gratuita: 'Gratuita',
  profesional: 'Profesional',
  agencia: 'Agencia',
}

const PLAN_STYLE: Record<string, string> = {
  gratuita: 'bg-gray-100 text-gray-600',
  profesional: 'bg-amber-50 text-amber-700 border border-amber-200',
  agencia: 'bg-purple-50 text-purple-700 border border-purple-200',
}

const ESTADO_LABEL: Record<string, string> = {
  activa: 'Activa',
  trial: 'Prueba',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
}

type FiltroRapido =
  | 'todos'
  | 'nuevas_agencias'
  | 'agencias'
  | 'profesionales'
  | 'trial'
  | 'activas'
  | 'por_vencer'

type OrdenLista = 'recientes' | 'vencimiento' | 'nombre'

interface UsuarioPlan {
  id: string
  nombre: string | null
  email: string | null
  empresa: string | null
  tipo_cuenta: string | null
  verificado: boolean
  creado_en: string | null
  plan: 'gratuita' | 'profesional' | 'agencia'
  estado: 'activa' | 'trial' | 'vencida' | null
  fin: string | null
  trial_ends_at: string | null
  creditos_incluidos: number | null
  creditos_usados_mes: number | null
  diasRestantes: number | null
  esNuevaAgencia: boolean
}

interface ModalState {
  user: UsuarioPlan
  pestana: 'extender' | 'asignar'
  plan: 'gratuita' | 'profesional' | 'agencia'
  modo: 'activa' | 'trial'
  dias: string
  creditosIncluidos: string
  motivo: string
  notificarEmail: boolean
  procesando: boolean
}

const PRESETS_EXTENDER = [7, 15, 30, 60, 90]
const PRESETS_ASIGNAR = [15, 30, 60, 90, 180, 365]

function calcularDiasRestantes(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function formatearFechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch {
    return iso.slice(0, 10)
  }
}

function formatearFechaLarga(fecha: Date): string {
  try {
    return new Intl.DateTimeFormat('es-VE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fecha)
  } catch {
    return fecha.toISOString().slice(0, 10)
  }
}

export default function PlanesTab({ notify }: { notify: (msg: string) => void }) {
  const [usuarios, setUsuarios] = useState<UsuarioPlan[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroRapido>('todos')
  const [orden, setOrden] = useState<OrdenLista>('recientes')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)

  async function cargar() {
    setCargando(true)
    const [{ data: perfiles }, { data: subs }, { data: agencias }] = await Promise.all([
      supabase
        .from('perfiles')
        .select('id, nombre, email, tipo_cuenta, empresa_nombre, verificado, creado_en')
        .order('creado_en', { ascending: false })
        .limit(1000),
      supabase
        .from('suscripciones')
        .select('user_id, plan, estado, fin, trial_ends_at, creditos_incluidos, creditos_usados_mes, created_at')
        .in('estado', ['activa', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('agencias')
        .select('owner_id, nombre')
        .limit(1000),
    ])

    const subByUser = new Map<string, any>()
    ;(subs || []).forEach((s: any) => {
      const prev = subByUser.get(s.user_id)
      // Priorizar suscripción 'activa' sobre 'trial' si hubiera más de una
      if (!prev || (prev.estado !== 'activa' && s.estado === 'activa')) {
        subByUser.set(s.user_id, s)
      }
    })

    const agenciaByOwner = new Map<string, string>()
    ;(agencias || []).forEach((a: any) => {
      if (a.owner_id && a.nombre) agenciaByOwner.set(a.owner_id, a.nombre)
    })

    const hace30Dias = Date.now() - 30 * 24 * 60 * 60 * 1000

    const lista: UsuarioPlan[] = (perfiles || []).map((p: any) => {
      const sub = subByUser.get(p.id)
      const fechaVenc = sub ? (sub.estado === 'trial' ? sub.trial_ends_at || sub.fin : sub.fin) : null
      const diasRest = calcularDiasRestantes(fechaVenc)
      const vencida = sub && diasRest !== null && diasRest <= 0
      const planRaw = sub?.plan && ['gratuita', 'profesional', 'agencia'].includes(sub.plan)
        ? sub.plan
        : 'gratuita'
      const creadoMs = p.creado_en ? new Date(p.creado_en).getTime() : 0
      const esCuentaAgencia = p.tipo_cuenta === 'agencia' || planRaw === 'agencia' || agenciaByOwner.has(p.id)

      return {
        id: p.id,
        nombre: p.nombre,
        email: p.email || null,
        empresa: agenciaByOwner.get(p.id) || p.empresa_nombre || null,
        tipo_cuenta: p.tipo_cuenta,
        verificado: Boolean(p.verificado),
        creado_en: p.creado_en || null,
        plan: planRaw,
        estado: sub ? (vencida ? 'vencida' : sub.estado) : null,
        fin: sub?.fin || null,
        trial_ends_at: sub?.trial_ends_at || null,
        creditos_incluidos: sub?.creditos_incluidos ?? null,
        creditos_usados_mes: sub?.creditos_usados_mes ?? null,
        diasRestantes: diasRest,
        esNuevaAgencia: esCuentaAgencia && creadoMs >= hace30Dias,
      }
    })

    setUsuarios(lista)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const contadores = useMemo(() => ({
    todos: usuarios.length,
    nuevas_agencias: usuarios.filter(u => u.esNuevaAgencia).length,
    agencias: usuarios.filter(u => u.plan === 'agencia' || u.tipo_cuenta === 'agencia').length,
    profesionales: usuarios.filter(u => u.plan === 'profesional' || u.tipo_cuenta === 'profesional').length,
    trial: usuarios.filter(u => u.estado === 'trial').length,
    activas: usuarios.filter(u => u.estado === 'activa').length,
    por_vencer: usuarios.filter(u => u.diasRestantes !== null && u.diasRestantes > 0 && u.diasRestantes <= 7).length,
  }), [usuarios])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = usuarios.filter(u => {
      if (filtro === 'nuevas_agencias' && !u.esNuevaAgencia) return false
      if (filtro === 'agencias' && u.plan !== 'agencia' && u.tipo_cuenta !== 'agencia') return false
      if (filtro === 'profesionales' && u.plan !== 'profesional' && u.tipo_cuenta !== 'profesional') return false
      if (filtro === 'trial' && u.estado !== 'trial') return false
      if (filtro === 'activas' && u.estado !== 'activa') return false
      if (filtro === 'por_vencer' && !(u.diasRestantes !== null && u.diasRestantes > 0 && u.diasRestantes <= 7)) return false

      if (!q) return true
      return (
        (u.nombre || '').toLowerCase().includes(q) ||
        (u.empresa || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    })

    return [...base].sort((a, b) => {
      if (orden === 'nombre') {
        return (a.empresa || a.nombre || '').localeCompare(b.empresa || b.nombre || '')
      }
      if (orden === 'vencimiento') {
        const aD = a.diasRestantes ?? 999999
        const bD = b.diasRestantes ?? 999999
        return aD - bD
      }
      const aT = a.creado_en ? new Date(a.creado_en).getTime() : 0
      const bT = b.creado_en ? new Date(b.creado_en).getTime() : 0
      return bT - aT
    })
  }, [usuarios, busqueda, filtro, orden])

  function abrirModalExtender(u: UsuarioPlan) {
    const planInicial: 'agencia' | 'profesional' =
      u.plan === 'agencia' || u.tipo_cuenta === 'agencia'
        ? 'agencia'
        : u.plan === 'profesional' || u.tipo_cuenta === 'profesional'
          ? 'profesional'
          : 'agencia'

    const modoInicial: 'activa' | 'trial' = u.estado === 'activa' ? 'activa' : 'trial'

    setModal({
      user: u,
      pestana: 'extender',
      plan: planInicial,
      modo: modoInicial,
      dias: '30',
      creditosIncluidos: '',
      motivo: '',
      notificarEmail: true,
      procesando: false,
    })
  }

  function abrirModalGestionar(u: UsuarioPlan) {
    const tienePlanVigente = u.plan !== 'gratuita' && (u.estado === 'activa' || u.estado === 'trial')
    const planInicial: 'gratuita' | 'profesional' | 'agencia' =
      u.plan !== 'gratuita'
        ? u.plan
        : u.tipo_cuenta === 'agencia'
          ? 'agencia'
          : 'profesional'

    setModal({
      user: u,
      pestana: tienePlanVigente ? 'extender' : 'asignar',
      plan: planInicial,
      modo: u.estado === 'activa' ? 'activa' : 'trial',
      dias: '30',
      creditosIncluidos: '',
      motivo: '',
      notificarEmail: true,
      procesando: false,
    })
  }

  const fechaNuevaPreview = useMemo(() => {
    if (!modal) return null
    const nDias = Number.parseInt(modal.dias, 10)
    if (!Number.isInteger(nDias) || nDias < 1 || nDias > 730) return null

    if (modal.pestana === 'asignar' && modal.plan === 'gratuita') return null

    let baseMs = Date.now()
    if (modal.pestana === 'extender') {
      const actualIso = modal.user.estado === 'trial'
        ? modal.user.trial_ends_at || modal.user.fin
        : modal.user.fin
      if (actualIso) {
        const parsed = new Date(actualIso).getTime()
        if (!Number.isNaN(parsed) && parsed > baseMs) {
          baseMs = parsed
        }
      }
    }
    return new Date(baseMs + nDias * 24 * 60 * 60 * 1000)
  }, [modal])

  async function guardarPlan() {
    if (!modal) return
    const esCancelacion = modal.pestana === 'asignar' && modal.plan === 'gratuita'
    const nDias = Number.parseInt(modal.dias, 10)

    if (!esCancelacion && (!Number.isInteger(nDias) || nDias < 1 || nDias > 730)) {
      notify('❌ Ingresa una cantidad válida de días (entre 1 y 730)')
      return
    }

    let creditosOverride: number | undefined
    if (!esCancelacion && modal.creditosIncluidos.trim() !== '') {
      const parsedCred = Number.parseInt(modal.creditosIncluidos, 10)
      if (!Number.isInteger(parsedCred) || parsedCred < 0 || parsedCred > 1000) {
        notify('❌ Cupo de créditos inválido (entre 0 y 1000)')
        return
      }
      creditosOverride = parsedCred
    }

    setModal({ ...modal, procesando: true })
    try {
      const operacion = esCancelacion
        ? 'cancelar'
        : modal.pestana === 'extender'
          ? 'extender'
          : 'asignar'

      const res = await fetch('/api/admin/planes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({
          userId: modal.user.id,
          operacion,
          plan: esCancelacion ? 'gratuita' : modal.plan,
          modo: esCancelacion ? 'cancelar' : modal.modo,
          dias: esCancelacion ? undefined : nDias,
          creditosIncluidos: creditosOverride,
          motivo: modal.motivo.trim() || undefined,
          notificarEmail: modal.notificarEmail,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'desconocido')

      const nombreMostrar = modal.user.empresa || modal.user.nombre || 'usuario'
      if (operacion === 'extender') {
        notify(
          `✅ +${nDias} ${nDias === 1 ? 'día extra añadido' : 'días extra añadidos'} a ${nombreMostrar}${modal.notificarEmail ? ' · Email enviado' : ''}`
        )
      } else if (operacion === 'cancelar') {
        notify(`✅ Plan de ${nombreMostrar} pasado a Gratuito`)
      } else {
        notify(
          `✅ Plan ${PLAN_LABEL[modal.plan]} (${nDias}d) activado para ${nombreMostrar}${modal.notificarEmail ? ' · Email enviado' : ''}`
        )
      }

      setModal(null)
      await cargar()
    } catch (err: any) {
      notify('❌ Error: ' + (err.message || 'desconocido'))
      setModal(prev => (prev ? { ...prev, procesando: false } : null))
    }
  }

  return (
    <div className="space-y-4">
      {/* Buscador + orden + refrescar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, agencia o correo..."
            className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <select
          value={orden}
          onChange={e => setOrden(e.target.value as OrdenLista)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-white font-medium text-gray-700"
        >
          <option value="recientes">Más recientes primero</option>
          <option value="vencimiento">Próximos a vencer</option>
          <option value="nombre">Nombre A–Z</option>
        </select>
        <button
          onClick={cargar}
          className="p-2.5 rounded-xl border hover:bg-gray-50 flex items-center justify-center"
          title="Refrescar"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filtros rápidos (destacando Nuevas Agencias) */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: 'todos', label: `Todos (${contadores.todos})` },
          { id: 'nuevas_agencias', label: `✨ Nuevas agencias 30d (${contadores.nuevas_agencias})` },
          { id: 'agencias', label: `Agencias (${contadores.agencias})` },
          { id: 'profesionales', label: `Profesionales (${contadores.profesionales})` },
          { id: 'trial', label: `En prueba (${contadores.trial})` },
          { id: 'activas', label: `Activas (${contadores.activas})` },
          { id: 'por_vencer', label: `Por vencer ≤7d (${contadores.por_vencer})` },
        ] as { id: FiltroRapido; label: string }[]).map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              filtro === f.id
                ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                : f.id === 'nuevas_agencias'
                  ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Mostrando <strong>{filtrados.length}</strong> de {usuarios.length} cuentas · Usa{' '}
        <strong>+ Tiempo extra</strong> para sumar días manualmente a las agencias o cuentas seleccionadas sin afectar al resto.
      </p>

      {cargando ? (
        <div className="text-center py-12 text-gray-400">Cargando planes y suscripciones...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-bold">Usuario / Agencia</th>
                  <th className="text-left py-3 px-4 font-bold">Plan</th>
                  <th className="text-center py-3 px-4 font-bold hidden sm:table-cell">Estado</th>
                  <th className="text-center py-3 px-4 font-bold hidden md:table-cell">Vigencia</th>
                  <th className="text-center py-3 px-4 font-bold hidden lg:table-cell">Créditos plan</th>
                  <th className="text-right py-3 px-4 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(u => {
                  const isoVenc = u.estado === 'trial' ? u.trial_ends_at || u.fin : u.fin
                  const credRestantes =
                    u.creditos_incluidos !== null
                      ? Math.max(0, u.creditos_incluidos - (u.creditos_usados_mes || 0))
                      : null

                  return (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-gray-800">{u.nombre || 'Sin nombre'}</p>
                          {u.verificado && (
                            <span title="Perfil verificado" className="text-blue-600 inline-flex">
                              <ShieldCheck size={14} />
                            </span>
                          )}
                          {u.esNuevaAgencia && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                              Nueva agencia
                            </span>
                          )}
                        </div>
                        {u.empresa && (
                          <p className="text-xs text-purple-700 font-medium flex items-center gap-1 mt-0.5">
                            <Building2 size={11} /> {u.empresa}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {u.email || '—'}
                          {u.creado_en ? ` · Reg: ${formatearFechaCorta(u.creado_en)}` : ''}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                            PLAN_STYLE[u.plan] || PLAN_STYLE.gratuita
                          }`}
                        >
                          {u.plan === 'agencia' && <Crown size={11} />}
                          {u.plan === 'profesional' && <Sparkles size={11} />}
                          {PLAN_LABEL[u.plan] || u.plan}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        {u.estado ? (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              u.estado === 'trial'
                                ? 'bg-blue-50 text-blue-700'
                                : u.estado === 'activa'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {ESTADO_LABEL[u.estado] || u.estado}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center text-xs hidden md:table-cell">
                        <div className="text-gray-700 font-medium">{formatearFechaCorta(isoVenc)}</div>
                        {u.diasRestantes !== null && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${
                              u.diasRestantes <= 0
                                ? 'text-red-600'
                                : u.diasRestantes <= 7
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                            }`}
                          >
                            <Clock size={10} />
                            {u.diasRestantes <= 0
                              ? 'Vencido'
                              : `${u.diasRestantes} ${u.diasRestantes === 1 ? 'día restante' : 'días restantes'}`}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center text-xs text-gray-600 hidden lg:table-cell">
                        {credRestantes !== null ? (
                          <span>
                            <strong>{credRestantes}</strong> / {u.creditos_incluidos}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => abrirModalExtender(u)}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold transition"
                            title="Regalar o sumar días extra manualmente"
                          >
                            <CalendarPlus size={13} />
                            + Tiempo extra
                          </button>
                          <button
                            onClick={() => abrirModalGestionar(u)}
                            className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-100 font-medium text-gray-700 transition"
                          >
                            Gestionar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      No se encontraron cuentas para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal avanzado de gestión de planes y tiempo extra */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => !modal.procesando && setModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <h3 className="font-bold text-lg text-gray-900">
                  {modal.user.empresa || modal.user.nombre || 'Usuario'}
                </h3>
                <p className="text-xs text-gray-500">
                  {modal.user.nombre && modal.user.empresa ? `${modal.user.nombre} · ` : ''}
                  {modal.user.email || 'Sin email'}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                disabled={modal.procesando}
                className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen del estado actual */}
            <div className="mt-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-2">
              <span>
                Plan actual:{' '}
                <strong className="text-gray-900">{PLAN_LABEL[modal.user.plan]}</strong>
                {modal.user.estado ? ` (${ESTADO_LABEL[modal.user.estado] || modal.user.estado})` : ''}
              </span>
              {modal.user.diasRestantes !== null && modal.user.diasRestantes > 0 && (
                <span className="text-emerald-700 font-semibold">
                  Vence {formatearFechaCorta(modal.user.estado === 'trial' ? modal.user.trial_ends_at || modal.user.fin : modal.user.fin)} ({modal.user.diasRestantes}d)
                </span>
              )}
            </div>

            {/* Selector de modo de operación */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl mb-4">
              <button
                type="button"
                disabled={modal.procesando}
                onClick={() =>
                  setModal({
                    ...modal,
                    pestana: 'extender',
                    plan: modal.plan === 'gratuita'
                      ? (modal.user.tipo_cuenta === 'agencia' ? 'agencia' : 'profesional')
                      : modal.plan,
                    dias: modal.dias || '30',
                    notificarEmail: true,
                  })
                }
                className={`py-2 px-3 rounded-lg text-xs font-bold transition ${
                  modal.pestana === 'extender'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🎁 Regalar tiempo extra
              </button>
              <button
                type="button"
                disabled={modal.procesando}
                onClick={() =>
                  setModal({
                    ...modal,
                    pestana: 'asignar',
                    dias: modal.dias || '30',
                  })
                }
                className={`py-2 px-3 rounded-lg text-xs font-bold transition ${
                  modal.pestana === 'asignar'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ⚙️ Asignar / Cambiar plan
              </button>
            </div>

            <div className="space-y-4">
              {/* Selección de Plan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-1.5">
                  {modal.pestana === 'extender' ? 'Plan sobre el que se aplica el tiempo extra' : 'Plan a asignar'}
                </label>
                <div className={`grid ${modal.pestana === 'extender' ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
                  {(modal.pestana === 'extender'
                    ? (['profesional', 'agencia'] as const)
                    : (['gratuita', 'profesional', 'agencia'] as const)
                  ).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setModal({
                          ...modal,
                          plan: p,
                          notificarEmail: p === 'gratuita' ? false : modal.notificarEmail,
                        })
                      }
                      disabled={modal.procesando}
                      className={`py-2.5 rounded-lg border text-sm font-bold transition disabled:opacity-50 ${
                        modal.plan === p
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {PLAN_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              {modal.plan !== 'gratuita' && (
                <>
                  {/* Estado: Prueba o Activa */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-1.5">
                      Modalidad
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['trial', 'activa'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setModal({ ...modal, modo: m })}
                          disabled={modal.procesando}
                          className={`py-2 rounded-lg border text-sm font-semibold transition disabled:opacity-50 ${
                            modal.modo === m
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                          }`}
                        >
                          {m === 'trial' ? 'Período de prueba' : 'Suscripción activa'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cantidad de días (presets + campo libre) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-1.5">
                      {modal.pestana === 'extender'
                        ? 'Días extra a sumar (no borra los días que ya tiene)'
                        : 'Duración desde hoy (días)'}
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(modal.pestana === 'extender' ? PRESETS_EXTENDER : PRESETS_ASIGNAR).map(d => (
                        <button
                          key={d}
                          type="button"
                          disabled={modal.procesando}
                          onClick={() => setModal({ ...modal, dias: String(d) })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            modal.dias === String(d)
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {modal.pestana === 'extender' ? `+${d}d` : `${d} días`}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={730}
                        value={modal.dias}
                        onChange={e => setModal({ ...modal, dias: e.target.value })}
                        disabled={modal.procesando}
                        className="w-28 border rounded-lg px-3 py-2 text-sm font-semibold"
                        placeholder="30"
                      />
                      <span className="text-xs text-gray-500">
                        días (puedes indicar cualquier número entre 1 y 730)
                      </span>
                    </div>

                    {fechaNuevaPreview && (
                      <div className="mt-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 text-xs text-emerald-900">
                        {modal.pestana === 'extender' ? 'Nueva fecha tras sumar el tiempo extra: ' : 'Estará vigente hasta el: '}
                        <strong>{formatearFechaLarga(fechaNuevaPreview)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Cupo mensual de créditos incluidos (opcional) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">
                      Créditos mensuales del plan (opcional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={modal.creditosIncluidos}
                      onChange={e => setModal({ ...modal, creditosIncluidos: e.target.value })}
                      disabled={modal.procesando}
                      placeholder={`Estándar del plan: ${modal.plan === 'agencia' ? '20' : '5'} créditos / mes`}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              {modal.plan === 'gratuita' && (
                <p className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  Se cancelarán las suscripciones activas o en prueba y la cuenta pasará al Plan Gratuito (hasta 3 inmuebles activos).
                </p>
              )}

              {/* Mensaje opcional para el email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">
                  Nota personalizada para el usuario (opcional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={modal.motivo}
                  onChange={e => setModal({ ...modal, motivo: e.target.value })}
                  disabled={modal.procesando}
                  placeholder="Ej: Bienvenidos a Venezuela Inmuebles, les regalamos tiempo extra para cargar toda su cartera."
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* Switch de correo específico */}
              <label className="flex items-start gap-2.5 bg-blue-50/70 border border-blue-100 rounded-xl p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modal.notificarEmail}
                  onChange={e => setModal({ ...modal, notificarEmail: e.target.checked })}
                  disabled={modal.procesando}
                  className="mt-0.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  <span className="font-semibold text-gray-900 inline-flex items-center gap-1">
                    <Mail size={13} className="text-brand-primary" />
                    Enviar email específico al usuario
                  </span>
                  <br />
                  {modal.pestana === 'extender'
                    ? 'Recibirá un correo informando los días extra regalados, la nueva fecha de vencimiento y tu nota.'
                    : modal.plan === 'gratuita'
                      ? 'Recibirá un correo informando el cambio al Plan Gratuito.'
                      : 'Recibirá un correo confirmando la activación del plan, su vigencia y beneficios.'}
                </span>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  disabled={modal.procesando}
                  className="flex-1 border py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarPlan}
                  disabled={modal.procesando}
                  className="flex-1 bg-brand-primary text-white py-2.5 rounded-lg font-bold hover:bg-brand-dark disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm"
                >
                  {modal.procesando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {modal.pestana === 'extender'
                    ? `Aplicar +${modal.dias || '?'} días`
                    : modal.plan === 'gratuita'
                      ? 'Pasar a Gratuito'
                      : 'Guardar plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
