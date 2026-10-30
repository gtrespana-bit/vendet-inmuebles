'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { Search, RefreshCw, Sparkles, Crown, X, Loader2, Check } from 'lucide-react'

// Gestión de planes de suscripción por usuario.
// Lectura directa (RLS permite SELECT a admins); escritura vía /api/admin/planes.

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

interface UsuarioPlan {
  id: string
  nombre: string | null
  email: string | null
  tipo_cuenta: string | null
  plan: string
  estado: string | null
  fin: string | null
  trial_ends_at: string | null
  creditos_incluidos: number | null
}

interface ModalState {
  user: UsuarioPlan
  plan: string
  modo: 'activa' | 'trial'
  procesando: boolean
}

export default function PlanesTab({ notify }: { notify: (msg: string) => void }) {
  const [usuarios, setUsuarios] = useState<UsuarioPlan[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState<ModalState | null>(null)

  async function cargar() {
    setCargando(true)
    const [{ data: perfiles }, { data: subs }] = await Promise.all([
      supabase.from('perfiles').select('id, nombre, email, tipo_cuenta').limit(1000),
      supabase
        .from('suscripciones')
        .select('user_id, plan, estado, fin, trial_ends_at, creditos_incluidos, created_at')
        .in('estado', ['activa', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1000),
    ])

    const subByUser = new Map<string, any>()
    ;(subs || []).forEach((s: any) => { if (!subByUser.has(s.user_id)) subByUser.set(s.user_id, s) })

    const lista: UsuarioPlan[] = (perfiles || []).map((p: any) => {
      const sub = subByUser.get(p.id)
      return {
        id: p.id,
        nombre: p.nombre,
        email: p.email || null,
        tipo_cuenta: p.tipo_cuenta,
        plan: sub?.plan || 'gratuita',
        estado: sub?.estado || null,
        fin: sub?.fin || null,
        trial_ends_at: sub?.trial_ends_at || null,
        creditos_incluidos: sub?.creditos_incluidos ?? null,
      }
    })
    setUsuarios(lista)
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const filtrados = usuarios.filter(u => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (u.nombre || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  })

  async function guardarPlan() {
    if (!modal) return
    setModal({ ...modal, procesando: true })
    try {
      const res = await fetch('/api/admin/planes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({ userId: modal.user.id, plan: modal.plan, modo: modal.modo }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'desconocido')
      notify(`✅ Plan de ${modal.user.nombre || 'usuario'} actualizado a ${PLAN_LABEL[modal.plan]}`)
      setModal(null)
      await cargar()
    } catch (err: any) {
      notify('❌ Error: ' + (err.message || 'desconocido'))
      setModal({ ...modal, procesando: false })
    }
  }

  const fechaVigencia = (u: UsuarioPlan) => {
    const iso = u.estado === 'trial' ? u.trial_ends_at : u.fin
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm" />
        </div>
        <button onClick={cargar} className="p-2.5 rounded-xl border hover:bg-gray-50" title="Refrescar">
          <RefreshCw size={18} />
        </button>
      </div>

      <p className="text-sm text-gray-500">
        {filtrados.length} usuarios · {usuarios.filter(u => u.plan !== 'gratuita').length} con plan de pago
      </p>

      {cargando ? (
        <div className="text-center py-12 text-gray-400">Cargando planes...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-bold">Usuario</th>
                  <th className="text-left py-3 px-4 font-bold">Plan</th>
                  <th className="text-center py-3 px-4 font-bold hidden sm:table-cell">Estado</th>
                  <th className="text-center py-3 px-4 font-bold hidden md:table-cell">Vence / Prueba hasta</th>
                  <th className="text-center py-3 px-4 font-bold hidden md:table-cell">Créditos incl.</th>
                  <th className="text-center py-3 px-4 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-800">{u.nombre || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-400">{u.email || '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold ${PLAN_STYLE[u.plan] || PLAN_STYLE.gratuita}`}>
                        {u.plan === 'agencia' && <Crown size={11} />}
                        {u.plan === 'profesional' && <Sparkles size={11} />}
                        {PLAN_LABEL[u.plan] || u.plan}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.estado ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.estado === 'trial' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                          {ESTADO_LABEL[u.estado] || u.estado}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-500">{fechaVigencia(u)}</td>
                    <td className="py-3 px-4 text-center text-xs text-gray-500">{u.creditos_incluidos ?? '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setModal({ user: u, plan: u.plan === 'gratuita' ? 'profesional' : u.plan, modo: u.estado === 'trial' ? 'trial' : 'activa', procesando: false })}
                        className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-100 font-medium">
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-gray-400">No hay usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal gestión de plan */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !modal.procesando && setModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg">Plan de {modal.user.nombre || 'usuario'}</h3>
              <button onClick={() => setModal(null)} disabled={modal.procesando} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-40">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{modal.user.email}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['gratuita', 'profesional', 'agencia'] as const).map(p => (
                    <button key={p} onClick={() => setModal({ ...modal, plan: p })}
                      disabled={modal.procesando}
                      className={`py-2.5 rounded-lg border text-sm font-bold transition disabled:opacity-50 ${
                        modal.plan === p ? 'bg-brand-primary text-white border-brand-primary' : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                      }`}>
                      {PLAN_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              {modal.plan !== 'gratuita' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Estado</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['trial', 'activa'] as const).map(m => (
                      <button key={m} onClick={() => setModal({ ...modal, modo: m })}
                        disabled={modal.procesando}
                        className={`py-2.5 rounded-lg border text-sm font-semibold transition disabled:opacity-50 ${
                          modal.modo === m ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                        }`}>
                        {m === 'trial' ? 'Prueba 30 días' : 'Activa 30 días'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {modal.modo === 'trial'
                      ? 'El usuario tendrá el plan 30 días en modo prueba, sin cobro.'
                      : 'Suscripción activa por 30 días (renovable).'}
                  </p>
                </div>
              )}

              {modal.plan === 'gratuita' && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                  Se cancelarán las suscripciones vigentes y el usuario volverá al plan Gratuito (1 anuncio activo).
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(null)} disabled={modal.procesando}
                  className="flex-1 border py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={guardarPlan} disabled={modal.procesando}
                  className="flex-1 bg-brand-primary text-white py-2.5 rounded-lg font-bold hover:bg-brand-dark disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {modal.procesando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
