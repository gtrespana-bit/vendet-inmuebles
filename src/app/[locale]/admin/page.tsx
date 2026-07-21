'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import {
  CreditCard, Shield, Users, BarChart3, ShieldCheck,
  Package, Star, Pause, Play, Trash2, Search, RefreshCw,
  SortAsc, SortDesc, ExternalLink, Zap, ChevronDown,
  Megaphone, Download, Eye, Loader2, Check, X, Tag
} from 'lucide-react'
import VerificacionTab from './VerificacionTab'
import Image from 'next/image'

import { ADMIN_EMAILS } from '@/lib/admin-config'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'publicaciones', label: 'Publicaciones', icon: Package },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'verificacion', label: 'Verificación', icon: ShieldCheck },
]

const QUICK_LINKS = [
  { label: 'Moderación', target: 'moderacion', icon: Shield },
  { label: 'Transacciones', target: 'transacciones', icon: CreditCard },
  { label: 'Anuncios', target: 'anuncios', icon: Megaphone },
  { label: 'Categorías', target: 'categorias', icon: ChevronDown },
  { label: 'Exportar', target: 'exportar', icon: Download },
]

interface Notifier {
  notify: (msg: string) => void
}

// ============================ METRICAS TAB ============================
function MetricasTab() {
  const [stats, setStats] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ count: totalUsuarios }, { count: totalProductos }, { count: activos }] = await Promise.all([
        supabase.from('perfiles').select('*', { count: 'exact', head: true }),
        supabase.from('productos').select('*', { count: 'exact', head: true }),
        supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
      ])

      const { data: trans } = await supabase
        .from('transacciones_creditos')
        .select('monto, estado, tipo, creado_en')
        .limit(1000)

      const ingresos = trans?.filter((t: any) => t.estado === 'aprobado' && t.tipo === 'compra').reduce((s: number, t: any) => s + t.monto, 0) || 0
      const hoy = new Date().toISOString().split('T')[0]
      const nuevosHoy = trans?.filter((t: any) => t.creado_en?.startsWith(hoy) && t.estado === 'aprobado').length || 0

      setStats({
        totalUsuarios: totalUsuarios || 0,
        totalProductos: totalProductos || 0,
        productosActivos: activos || 0,
        ingresosUSD: ingresos,
        nuevosHoy,
      })
      setCargando(false)
    }
    load()
  }, [])

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando métricas...</div>

  const cards = [
    { label: 'Usuarios', value: stats.totalUsuarios, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Productos', value: stats.totalProductos, icon: Package, color: 'bg-green-50 text-green-600' },
    { label: 'Activos', value: stats.productosActivos, icon: Zap, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Créditos vendidos', value: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(stats.ingresosUSD)), icon: CreditCard, color: 'bg-purple-50 text-purple-600' },
    { label: 'Ventas hoy', value: stats.nuevosHoy, icon: Star, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Pausados', value: stats.totalProductos - stats.productosActivos, icon: Pause, color: 'bg-gray-50 text-gray-500' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className={`inline-flex p-2 rounded-lg ${c.color} mb-2`}><c.icon size={20} /></div>
            <p className="text-2xl font-black text-gray-800">{c.value}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================ USUARIOS TAB ============================
type SortField = 'nombre' | 'creado_en' | 'credito_balance' | 'verificado' | 'ultima_actividad'
type SortDir = 'asc' | 'desc'

function UsuariosTab({ notify }: Notifier) {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('creado_en')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [cargando, setCargando] = useState(true)
  const [creditModal, setCreditModal] = useState<string | null>(null)
  const [creditCantidad, setCreditCantidad] = useState('')
  const [creditMotivo, setCreditMotivo] = useState('')
  const [creditProcesando, setCreditProcesando] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('perfiles')
        .select('*')
        .limit(1000)
      if (data) setUsuarios(data)
      setCargando(false)
    }
    load()
  }, [])

  const filtrados = useMemo(() => {
    let list = [...usuarios]
    if (busqueda) {
      const q = busqueda.toLowerCase()
      list = list.filter(u =>
        (u.nombre || '').toLowerCase().includes(q) ||
        (u.email_publico || '').toLowerCase().includes(q) ||
        (u.telefono || '').toLowerCase().includes(q) ||
        (u.ciudad || '').toLowerCase().includes(q) ||
        (u.estado || '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      const aVal = a[sortBy] ?? ''
      const bVal = b[sortBy] ?? ''
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [usuarios, busqueda, sortBy, sortDir])

  async function toggleSort(field: SortField) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
  }

  async function añadirCreditos(userId: string) {
    if (!creditCantidad || parseInt(creditCantidad) < 1) return
    setCreditProcesando(true)
    try {
      const res = await fetch('/api/admin/add-creditos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          cantidad: parseInt(creditCantidad),
          motivo: creditMotivo || 'Manual admin',
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'desconocido')

      const perfil = usuarios.find(u => u.id === userId)
      notify(`✅ +${creditCantidad} créditos a ${perfil?.nombre || 'usuario'}`)

      // Telegram notification
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mensaje: `💰 Creditos Admin\n+${creditCantidad} créditos a ${perfil?.nombre || 'Usuario'}\nMotivo: ${creditMotivo || 'N/A'}`,
          }),
        })
      } catch {}

      setCreditModal(null)
      setCreditCantidad('')
      setCreditMotivo('')
      // reload user list
      await supabase.from('perfiles').select('id, nombre, telefono, estado, ciudad, credito_balance, verificado, nivel_confianza, creado_en').limit(1000).then(({data}: {data: any[]}) => {
        if (data) setUsuarios(data)
      })
    } catch (err: any) {
      notify('❌ Error: ' + (err.message || 'desconocido'))
    }
    setCreditProcesando(false)
  }

  async function toggleVerificado(userId: string, estado: boolean) {
    const res = await fetch('/api/admin/toggle-verificado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, verificado: estado }),
    })
    const result = await res.json()
    if (!res.ok) {
      notify('❌ Error: ' + (result.error || 'desconocido'))
      return
    }
    notify(estado ? '✅ Usuario verificado' : '⏸️ Verificación removida')
    setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, verificado: estado } : u))
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <SortAsc size={14} className="text-gray-300" />
    return sortDir === 'asc' ? <SortAsc size={14} className="text-brand-primary" /> : <SortDesc size={14} className="text-brand-primary" />
  }

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando usuarios...</div>

  return (
    <div className="space-y-4">
      {/* Buscador + filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Nombre, email, teléfono, ciudad..."
            className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm" />
        </div>
        <button onClick={async () => {
          setCargando(true)
          const { data } = await supabase.from('perfiles').select('id, nombre, telefono, estado, ciudad, credito_balance, verificado, nivel_confianza, creado_en').limit(1000)
          if (data) setUsuarios(data); setCargando(false)
        }} className="p-2.5 rounded-xl border hover:bg-gray-50" title="Refrescar">
          <RefreshCw size={18} />
        </button>
      </div>

      <p className="text-sm text-gray-500">{filtrados.length} usuarios {busqueda && `(filtrados de ${usuarios.length})`}</p>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-bold">Nombre</th>
                <th className="text-left py-3 px-4 font-bold hidden md:table-cell">Email</th>
                <th className="text-left py-3 px-4 font-bold hidden sm:table-cell">Teléfono</th>
                <th className="text-left py-3 px-4 font-bold hidden lg:table-cell">Ubicación</th>
                <th
                  className="py-3 px-4 font-bold text-center cursor-pointer hover:text-brand-primary"
                  onClick={() => toggleSort('credito_balance')}
                >
                  <span className="inline-flex items-center gap-1">Créditos <SortIcon field="credito_balance" /></span>
                </th>
                <th
                  className="py-3 px-4 font-bold text-center hidden sm:table-cell cursor-pointer hover:text-brand-primary"
                  onClick={() => toggleSort('verificado')}
                >
                  <span className="inline-flex items-center gap-1">Verificado</span>
                </th>
                <th
                  className="py-3 px-4 font-bold text-center hidden lg:table-cell cursor-pointer hover:text-brand-primary"
                  onClick={() => toggleSort('creado_en')}
                >
                  <span className="inline-flex items-center gap-1">Registro <SortIcon field="creado_en" /></span>
                </th>
                <th className="py-3 px-4 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, 200).map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{u.nombre || 'Sin nombre'}</span>
                      {u.verificado && <span className="text-blue-500">✓</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-gray-500 text-xs">{u.email_publico || '—'}</td>
                  <td className="py-3 px-4 hidden sm:table-cell">{u.telefono || '—'}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-gray-500 text-xs">{u.ciudad && u.estado ? `${u.ciudad}, ${u.estado}` : '—'}</td>
                  <td className="py-3 px-4 text-center font-bold text-brand-primary">{u.credito_balance || 0}</td>
                  <td className="py-3 px-4 text-center hidden sm:table-cell">
                    <button onClick={() => toggleVerificado(u.id, !u.verificado)}
                      className={`text-xs px-2 py-1 rounded-full font-medium ${u.verificado ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}>
                      {u.verificado ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-400 text-xs hidden lg:table-cell">{u.creado_en ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(u.creado_en)) : '—'}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setCreditModal(u.id); setCreditCantidad(''); setCreditMotivo('') }}
                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Añadir créditos">
                        <CreditCard size={14} />
                      </button>
                      <button onClick={() => window.open(`/vendedor/${u.id}`, '_blank')}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Ver perfil">
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal créditos */}
      {creditModal && (() => {
        const user = usuarios.find(u => u.id === creditModal)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCreditModal(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4">💰 Añadir créditos a {user?.nombre || 'usuario'}</h3>
              <p className="text-sm text-gray-500 mb-4">Balance actual: <span className="font-bold text-brand-primary">{user?.credito_balance || 0} créditos</span></p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cantidad</label>
                  <input type="number" value={creditCantidad} onChange={e => setCreditCantidad(e.target.value)}
                    placeholder="Ej: 5" min="1" className="w-full border rounded-lg px-4 py-2.5 text-sm" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Motivo (opcional)</label>
                  <input type="text" value={creditMotivo} onChange={e => setCreditMotivo(e.target.value)}
                    placeholder="Ej: Bonus, corrección..." className="w-full border rounded-lg px-4 py-2.5 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCreditModal(null)} className="flex-1 border py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancelar</button>
                  <button onClick={() => añadirCreditos(creditModal!)} disabled={!creditCantidad || parseInt(creditCantidad) < 1 || creditProcesando}
                    className="flex-1 bg-green-500 text-white py-2.5 rounded-lg font-bold hover:bg-green-600 disabled:opacity-50">
                    {creditProcesando ? 'Añadiendo...' : `Añadir ${creditCantidad || '?'} créditos`}
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

// ============================ PUBLICACIONES TAB ============================
function PublicacionesTab({ notify }: Notifier) {
  const [publicaciones, setPublicaciones] = useState<any[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'activas' | 'pausadas' | 'pendientes'>('todas')
  const [sortBy, setSortBy] = useState<'creado_en' | 'precio_usd' | 'visitas' | 'titulo'>('creado_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('productos').select('id, titulo, precio_usd, estado, categoria_id, subcategoria, marca, ubicacion_ciudad, activo, visitas, creado_en, user_id, imagen_url, destacado, destacado_hasta, boosteado_en, estado_moderacion').order('creado_en', { ascending: false }).limit(500)
      if (data) setPublicaciones(data)
      setCargando(false)
    }
    load()
  }, [])

  const filtradas = useMemo(() => {
    let list = [...publicaciones]
    if (filtro === 'activas') list = list.filter(p => p.activo && p.estado_moderacion === 'aprobado')
    else if (filtro === 'pausadas') list = list.filter(p => !p.activo)
    else if (filtro === 'pendientes') list = list.filter(p => p.estado_moderacion === 'pendiente')
    
    if (busqueda) {
      const q = busqueda.toLowerCase()
      list = list.filter(p =>
        (p.titulo || '').toLowerCase().includes(q) ||
        (p.ubicacion_ciudad || '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      const aVal = a[sortBy] ?? ''
      const bVal = b[sortBy] ?? ''
      const cmp = typeof aVal === 'number' && typeof bVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [publicaciones, busqueda, filtro, sortBy, sortDir])

  async function toggleActivo(id: string, activo: boolean) {
    setProcesando(id)
    const res = await fetch('/api/admin/toggle-activo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, activo }),
    })
    const result = await res.json()
    setProcesando(null)
    if (!res.ok) {
      notify('❌ Error: ' + (result.error || 'desconocido'))
      return
    }
    notify(activo ? '✅ Publicación activada' : '⏸️ Publicación pausada')
    setPublicaciones(prev => prev.map(p => p.id === id ? { ...p, activo } : p))
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta publicación permanentemente?')) return
    setProcesando(id)
    const res = await fetch('/api/admin/eliminar-producto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id }),
    })
    const result = await res.json()
    setProcesando(null)
    if (!res.ok) {
      notify('❌ Error: ' + (result.error || 'desconocido'))
      return
    }
    notify('🗑️ Publicación eliminada')
    setPublicaciones(prev => prev.filter(p => p.id !== id))
  }

  async function toggleDestacado(id: string, destacado: boolean) {
    setProcesando(id)
    const res = await fetch('/api/admin/toggle-destacado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, destacado }),
    })
    const result = await res.json()
    setProcesando(null)
    if (!res.ok) {
      notify('❌ Error: ' + (result.error || 'desconocido'))
      return
    }
    const update = result.update || { destacado, destacado_hasta: destacado ? new Date(Date.now() + 48 * 3600000).toISOString() : null }
    setPublicaciones(prev => prev.map(p => p.id === id ? { ...p, ...update } : p))
    notify(destacado ? '⭐ Destacado 48h' : '☆ Destacado quitado')
  }

  async function boost(id: string) {
    setProcesando(id)
    const res = await fetch('/api/admin/boost-producto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id }),
    })
    const result = await res.json()
    setProcesando(null)
    if (!res.ok) {
      notify('❌ Error: ' + (result.error || 'desconocido'))
      return
    }
    setPublicaciones(prev => prev.map(p => p.id === id ? { ...p, boosteado_en: new Date().toISOString() } : p))
    notify('⚡ Publicación boosted!')
  }

  const filtros = [
    { id: 'todas' as const, label: `Todas (${publicaciones.length})` },
    { id: 'activas' as const, label: `Activas (${publicaciones.filter(p => p.activo && p.estado_moderacion === 'aprobado').length})` },
    { id: 'pausadas' as const, label: `Pausadas (${publicaciones.filter(p => !p.activo).length})` },
    { id: 'pendientes' as const, label: `Pendientes (${publicaciones.filter(p => p.estado_moderacion === 'pendiente').length})` },
  ]

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando...</div>

  return (
    <div className="space-y-4">
      {/* Buscador + filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por título, ciudad..."
            className="w-full border rounded-xl pl-10 pr-4 py-2.5 text-sm" />
        </div>
        <button onClick={async () => {
          setCargando(true)
          const { data } = await supabase.from('productos').select('id, titulo, precio_usd, estado, categoria_id, subcategoria, marca, ubicacion_ciudad, activo, visitas, creado_en, user_id, imagen_url, destacado, destacado_hasta, boosteado_en, estado_moderacion').order('creado_en', { ascending: false }).limit(500)
          if (data) setPublicaciones(data); setCargando(false)
        }} className="p-2.5 rounded-xl border hover:bg-gray-50">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {filtros.map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filtro === f.id ? 'bg-brand-primary text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort controls */}
      <div className="flex gap-1.5 flex-wrap">
        {(['creado_en', 'precio_usd', 'visitas', 'titulo'] as const).map(f => (
          <button key={f} onClick={() => {
            if (sortBy === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
            else { setSortBy(f); setSortDir('asc') }
          }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${sortBy === f ? 'bg-gray-800 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {f === 'creado_en' ? 'Fecha' : f === 'precio_usd' ? 'Precio' : f === 'visitas' ? 'Vistas' : 'Título'} {sortBy === f ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtradas.slice(0, 200).map(p => (
          <div key={p.id} className={`bg-white rounded-xl border p-4 transition ${!p.activo ? 'opacity-60' : ''}`}>
            <div className="flex gap-4">
              {/* Miniatura */}
              <LocalLink href={`/inmueble/${p.id}`} className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative block">
                {p.imagen_url ? (
                  <Image src={p.imagen_url} alt="" className="object-cover" fill sizes="80px" />
                ) : <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📦</div>}
              </LocalLink>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <LocalLink href={`/inmueble/${p.id}`} className="font-semibold text-gray-800 hover:text-brand-primary truncate max-w-[300px]">{p.titulo}</LocalLink>
                  {p.destacado && <span className="text-[10px] bg-brand-accent/20 text-brand-primary px-2 py-0.5 rounded-full">⭐</span>}
                  {p.boosteado_en && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">⚡</span>}
                  {!p.activo && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Pausado</span>}
                  {p.estado_moderacion === 'pendiente' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pendiente</span>}
                </div>
                <p className="text-sm text-brand-primary font-bold mt-0.5">${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd || 0))}</p>
                <p className="text-xs text-gray-400">👀 {p.visitas || 0} · 📍 {p.ubicacion_ciudad || 'VE'} · {new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(p.creado_en))}</p>
              </div>

              {/* Acciones */}
              <div className="flex gap-1 flex-shrink-0 flex-wrap items-start">
                <button onClick={() => toggleActivo(p.id, !p.activo)} disabled={procesando === p.id}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title={p.activo ? 'Pausar' : 'Activar'}>
                  {p.activo ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button onClick={() => toggleDestacado(p.id, !p.destacado)} disabled={procesando === p.id}
                  className={`p-2 rounded-lg transition ${p.destacado ? 'bg-brand-accent/20 text-brand-accent' : 'hover:bg-gray-100 text-yellow-500'}`}
                  title={p.destacado ? 'Quitar destacado' : 'Destacar 48h'}>
                  <Star size={14} />
                </button>
                <button onClick={() => boost(p.id)} disabled={procesando === p.id}
                  className="p-2 rounded-lg hover:bg-green-50 text-green-600" title="Boostear">
                  <Zap size={14} />
                </button>
                <button onClick={() => window.open(`/inmueble/${p.id}`, '_blank')}
                  className="p-2 rounded-lg hover:bg-blue-50 text-blue-600" title="Ver">
                  <Eye size={14} />
                </button>
                <button onClick={() => eliminar(p.id)} disabled={procesando === p.id}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtradas.length === 0 && <div className="text-center py-12 text-gray-400">No hay publicaciones</div>}
      </div>
    </div>
  )
}

// ============================ ADMIN PAGE ============================
function TabTransacciones({ perfiles, notify }: { perfiles: Record<string, any>; notify: (m: string) => void }) {
  const [pendientes, setPendientes] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [procesando, setProcesando] = useState<string | null>(null)

  async function cargar() {
    const { data: trans }: any = await supabase
      .from('transacciones_creditos')
      .select('*')
      .eq('tipo', 'compra')
      .order('creado_en', { ascending: false })
      .limit(50)

    if (!trans) return
    setPendientes(trans.filter((t: any) => t.estado === 'pendiente'))
    setHistorial(trans.filter((t: any) => t.estado !== 'pendiente'))
  }

  useEffect(() => { cargar() }, [])

  async function aprobar(id: string, monto: number, usuarioNombre: string, userId?: string) {
    setProcesando(id)
    const { error } = await supabase.rpc('aprobar_transaccion', { p_transaccion_id: id, p_admin_id: (await supabase.auth.getUser()).data.user?.id })
    setProcesando(null)
    if (error) {
      notify(`Error: ${error.message}`)
    } else {
      notify(`✅ +${monto} créditos aprobados!`)
      // Notificar admin por Telegram
      const mensaje = `✅ VendeT-Venezuela

Se aprobaron ${monto} créditos para ${usuarioNombre}.
Transacción procesada correctamente.`
      try { await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensaje }) }) } catch {}
      // EMAIL: Notificar al usuario que se le agregaron créditos
      if (userId) {
        try {
          fetch('/api/email-creditos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, cantidad: monto }),
          }).catch(() => {})
        } catch {}
        // PUSH: Notificar al usuario
        try {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetUserId: userId,
              titulo: '💰 Créditos recibidos',
              cuerpo: `Se aprobaron ${monto} créditos en tu cuenta VendeT.`,
              click_url: '/creditos',
            }),
          }).catch(() => {})
        } catch {}
      }
      await cargar()
    }
  }

  async function rechazar(id: string) {
    setProcesando(id)
    await supabase.from('transacciones_creditos').update({ estado: 'rechazado' }).eq('id', id)
    setProcesando(null)
    notify('Transacción rechazada')
    await cargar()
  }

  return (
    <div className="space-y-6">
      {/* Pendientes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🔴 Pendientes
            <span className="bg-red-100 text-red-700 text-sm px-2 py-0.5 rounded-full">{pendientes.length}</span>
          </h2>
          <button onClick={cargar} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Refrescar"><RefreshCw size={16} /></button>
        </div>

        {pendientes.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
            <p className="text-gray-500">No hay transacciones pendientes 🎉</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendientes.map((t) => {
              const perfil = perfiles[t.user_id] || {}
              return (
                <div key={t.id} className="bg-white rounded-xl border-2 border-yellow-200 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-brand-primary">+{t.monto} créditos</span>
                        <span className="text-[10px] font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">PENDIENTE</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>👤 <strong>{perfil.nombre || 'Sin nombre'}</strong></p>
                        {perfil.telefono && <p>📱 {perfil.telefono}</p>}
                        <p>💳 Método: <strong>{t.metodo_pago}</strong></p>
                        <p>📅 {new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t.creado_en))}</p>
                      </div>
                      {t.comprobante_url && (
                        <a href={t.comprobante_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline">
                          <Eye size={14} /> Ver comprobante <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => aprobar(t.id, t.monto, perfil.nombre || 'Usuario', t.user_id)} disabled={procesando === t.id} className="flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-green-600 transition disabled:opacity-50">
                        {procesando === t.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Aprobar
                      </button>
                      <button onClick={() => rechazar(t.id)} disabled={procesando === t.id} className="flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-red-600 transition disabled:opacity-50">
                        <X size={16} /> Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Historial */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">📋 Historial</h2>
        {historial.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
            <p className="text-gray-500">Sin transacciones aún</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-bold">Usuario</th>
                  <th className="text-left py-3 px-4 font-bold">Método</th>
                  <th className="text-center py-3 px-4 font-bold">Créditos</th>
                  <th className="text-center py-3 px-4 font-bold">Estado</th>
                  <th className="text-center py-3 px-4 font-bold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((t) => {
                  const perfil = perfiles[t.user_id] || {}
                  return (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">{perfil.nombre || '...'}</td>
                      <td className="py-3 px-4">{t.metodo_pago || '—'}</td>
                      <td className="py-3 px-4 text-center font-bold text-brand-primary">+{t.monto}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.estado === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-500">{new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t.creado_en))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// TAB: MODERACIÓN DE PUBLICACIONES
// ============================================================
function TabAnuncios({ notify }: { notify: (m: string) => void }) {
  const [anuncio, setAnuncio] = useState('')

  const anunciosGuardados = [
    { texto: '🎉 ¡Nuevo! Ahora puedes destacar tus publicaciones con créditos', fecha: new Date().toLocaleDateString('es-VE') },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Megaphone size={20} /> Publicar anuncio global
        </h3>
        <p className="text-sm text-gray-500 mb-4">Añade un mensaje que aparecerá en la página principal (banner informativo).</p>
        <textarea
          value={anuncio}
          onChange={e => setAnuncio(e.target.value)}
          placeholder="Escribe tu anuncio..."
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm min-h-[100px] resize-y bg-white"
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { if (anuncio.trim()) { notify('✅ Anuncio publicado! (falta conectar con la web)'); setAnuncio('') } }}
            className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition"
          >
            Publicar anuncio
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="font-bold text-lg mb-4">📢 Anuncios anteriores</h3>
        {anunciosGuardados.map((a, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4 mb-3">
            <p className="text-sm text-gray-800">{a.texto}</p>
            <p className="text-xs text-gray-400 mt-1">{a.fecha}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// TAB: CATEGORÍAS
// ============================================================
function TabCategorias({ notify }: { notify: (m: string) => void }) {
  const [categorias, setCategorias] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevaCat, setNuevaCat] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('categorias').select('id, nombre, descripcion, icono, color, orden').order('id')
      if (data) setCategorias(data)
      setCargando(false)
    }
    load()
  }, [])

  async function agregarCategoria() {
    if (!nuevaCat.trim()) return
    await supabase.from('categorias').insert([{ nombre: nuevaCat.trim().toLowerCase() }])
    notify('✅ Categoría añadida')
    setNuevaCat('')
    const { data } = await supabase.from('categorias').select('id, nombre, descripcion, icono, color, orden').order('id')
    if (data) setCategorias(data)
  }

  if (cargando) return <div className="text-center py-12 text-gray-400">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="font-bold text-lg mb-4"><Tag size={20} className="inline mr-2" />Categorías actuales ({categorias.length})</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
          {categorias.map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="font-bold text-gray-800 capitalize">{c.nombre}</p>
              <p className="text-xs text-gray-400">ID: {c.id}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={nuevaCat}
            onChange={e => setNuevaCat(e.target.value)}
            placeholder="Nombre de nueva categoría"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white"
            onKeyDown={e => e.key === 'Enter' && agregarCategoria()}
          />
          <button onClick={agregarCategoria} className="bg-brand-primary text-white px-5 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition">
            Añadir
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// TAB: EXPORTAR
function TabExportar() {
  const [exportando, setExportando] = useState(false)

  async function exportarProductos() {
    setExportando(true)
    const { data } = await supabase.from('productos').select('id, titulo, precio_usd, estado, categoria_id, subcategoria, marca, ubicacion_ciudad, activo, visitas, creado_en, user_id, imagen_url, destacado, destacado_hasta, boosteado_en, estado_moderacion')
    if (!data) { setExportando(false); return }

    const headers = ['id', 'titulo', 'precio_usd', 'estado', 'categoria_id', 'subcategoria', 'marca', 'ubicacion_ciudad', 'activo', 'visitas', 'creado_en']
    const csv = [headers.join(','), ...data.map((p: any) => headers.map(h => `"${(p as any)[h] || ''}"`).join(','))].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `productos_vendet_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  async function exportarUsuarios() {
    setExportando(true)
    const { data } = await supabase.from('perfiles').select('id, nombre, telefono, estado, ciudad, credito_balance, verificado, nivel_confianza, creado_en')
    if (!data) { setExportando(false); return }

    const headers = ['id', 'nombre', 'telefono', 'estado', 'ciudad', 'credito_balance', 'creado_en']
    const csv = [headers.join(','), ...data.map((u: any) => headers.map(h => `"${u[h] || ''}"`).join(','))].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `usuarios_vendet_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  async function exportarTransacciones() {
    setExportando(true)
    const { data } = await supabase.from('transacciones_creditos').select('id, user_id, tipo, monto, metodo_pago, estado, creado_en, precio_usd, comprobante_url')
    if (!data) { setExportando(false); return }

    const headers = ['id', 'user_id', 'tipo', 'monto', 'metodo_pago', 'estado', 'creado_en']
    const csv = [headers.join(','), ...data.map((t: any) => headers.map(h => `"${(t as any)[h] || ''}"`).join(','))].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `transacciones_vendet_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Download size={20} /> Exportar datos a CSV
        </h3>
        <p className="text-sm text-gray-500 mb-6">Descarga toda la información de tu plataforma en formato CSV, compatible con Excel y Google Sheets.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={exportarProductos} disabled={exportando} className="bg-white border-2 border-gray-200 rounded-xl p-5 text-center hover:border-brand-primary transition disabled:opacity-50">
            <Package size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="font-bold text-gray-800">Productos</p>
            <p className="text-xs text-gray-400">Todas las publicaciones</p>
          </button>
          <button onClick={exportarUsuarios} disabled={exportando} className="bg-white border-2 border-gray-200 rounded-xl p-5 text-center hover:border-brand-primary transition disabled:opacity-50">
            <Users size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="font-bold text-gray-800">Usuarios</p>
            <p className="text-xs text-gray-400">Perfiles registrados</p>
          </button>
          <button onClick={exportarTransacciones} disabled={exportando} className="bg-white border-2 border-gray-200 rounded-xl p-5 text-center hover:border-brand-primary transition disabled:opacity-50">
            <CreditCard size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="font-bold text-gray-800">Transacciones</p>
            <p className="text-xs text-gray-400">Pagos y créditos</p>
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// TAB: CREDITOS (añadir manualmente)

function ModeracionTab({ notify, adminEmail }: { notify: (msg: string) => void; adminEmail: string }) {
  const [denuncias, setDenuncias] = useState<any[]>([])
  const [productosPendientes, setProductosPendientes] = useState<any[]>([])
  const [tabM, setTabM] = useState<'denuncias' | 'pendientes'>('denuncias')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const [{ data: denies }, { data: pends }] = await Promise.all([
      supabase
        .from('denuncias')
        .select(`id, producto_id, reportante_id, motivo, estado, creada_en, producto:productos(titulo, user_id, precio_usd, imagen_url), reportante:perfiles(nombre)`)
        .eq('estado', 'activa')
        .order('creada_en', { ascending: false }),
      supabase
        .from('productos')
        .select('id, titulo, precio_usd, imagen_url, estado, categoria_id, subcategoria, marca, ubicacion_ciudad, activo, visitas, creado_en, user_id, estado_moderacion')
        .eq('estado_moderacion', 'pendiente')
        .order('creado_en', { ascending: false }),
    ])
    setDenuncias(denies || [])
    setProductosPendientes(pends || [])
    setCargando(false)
  }

  async function invalidarDenuncia(id: string) {
    const { error } = await supabase.from('denuncias').update({ estado: 'invalidada' }).eq('id', id)
    if (error) notify('Error: ' + error.message)
    else { notify('Denuncia invalidada'); cargar() }
  }

  async function aprobarDenuncia(id: string, productoId: string) {
    await supabase.from('denuncias').update({ estado: 'resuelta' }).eq('id', id)
    const res = await fetch('/api/admin/moderar-producto', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productoId, action: 'rechazar', adminEmail }),
    })
    const json = await res.json()
    if (!res.ok) notify('Error: ' + (json.error || 'desconocido'))
    else { notify('Producto bloqueado'); cargar() }
  }

  async function aprobarProducto(id: string) {
    const res = await fetch('/api/admin/moderar-producto', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, action: 'aprobar', adminEmail }),
    })
    const json = await res.json()
    if (!res.ok) notify('Error: ' + (json.error || 'desconocido'))
    else { notify('Producto aprobado'); cargar() }
  }

  async function rechazarProducto(id: string) {
    const res = await fetch('/api/admin/moderar-producto', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, action: 'rechazar', adminEmail }),
    })
    const json = await res.json()
    if (!res.ok) notify('Error: ' + (json.error || 'desconocido'))
    else { notify('Producto rechazado'); cargar() }
  }

  if (cargando) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-primary" /></div>

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button onClick={() => setTabM('denuncias')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tabM === 'denuncias' ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          🚨 Denuncias ({denuncias.length})
        </button>
        <button onClick={() => setTabM('pendientes')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tabM === 'pendientes' ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          ⏳ Pendientes ({productosPendientes.length})
        </button>
      </div>

      {tabM === 'denuncias' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {denuncias.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">✅</p>
              <p className="font-medium">Sin denuncias activas</p>
            </div>
          ) : (
            <div className="divide-y">
              {denuncias.map(d => (
                <div key={d.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{d.producto?.titulo || 'N/A'}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{d.motivo}</span>
                        <span className="text-xs text-gray-400">{new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d.creada_en))} — {d.reportante?.nombre || 'Desconocido'}</span>
                      </div>
                      {d.descripcion && <p className="text-xs text-gray-500 mt-1">{d.descripcion}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { window.open(`/inmueble/${d.producto_id}`, '_blank') }} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">Ver</button>
                      <button onClick={() => invalidarDenuncia(d.id)} className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">Ignorar</button>
                      <button onClick={() => aprobarDenuncia(d.id, d.producto_id)} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Bloquear</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tabM === 'pendientes' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {productosPendientes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">✅</p>
              <p className="font-medium">Sin productos pendientes</p>
            </div>
          ) : (
            <div className="divide-y">
              {productosPendientes.map(p => (
                <div key={p.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      {p.imagen_url ? <Image src={p.imagen_url} alt="" className="w-16 h-16 rounded-lg object-cover" width={64} height={64} /> : null}
                      <div>
                        <p className="font-semibold">{p.titulo}</p>
                        {p.precio_usd && <p className="text-brand-primary font-bold">${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd))}</p>}
                        {p.motivo_moderacion && <p className="text-xs text-orange-600 mt-1">⚠️ {p.motivo_moderacion}</p>}
                        <span className="text-xs text-gray-400">{new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(p.creado_en))}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { window.open(`/inmueble/${p.id}`, '_blank') }} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">Ver</button>
                      <button onClick={() => aprobarProducto(p.id)} className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600">Aprobar</button>
                      <button onClick={() => rechazarProducto(p.id)} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">Rechazar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { user, session } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<string>('dashboard')
  const [toast, setToast] = useState<string | null>(null)
  const [perfiles, setPerfiles] = useState<Record<string, any>>({})

  const isAdmin = ADMIN_EMAILS.includes(user?.email || '')

  useEffect(() => {
    if (!session || !user) return
    if (!isAdmin) {
      setToast('No tienes permisos de admin')
      setTimeout(() => router.push('/'), 2000)
      return
    }
    cargarPerfiles()
    // Read tab from URL
    const urlTab = searchParams?.get('tab')
    if (urlTab && TABS.some(t => t.id === urlTab)) {
      setTab(urlTab)
    }
  }, [user, session, isAdmin, searchParams, router])

  async function cargarPerfiles() {
    const { data } = await supabase.from('perfiles').select('id, nombre, telefono')
    if (data) {
      const m: Record<string, any> = {}
      data.forEach((p: any) => { m[p.id] = p })
      setPerfiles(m)
    }
  }

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  if (!session) return null
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🔒 Acceso denegado</h2>
          <p className="text-gray-500">No tienes permisos para esta página.</p>
          <button onClick={() => router.push('/')} className="mt-4 text-brand-primary hover:underline">Volver al inicio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-brand-accent p-3 rounded-xl"><Shield size={24} className="text-brand-primary" /></div>
          <div>
            <h1 className="text-3xl font-black text-gray-800">Admin Panel</h1>
            <p className="text-gray-500">Control total de VendeT-Venezuela</p>
          </div>
        </div>
        <LocalLink href="/" className="text-sm text-brand-primary hover:underline">← Volver al sitio</LocalLink>
      </div>

      {/* Tabs principales */}
      <nav className="flex gap-1 overflow-x-auto pb-2 mb-4 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); router.replace(`/admin?tab=${t.id}`) }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === t.id ? 'bg-brand-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <t.icon size={16} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Quick links — botones que cambian tab directamente */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {QUICK_LINKS.map(q => (
          <button key={q.label} onClick={() => setTab(q.target)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border hover:bg-gray-50 text-gray-600 transition">
            <q.icon size={12} /> {q.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'dashboard' && <MetricasTab />}
      {tab === 'usuarios' && <UsuariosTab notify={notify} />}
      {tab === 'publicaciones' && <PublicacionesTab notify={notify} />}
      {tab === 'verificacion' && <VerificacionTab notify={notify} />}
      {tab === 'moderacion' && <ModeracionTab notify={notify} adminEmail={user?.email || ''} />}
      {tab === 'transacciones' && <TabTransacciones perfiles={perfiles} notify={notify} />}
      {tab === 'anuncios' && <TabAnuncios notify={notify} />}
      {tab === 'categorias' && <TabCategorias notify={notify} />}
      {tab === 'exportar' && <TabExportar />}
    </div>
  )
}
