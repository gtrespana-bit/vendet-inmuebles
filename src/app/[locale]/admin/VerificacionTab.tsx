'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

// ============================ VERIFICACIÓN TAB ============================
export default function VerificacionTab({ notify }: { notify: (msg: string) => void }) {
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState<'pendiente' | 'todas' | 'aprobada' | 'rechazada'>('pendiente')
  const [rechazoModal, setRechazoModal] = useState<string | null>(null)
  const [rechazoMotivo, setRechazoMotivo] = useState('')
  const [stats, setStats] = useState({ pendientes: 0, aprobadas: 0, rechazadas: 0, total: 0 })

  const cargar = useCallback(async () => {
    setCargando(true)

    // 1. Obtener solicitudes
    let query = supabase
      .from('solicitudes_verificacion')
      .select('id, user_id, pago_movil_telefono, pago_movil_cedula, pago_movil_banco, mensaje, estado, creada_en, revisada_en, rechazo_motivo, cedula_foto_frente_url')
      .order('creada_en', { ascending: false })

    if (filtro !== 'todas') {
      query = query.eq('estado', filtro)
    }

    const { data: sols, error } = await query
    setCargando(false)
    if (error) {
      notify('Error: ' + error.message)
      return
    }

    // 2. Obtener perfiles de esos users
    const userIds = (sols || []).map((s: any) => s.user_id).filter(Boolean)
    let perfilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      // Server-side fetch (RLS) para tener datos completos de todos los perfiles
      const res = await fetch('/api/admin/perfiles-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      })
      const result = await res.json()
      if (result.ok && result.perfiles) {
        result.perfiles.forEach((p: any) => { perfilesMap[p.id] = p })
      }
    }

    // 3. Combinar
    const combinado = (sols || []).map((s: any) => ({
      ...s,
      perfil: perfilesMap[s.user_id] || {},
    }))

    setSolicitudes(combinado)
    setStats({
      pendientes: combinado.filter((s: any) => s.estado === 'pendiente').length,
      aprobadas: combinado.filter((s: any) => s.estado === 'aprobada').length,
      rechazadas: combinado.filter((s: any) => s.estado === 'rechazada').length,
      total: combinado.length,
    })
  }, [filtro, notify])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function aprobarSol(id: string, userId: string, sol: any) {
    // 1. Solicitud aprobada
    const { error: err1 } = await supabase
      .from('solicitudes_verificacion')
      .update({ estado: 'aprobada', revisada_en: new Date().toISOString() })
      .eq('id', id)
    if (err1) { notify('Error aprobando: ' + err1.message); return }

    // 2. Perfil verificado via server-side endpoint (bypass RLS)
    const res = await fetch('/api/admin/verificar-venta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        cedula_numero: sol.pago_movil_cedula || '',
        pago_movil_telefono: sol.pago_movil_telefono || '',
        pago_movil_cedula: sol.pago_movil_cedula || '',
        pago_movil_banco: sol.pago_movil_banco || '',
      }),
    })
    const result = await res.json()
    if (!res.ok) {
      notify('Error perfil: ' + result.error)
      return
    }

    notify('Vendedor verificado correctamente')
    // EMAIL: Notificar al usuario que fue verificado
    try {
      fetch('/api/email-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {})
    } catch {}
    cargar()
  }

  async function rechazarSol(id: string) {
    if (!rechazoMotivo.trim()) { notify('Escribe motivo de rechazo'); return }
    const { error } = await supabase
      .from('solicitudes_verificacion')
      .update({ estado: 'rechazada', rechazo_motivo: rechazoMotivo, revisada_en: new Date().toISOString() })
      .eq('id', id)
    if (error) { notify('Error: ' + error.message); return }
    setRechazoMotivo('')
    setRechazoModal(null)
    notify('Solicitud rechazada')
    cargar()
  }

  if (cargando) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-primary" /></div>

  return (
    <div className="space-y-6">
      {/* Filtro tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['pendiente', 'aprobada', 'rechazada', 'todas'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              filtro === f ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border'
            }`}
          >
            {f === 'pendiente' && `Pendientes (${stats.pendientes})`}
            {f === 'aprobada' && `Aprobadas (${stats.aprobadas})`}
            {f === 'rechazada' && `Rechazadas (${stats.rechazadas})`}
            {f === 'todas' && `Todas (${stats.total})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {solicitudes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">{filtro === 'pendiente' ? '✅' : '📋'}</p>
          <p className="font-medium">Sin solicitudes {filtro !== 'todas' ? filtro : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {solicitudes.map(sol => {
            const perfil = sol.perfil || {}
            const datosCoinciden =
              sol.pago_movil_telefono && perfil.pago_movil_telefono &&
              sol.pago_movil_telefono === perfil.pago_movil_telefono &&
              sol.pago_movil_cedula && perfil.pago_movil_cedula &&
              sol.pago_movil_cedula === perfil.pago_movil_cedula

            return (
              <div key={sol.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-bold text-lg">{perfil.nombre || 'Sin nombre'}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        sol.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        sol.estado === 'aprobada' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {sol.estado}
                      </span>
                    </div>

                    {/* Datos solicitud */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
                      <div>
                        <p className="text-gray-500">Datos de la solicitud:</p>
                        <p><strong>Tel:</strong> {sol.pago_movil_telefono || '-'}</p>
                        <p><strong>Cédula:</strong> {sol.pago_movil_cedula || '-'}</p>
                        <p><strong>Banco:</strong> {sol.pago_movil_banco || '-'}</p>
                        {sol.mensaje && <p><strong>Mensaje:</strong> {sol.mensaje}</p>}
                      </div>
                      <div>
                        <p className="text-gray-500">Datos del perfil:</p>
                        <p><strong>Tel:</strong> {perfil.pago_movil_telefono || 'No registrado'}</p>
                        <p><strong>Cédula:</strong> {perfil.pago_movil_cedula || 'No registrado'}</p>
                        <p><strong>Banco:</strong> {perfil.pago_movil_banco || 'No registrado'}</p>
                      </div>
                    </div>

                    {/* Coincidencia */}
                    <div className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      datosCoinciden ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {datosCoinciden ? 'Datos coinciden' : 'Datos NO coinciden'}
                    </div>

                    {/* Rechazo previo */}
                    {sol.rechazo_motivo && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <strong>Motivo de rechazo anterior:</strong> {sol.rechazo_motivo}
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      Solicitada: {new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(sol.creada_en))}
                    </p>
                  </div>

                  {/* Foto de cedula */}
                  {sol.cedula_foto_frente_url && (
                    <div className="hidden sm:block">
                      <p className="text-xs text-gray-500 mb-1">Cédula:</p>
                      <Image
                        src={supabase.storage.from('cedulas').getPublicUrl(sol.cedula_foto_frente_url).data.publicUrl}
                        alt="Cédula frente"
                        className="w-32 h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition"
                        width={128}
                        height={80}
                        onClick={() => window.open(supabase.storage.from('cedulas').getPublicUrl(sol.cedula_foto_frente_url).data.publicUrl, '_blank')}
                      />
                    </div>
                  )}

                  {/* Acciones */}
                  {sol.estado === 'pendiente' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => aprobarSol(sol.id, sol.user_id, sol)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-bold text-sm flex items-center gap-1 transition"
                      >
                        <ShieldCheck size={16} /> Verificar
                      </button>
                      <button
                        onClick={() => setRechazoModal(sol.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm transition"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal rechazo */}
      {rechazoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fadeIn">
            <h3 className="text-lg font-bold mb-3">Motivo de rechazo</h3>
            <textarea
              value={rechazoMotivo}
              onChange={e => setRechazoMotivo(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 resize-none text-sm"
              placeholder="Por qué se rechaza..."
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRechazoModal(null); setRechazoMotivo('') }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium">Cancelar</button>
              <button onClick={() => rechazarSol(rechazoModal)} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold">Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
