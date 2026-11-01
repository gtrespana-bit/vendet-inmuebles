'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { diagnosticarCausaProbable } from '@/lib/error-diagnostics'
import {
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  EyeOff,
  Clock,
  Server,
  Globe,
  WifiOff,
  Copy,
  Trash2,
  X,
  FlaskConical,
  User,
  Lightbulb,
  Activity,
  Users,
  ShieldAlert,
  Loader2,
} from 'lucide-react'

interface MuestraError {
  fecha?: string
  ruta?: string
  endpoint?: string | null
  accion_previa?: string | null
  user_id?: string | null
  dispositivo?: string | null
  navegador?: string | null
  pais?: string | null
  viewport?: string | null
  status_http?: number | null
}

interface ErrorSistema {
  id: string
  codigo_ref: string
  huella: string
  origen: 'cliente' | 'servidor' | 'api' | 'red' | 'react_boundary'
  severidad: 'critico' | 'error' | 'aviso'
  estado: 'nuevo' | 'en_revision' | 'resuelto' | 'ignorado' | 'reabierto'
  nombre: string
  mensaje: string
  codigo_error: string | null
  ruta: string
  endpoint: string | null
  accion_previa: string | null
  stack: string | null
  ocurrencias: number
  usuarios_afectados: string[]
  ultimo_user_id: string | null
  ultimo_usuario?: {
    id: string
    nombre: string | null
    email: string | null
    tipo_cuenta: string | null
    empresa_nombre: string | null
  } | null
  dispositivo: string | null
  navegador: string | null
  pais: string | null
  muestras: MuestraError[]
  nota_admin: string | null
  primera_vez_en: string
  ultima_vez_en: string
  resuelto_en: string | null
}

