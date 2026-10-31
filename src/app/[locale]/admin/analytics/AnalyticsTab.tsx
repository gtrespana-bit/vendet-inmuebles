'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, BarChart3, Globe, Users, Package, Activity } from 'lucide-react'
import { analyticsApi } from './api'
import { ResumenSection, TraficoSection, UsuariosSection, ContenidoSection, ActividadSection } from './sections'
import { timeAgo } from './charts'

const PERIODOS = [
  { dias: 1, label: 'Hoy' },
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
]

const SUBTABS = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'trafico', label: 'Tráfico', icon: Globe },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'contenido', label: 'Contenido', icon: Package },
  { id: 'actividad', label: 'Actividad', icon: Activity },
]

/**
 * Panel de analítica interna del sitio (dashboard profesional del admin).
 * Todos los datos vienen agregados de la BD vía /api/admin/analytics/* (requireAdmin).
 */
export default function AnalyticsTab() {
  const [dias, setDias] = useState(30)
  const [subtab, setSubtab] = useState('resumen')
  const [data, setData] = useState<{
    resumen: any; trafico: any; usuarios: any; contenido: any; actividad: any
  }>({ resumen: null, trafico: null, usuarios: null, contenido: null, actividad: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [tick, setTick] = useState(0) // fuerza re-render del "hace Xs"
  const mounted = useRef(true)

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const [resumen, trafico, usuarios, contenido, actividad] = await Promise.all([
        analyticsApi.resumen(dias),
        analyticsApi.trafico(dias),
        analyticsApi.usuarios(dias),
        analyticsApi.contenido(dias),
        analyticsApi.actividad(),
      ])
      if (!mounted.current) return
      setData({ resumen, trafico, usuarios, contenido, actividad })
      setUpdatedAt(new Date())
    } catch (e: any) {
      if (!mounted.current) return
      setError(e?.message || 'Error cargando analítica')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [dias])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  // Auto-refresh cada 60s + reloj de "actualizado hace…" cada 10s
  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(() => load(false), 60_000)
    return () => clearInterval(iv)
  }, [autoRefresh, load])

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="space-y-5">
      {/* Barra de control */}
      <div className="flex flex-wrap items-center gap-3 justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        <div className="flex items-center gap-1 flex-wrap">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                dias === p.dias ? 'bg-brand-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-xs text-gray-400" key={tick}>
              Actualizado {timeAgo(updatedAt)}
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-brand-primary"
            />
            Auto-refresh 60s
          </label>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition"
            title="Actualizar ahora"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error} — verifica que la migración 007_analytics_eventos.sql esté aplicada en Supabase.
        </div>
      )}

      {/* Sub-pestañas */}
      <nav className="flex gap-1 overflow-x-auto pb-1">
        {SUBTABS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubtab(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              subtab === s.id ? 'bg-white text-brand-primary shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
            }`}
          >
            <s.icon size={15} />
            {s.label}
          </button>
        ))}
      </nav>

      {subtab === 'resumen' && <ResumenSection data={data.resumen} loading={loading} />}
      {subtab === 'trafico' && <TraficoSection data={data.trafico} loading={loading} />}
      {subtab === 'usuarios' && <UsuariosSection data={data.usuarios} loading={loading} />}
      {subtab === 'contenido' && <ContenidoSection data={data.contenido} loading={loading} />}
      {subtab === 'actividad' && <ActividadSection data={data.actividad} loading={loading} />}
    </div>
  )
}
