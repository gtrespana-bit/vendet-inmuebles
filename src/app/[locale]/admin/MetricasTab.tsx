'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Users, ShoppingBag, Eye, TrendingUp, DollarSign, Star, Clock, ShieldCheck,
} from 'lucide-react'

// Dashboard de métricas.
// Los KPIs y el ranking de vendedores se calculan en BD mediante RPCs
// SECURITY DEFINER (admin_metricas / admin_top_vendedores): una sola llamada
// cada uno, sin descargar tablas completas al cliente.
export default function MetricasTab() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [topSellers, setTopSellers] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadMetrics() {
      setLoading(true)
      const [metricsRes, sellersRes, recentRes] = await Promise.all([
        supabase.rpc('admin_metricas'),
        supabase.rpc('admin_top_vendedores', { p_limite: 10 }),
        supabase
          .from('vw_propiedades_publicas')
          .select('id, titulo, precio_usd, seller_nombre, creado_en, visitas')
          .order('creado_en', { ascending: false })
          .limit(10),
      ])

      if (cancelled) return

      if (metricsRes.error) {
        console.error('Error loading metrics:', metricsRes.error)
      }
      setStats(metricsRes.data || null)
      setTopSellers((sellersRes.data as any[]) || [])
      setRecentActivity((recentRes.data as any[]) || [])
      setLoading(false)
    }

    loadMetrics()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-400">
        No se pudieron cargar las métricas. Inténtalo de nuevo.
      </div>
    )
  }

  const cards = [
    { label: 'Usuarios registrados', value: stats.total_usuarios, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Nuevos hoy', value: stats.usuarios_nuevos_hoy, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Publicaciones totales', value: stats.total_propiedades, icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Publicaciones activas', value: stats.propiedades_activas, icon: ShoppingBag, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pendientes de moderación', value: stats.propiedades_pendientes, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Visitas totales', value: Number(stats.visitas_totales || 0).toLocaleString('en-US'), icon: Eye, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Vendedores verificados', value: stats.vendedores_verificados, icon: TrendingUp, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Pagos pendientes', value: stats.pagos_pendientes, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  const ingresos = Number(stats.ingresos_usd || 0)
  const creditos = Number(stats.creditos_vendidos || 0)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon size={20} className={card.color} />
            </div>
            <p className="text-2xl font-black text-gray-900">{card.value ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Ingresos reales */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <DollarSign size={24} className="text-green-600" />
          <h3 className="font-bold text-gray-900 text-lg">Ingresos (ventas aprobadas)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <div>
            <p className="text-sm text-gray-500">Ingresos USD</p>
            <p className="text-2xl font-black text-green-600">
              ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(ingresos)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Créditos vendidos</p>
            <p className="text-2xl font-black text-green-700">
              {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(creditos)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Compras aprobadas hoy</p>
            <p className="text-2xl font-black text-green-700">{stats.compras_hoy ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publicaciones recientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Clock size={18} className="text-blue-600" />
            <h3 className="font-bold text-gray-900">Publicaciones recientes</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((p: any) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.titulo}</p>
                  <p className="text-xs text-gray-400">
                    ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(p.precio_usd || 0))} · {p.seller_nombre || '—'}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs text-gray-500">
                    {new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(p.creado_en))}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                    <Eye size={10} /> {p.visitas || 0}
                  </p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No hay publicaciones aún</p>
            )}
          </div>
        </div>

        {/* Top vendedores por visitas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Star size={18} className="text-orange-600" />
            <h3 className="font-bold text-gray-900">Top vendedores por visitas</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {topSellers.map((s: any, i: number) => (
              <div key={s.user_id || i} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${i === 0 ? 'bg-yellow-100 text-yellow-800' : i === 1 ? 'bg-gray-100 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-800' : 'bg-gray-50 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.nombre}</p>
                    <p className="text-xs text-gray-400">{s.propiedades_activas} activos de {s.total_propiedades}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-brand-primary">
                  <Eye size={14} />
                  {new Intl.NumberFormat('en-US').format(Number(s.visitas_totales || 0))}
                </div>
              </div>
            ))}
            {topSellers.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No hay datos aún</p>
            )}
          </div>
        </div>
      </div>

      {/* Acceso directo a verificación pendiente */}
      {stats.propiedades_pendientes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center gap-3">
          <ShieldCheck size={20} className="text-amber-600" />
          <p className="text-sm text-amber-800 font-medium">
            Hay {stats.propiedades_pendientes} publicación(es) esperando moderación en la pestaña «Verificación» / «Moderación».
          </p>
        </div>
      )}
    </div>
  )
}