const ORIGEN_INFO: Record<string, { label: string; badge: string }> = {
  cliente: { label: 'Navegador', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  react_boundary: { label: 'Pantalla Error', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  api: { label: 'API / 5xx', badge: 'bg-red-50 text-red-700 border-red-200' },
  servidor: { label: 'Servidor SSR', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  red: { label: 'Red usuario', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const ESTADO_STYLE: Record<string, { label: string; cls: string }> = {
  nuevo: { label: 'Nuevo', cls: 'bg-red-100 text-red-800' },
  reabierto: { label: 'Reabierto', cls: 'bg-orange-100 text-orange-800' },
  en_revision: { label: 'En revisión', cls: 'bg-amber-100 text-amber-800' },
  resuelto: { label: 'Resuelto', cls: 'bg-emerald-100 text-emerald-800' },
  ignorado: { label: 'Ignorado', cls: 'bg-gray-100 text-gray-600' },
}

const SEVERIDAD_DOT: Record<string, string> = {
  critico: 'bg-red-600',
  error: 'bg-orange-500',
  aviso: 'bg-amber-400',
}

function tiempoRelativo(iso: string): string {
  const diffSeg = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (diffSeg < 60) return 'Hace unos segundos'
  const min = Math.floor(diffSeg / 60)
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Hace ${h} h`
  const d = Math.floor(h / 24)
  return `Hace ${d} ${d === 1 ? 'día' : 'días'}`
}

function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function ErroresTab({
  notify,
  onConteoChange,
}: {
  notify: (msg: string) => void
  onConteoChange?: (activos: number) => void
}) {
  const [errores, setErrores] = useState<ErrorSistema[]>([])
  const [kpis, setKpis] = useState({ activos: 0, eventos24h: 0, usuarios24h: 0, resueltos: 0 })
  const [estadoFiltro, setEstadoFiltro] = useState<'activos' | 'en_revision' | 'resuelto' | 'ignorado' | 'todos'>('activos')
  const [origenFiltro, setOrigenFiltro] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [procesandoAccion, setProcesandoAccion] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ErrorSistema | null>(null)
  const [notaDraft, setNotaDraft] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const qs = new URLSearchParams({
        estado: estadoFiltro,
        origen: origenFiltro,
        dias: '60',
      })
      if (busqueda.trim()) qs.set('q', busqueda.trim())

      const res = await fetch(`/api/admin/errores?${qs.toString()}`, {
        headers: await getSupabaseAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo consultar el monitor')

      setErrores(json.errores || [])
      if (json.kpis) {
        setKpis(json.kpis)
        onConteoChange?.(json.kpis.activos || 0)
      }
    } catch (err: any) {
      notify('❌ Error cargando monitor: ' + (err.message || 'desconocido'))
    } finally {
      setCargando(false)
    }
  }, [estadoFiltro, origenFiltro, busqueda, notify, onConteoChange])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function cambiarEstado(id: string, nuevoEstado: ErrorSistema['estado'], nota?: string) {
    setProcesandoAccion(true)
    try {
      const res = await fetch('/api/admin/errores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({
          id,
          estado: nuevoEstado,
          ...(nota !== undefined ? { notaAdmin: nota } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'desconocido')

      notify(`✅ Estado actualizado a ${ESTADO_STYLE[nuevoEstado]?.label || nuevoEstado}`)
      if (seleccionado?.id === id) {
        setSeleccionado(prev => (prev ? { ...prev, estado: nuevoEstado, nota_admin: nota ?? prev.nota_admin } : null))
      }
      await cargar()
    } catch (err: any) {
      notify('❌ ' + (err.message || 'No se pudo actualizar'))
    } finally {
      setProcesandoAccion(false)
    }
  }

  async function guardarNota(id: string) {
    setProcesandoAccion(true)
    try {
      const res = await fetch('/api/admin/errores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({ id, notaAdmin: notaDraft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'desconocido')
      notify('✅ Nota guardada')
      setSeleccionado(prev => (prev ? { ...prev, nota_admin: notaDraft } : null))
      await cargar()
    } catch (err: any) {
      notify('❌ ' + (err.message || 'Error guardando nota'))
    } finally {
      setProcesandoAccion(false)
    }
  }

  async function dispararPrueba() {
    setProcesandoAccion(true)
    try {
      const res = await fetch('/api/admin/errores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({ accion: 'prueba' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'desconocido')
      notify(`✅ Evento de prueba registrado (${json.codigoRef || 'OK'})`)
      setEstadoFiltro('activos')
      await cargar()
    } catch (err: any) {
      notify('❌ ' + (err.message || 'Error en prueba'))
    } finally {
      setProcesandoAccion(false)
    }
  }

  async function eliminarRegistro(id: string) {
    setProcesandoAccion(true)
    try {
      const res = await fetch(`/api/admin/errores?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: await getSupabaseAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'desconocido')
      notify('🗑️ Registro eliminado')
      if (seleccionado?.id === id) setSeleccionado(null)
      await cargar()
    } catch (err: any) {
      notify('❌ ' + (err.message || 'Error al eliminar'))
    } finally {
      setProcesandoAccion(false)
    }
  }

  async function limpiarResueltosAntiguos() {
    setProcesandoAccion(true)
    try {
      const res = await fetch('/api/admin/errores?limpiarAntiguosDias=30', {
        method: 'DELETE',
        headers: await getSupabaseAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'desconocido')
      notify(`🧹 Se limpiaron ${json.eliminados || 0} errores resueltos/ignorados antiguos`)
      await cargar()
    } catch (err: any) {
      notify('❌ ' + (err.message || 'Error en limpieza'))
    } finally {
      setProcesandoAccion(false)
    }
  }

  function copiarInformeTecnico(e: ErrorSistema) {
    const diag = diagnosticarCausaProbable(e)
    const texto = [
      `=== INFORME DE ERROR · VENEZUELA INMUEBLES ===`,
      `Referencia: ${e.codigo_ref}`,
      `Estado: ${e.estado} | Severidad: ${e.severidad} | Origen: ${e.origen}`,
      `Error: ${e.nombre}${e.codigo_error ? ` (Código: ${e.codigo_error})` : ''}`,
      `Mensaje: ${e.mensaje}`,
      `Página / Ruta: ${e.ruta}`,
      e.endpoint ? `Endpoint: ${e.endpoint}` : null,
      e.accion_previa ? `Última acción del usuario: ${e.accion_previa}` : null,
      `Ocurrencias: ${e.ocurrencias} | Primera vez: ${formatearFechaHora(e.primera_vez_en)} | Última vez: ${formatearFechaHora(e.ultima_vez_en)}`,
      `Entorno: ${e.dispositivo || '—'} · ${e.navegador || '—'} · País: ${e.pais || '—'}`,
      `Diagnóstico sugerido: ${diag.titulo} — ${diag.solucion}`,
      e.stack ? `\nStack trace:\n${e.stack}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    navigator.clipboard
      .writeText(texto)
      .then(() => notify('📋 Informe técnico copiado al portapapeles'))
      .catch(() => notify('❌ No se pudo copiar automáticamente'))
  }

  return (
    <div className="space-y-5">
      {/* Tarjetas de resumen KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Errores activos</p>
            <p className={`text-2xl font-black mt-0.5 ${kpis.activos > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {kpis.activos}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${kpis.activos > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Ocurrencias (24h)</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{kpis.eventos24h}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Activity size={20} />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Usuarios afectados (24h)</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{kpis.usuarios24h}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Resueltos</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">{kpis.resueltos}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Barra de búsqueda + acciones */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código (ERR-..., 500, 42501), ruta (/publicar) o mensaje..."
            className="w-full border rounded-xl pl-9 pr-4 py-2.5 text-sm"
          />
        </div>

        <select
          value={origenFiltro}
          onChange={e => setOrigenFiltro(e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm bg-white font-medium text-gray-700"
        >
          <option value="todos">Todos los orígenes</option>
          <option value="cliente">Navegador (JS)</option>
          <option value="react_boundary">Pantalla de error</option>
          <option value="api">API / HTTP 5xx</option>
          <option value="servidor">Servidor SSR</option>
          <option value="red">Red usuario</option>
        </select>

        <button
          onClick={dispararPrueba}
          disabled={procesandoAccion}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 disabled:opacity-50"
          title="Envía un evento de prueba controlado para comprobar que el monitor interno registra y agrupa correctamente"
        >
          <FlaskConical size={15} className="text-brand-primary" />
          Probar detector
        </button>

        <button
          onClick={limpiarResueltosAntiguos}
          disabled={procesandoAccion}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border bg-white hover:bg-gray-50 text-xs font-medium text-gray-600 disabled:opacity-50"
          title="Eliminar resueltos o ignorados de más de 30 días"
        >
          <Trash2 size={14} />
          Limpiar +30d
        </button>

        <button
          onClick={cargar}
          className="p-2.5 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center"
          title="Refrescar"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: 'activos', label: `Activos (${kpis.activos})` },
          { id: 'en_revision', label: 'En revisión' },
          { id: 'resuelto', label: `Resueltos (${kpis.resueltos})` },
          { id: 'ignorado', label: 'Ignorados' },
          { id: 'todos', label: 'Todos' },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setEstadoFiltro(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              estadoFiltro === f.id
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Listado de errores agrupados */}
      {cargando ? (
        <div className="py-14 flex items-center justify-center text-gray-400 gap-2 text-sm">
          <Loader2 size={18} className="animate-spin text-brand-primary" />
          Cargando registro interno de errores...
        </div>
      ) : errores.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={26} />
          </div>
          <p className="font-bold text-gray-800">Sin errores registrados en esta vista</p>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Cualquier fallo de JavaScript, pantalla rota, respuesta HTTP 5xx o excepción de servidor sufrida por un usuario aparecerá aquí automáticamente agrupado y sin datos privados sensibles.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {errores.map(err => {
            const orig = ORIGEN_INFO[err.origen] || ORIGEN_INFO.cliente
            const est = ESTADO_STYLE[err.estado] || ESTADO_STYLE.nuevo
            const diag = diagnosticarCausaProbable(err)

            return (
              <div
                key={err.id}
                onClick={() => {
                  setSeleccionado(err)
                  setNotaDraft(err.nota_admin || '')
                }}
                className="bg-white rounded-xl border border-gray-200 hover:border-brand-primary/40 hover:shadow-sm transition p-4 cursor-pointer"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Cabecera de badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${SEVERIDAD_DOT[err.severidad] || 'bg-orange-500'}`} />
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                        {err.codigo_ref}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${est.cls}`}>
                        {est.label}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${orig.badge}`}>
                        {orig.label}
                      </span>
                      {err.codigo_error && (
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
                          Código: {err.codigo_error}
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                        ×{err.ocurrencias} {err.ocurrencias === 1 ? 'vez' : 'veces'}
                      </span>
                    </div>

                    {/* Título y mensaje */}
                    <p className="font-bold text-gray-900 text-sm break-words">
                      <span className="text-brand-primary">{err.nombre}:</span> {err.mensaje}
                    </p>

                    {/* Ruta + acción previa + usuario */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="font-mono text-gray-700">
                        📍 {err.endpoint || err.ruta}
                      </span>
                      {err.accion_previa && (
                        <span className="text-gray-600">👆 {err.accion_previa}</span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {tiempoRelativo(err.ultima_vez_en)} ({formatearFechaHora(err.ultima_vez_en)})
                      </span>
                      {err.ultimo_usuario ? (
                        <span className="inline-flex items-center gap-1 text-purple-700 font-medium">
                          <User size={12} />
                          {err.ultimo_usuario.empresa_nombre || err.ultimo_usuario.nombre || err.ultimo_usuario.email}
                        </span>
                      ) : (
                        <span className="text-gray-400">Visitante / sin sesión</span>
                      )}
                    </div>

                    {/* Pista rápida */}
                    <p className="text-xs text-amber-800 bg-amber-50/70 border border-amber-100 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5">
                      <Lightbulb size={12} className="text-amber-600 shrink-0" />
                      <span>
                        <strong>{diag.titulo}:</strong> {diag.causa}
                      </span>
                    </p>
                  </div>

                  {/* Botones rápidos sin abrir modal */}
                  <div className="flex lg:flex-col items-center justify-end gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {err.estado !== 'resuelto' && (
                      <button
                        onClick={() => cambiarEstado(err.id, 'resuelto')}
                        disabled={procesandoAccion}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} />
                        Resolver
                      </button>
                    )}
                    {err.estado !== 'ignorado' && (
                      <button
                        onClick={() => cambiarEstado(err.id, 'ignorado')}
                        disabled={procesandoAccion}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition inline-flex items-center gap-1"
                      >
                        <EyeOff size={13} />
                        Ignorar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de inspección detallada ("Cuándo, cómo, por qué y solución") */}
      {seleccionado && (() => {
        const diag = diagnosticarCausaProbable(seleccionado)
        const est = ESTADO_STYLE[seleccionado.estado] || ESTADO_STYLE.nuevo

        return (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSeleccionado(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-auto max-h-[90vh] overflow-y-auto space-y-4"
              onClick={e => e.stopPropagation()}
            >
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-gray-900 text-white">
                      {seleccionado.codigo_ref}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${est.cls}`}>
                      {est.label}
                    </span>
                    {seleccionado.codigo_error && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                        Código: {seleccionado.codigo_error}
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-lg text-gray-900 break-words">
                    {seleccionado.nombre}: {seleccionado.mensaje}
                  </h3>
                </div>
                <button
                  onClick={() => setSeleccionado(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Diagnóstico inteligente en español */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-900 flex items-center gap-1.5">
                  <Lightbulb size={15} className="text-amber-600" />
                  Diagnóstico rápido: {diag.titulo}
                </p>
                <p className="text-sm text-gray-800">{diag.causa}</p>
                <p className="text-xs text-gray-700 pt-1">
                  <strong>Acción recomendada:</strong> {diag.solucion}
                </p>
              </div>

              {/* Cuándo y cómo sucedió */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50 border rounded-xl p-4">
                <div>
                  <p className="text-gray-400 font-semibold uppercase">Cuándo ocurrió</p>
                  <p className="text-gray-800 font-medium mt-0.5">
                    Última vez: <strong>{formatearFechaHora(seleccionado.ultima_vez_en)}</strong>
                  </p>
                  <p className="text-gray-600">
                    Primera vez: {formatearFechaHora(seleccionado.primera_vez_en)}
                  </p>
                  <p className="text-gray-600">
                    Frecuencia: <strong>{seleccionado.ocurrencias}</strong> ocurrencia(s) ·{' '}
                    <strong>{seleccionado.usuarios_afectados?.length || 0}</strong> usuario(s) autenticado(s)
                  </p>
                </div>

                <div>
                  <p className="text-gray-400 font-semibold uppercase">Dónde y cómo ocurrió</p>
                  <p className="text-gray-800 font-mono break-all mt-0.5">
                    Página: {seleccionado.ruta}
                  </p>
                  {seleccionado.endpoint && (
                    <p className="text-gray-800 font-mono break-all">
                      Endpoint: {seleccionado.endpoint}
                    </p>
                  )}
                  <p className="text-gray-700 mt-0.5">
                    Acción previa: <strong>{seleccionado.accion_previa || 'Carga / navegación directa'}</strong>
                  </p>
                  <p className="text-gray-600 inline-flex items-center gap-1 mt-0.5">
                    {seleccionado.origen === 'servidor' || seleccionado.origen === 'api' ? (
                      <Server size={12} />
                    ) : seleccionado.origen === 'red' ? (
                      <WifiOff size={12} />
                    ) : (
                      <Globe size={12} />
                    )}
                    {seleccionado.dispositivo || '—'} · {seleccionado.navegador || '—'}
                    {seleccionado.pais ? ` · País: ${seleccionado.pais}` : ''}
                  </p>
                </div>
              </div>

              {/* Último usuario afectado */}
              {seleccionado.ultimo_usuario && (
                <div className="bg-purple-50/60 border border-purple-100 rounded-xl px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-gray-500">Último usuario autenticado afectado: </span>
                    <strong className="text-gray-900">
                      {seleccionado.ultimo_usuario.empresa_nombre || seleccionado.ultimo_usuario.nombre || 'Sin nombre'}
                    </strong>
                    {seleccionado.ultimo_usuario.email ? ` (${seleccionado.ultimo_usuario.email})` : ''}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white border text-purple-700 font-semibold capitalize">
                    {seleccionado.ultimo_usuario.tipo_cuenta || 'particular'}
                  </span>
                </div>
              )}

              {/* Traza técnica sanitizada */}
              {seleccionado.stack && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold uppercase text-gray-500">Traza técnica (sanitizada)</p>
                    <button
                      type="button"
                      onClick={() => copiarInformeTecnico(seleccionado)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary hover:underline"
                    >
                      <Copy size={13} /> Copiar informe completo
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 text-[11px] leading-relaxed p-3.5 rounded-xl overflow-x-auto max-h-52 font-mono whitespace-pre-wrap break-words">
                    {seleccionado.stack}
                  </pre>
                </div>
              )}

              {/* Últimas muestras */}
              {Array.isArray(seleccionado.muestras) && seleccionado.muestras.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 mb-1.5">
                    Últimas {seleccionado.muestras.length} ocurrencias registradas
                  </p>
                  <div className="border rounded-xl divide-y text-xs">
                    {seleccionado.muestras.map((m, idx) => (
                      <div key={idx} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-gray-700">{m.endpoint || m.ruta || '/'}</span>
                        <span className="text-gray-500">
                          {m.accion_previa ? `${m.accion_previa} · ` : ''}
                          {m.dispositivo || '—'}/{m.navegador || '—'}
                          {m.viewport ? ` (${m.viewport})` : ''} · {formatearFechaHora(m.fecha)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nota interna de seguimiento */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                  Nota interna del administrador
                </label>
                <div className="flex gap-2">
                  <input
                    value={notaDraft}
                    onChange={e => setNotaDraft(e.target.value)}
                    placeholder="Ej: Resuelto al ajustar validación en /publicar..."
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => guardarNota(seleccionado.id)}
                    disabled={procesandoAccion}
                    className="px-3.5 py-2 rounded-lg border font-semibold text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    Guardar nota
                  </button>
                </div>
              </div>

              {/* Botonera inferior */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cambiarEstado(seleccionado.id, 'resuelto', notaDraft)}
                    disabled={procesandoAccion}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Marcar resuelto
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(seleccionado.id, 'en_revision', notaDraft)}
                    disabled={procesandoAccion}
                    className="px-3.5 py-2 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold hover:bg-amber-200 disabled:opacity-50"
                  >
                    En revisión
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(seleccionado.id, 'ignorado', notaDraft)}
                    disabled={procesandoAccion}
                    className="px-3.5 py-2 rounded-lg border text-gray-700 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <EyeOff size={14} /> Ignorar
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copiarInformeTecnico(seleccionado)}
                    className="px-3 py-2 rounded-lg border text-xs font-semibold text-brand-primary hover:bg-blue-50 inline-flex items-center gap-1"
                  >
                    <Copy size={13} /> Copiar informe
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarRegistro(seleccionado.id)}
                    disabled={procesandoAccion}
                    className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Eliminar registro permanentemente"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
