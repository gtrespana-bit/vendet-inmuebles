'use client'

import React from 'react'
import {
  Eye, Users, UserPlus, MousePointerClick, Home, MessageSquare, Heart, Search,
  Mail, ShoppingCart, DollarSign, Clock, ShieldCheck, TrendingUp, Globe,
  Smartphone, BarChart3, Activity, Package, Star, Inbox, Gauge, MapPin, Layers,
} from 'lucide-react'
import { AreaChart, BarList, Donut, HourChart, fmtNum, fmtMoney, fmtDate, timeAgo } from './charts'
import { Card, KpiCard, Loading, Empty, Legend } from './ui'

const C = {
  navy: '#16294B', gold: '#B08542', teal: '#2E7D6B', red: '#C0564F', blue: '#5B7DB1', green: '#3E7C4F',
}

// ---------------------------------------------------------------------------
// RESUMEN
// ---------------------------------------------------------------------------
export function ResumenSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Loading label="Cargando resumen…" />
  if (!data) return <Empty msg="No se pudo cargar el resumen" />
  const k = data.kpis || {}
  const p = data.prev || {}
  const serie = data.serie || []
  const funnel = data.funnel || {}

  const kpis = [
    { label: 'Pageviews', value: k.pageviews, prev: p.pageviews, icon: Eye, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Sesiones únicas', value: k.sesiones, prev: p.sesiones, icon: MousePointerClick, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'Usuarios únicos', value: k.usuarios_unicos, icon: Users, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
    { label: 'Registros nuevos', value: k.registros, prev: p.registros, icon: UserPlus, color: 'text-teal-700', bg: 'bg-teal-50' },
    { label: 'Publicaciones nuevas', value: k.publicaciones, prev: p.publicaciones, icon: Home, color: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'Mensajes enviados', value: k.mensajes, prev: p.mensajes, icon: MessageSquare, color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'Vistas de inmuebles', value: k.vistas_inmuebles, icon: Eye, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Favoritos', value: k.favoritos, icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Búsquedas', value: k.busquedas, icon: Search, color: 'text-cyan-700', bg: 'bg-cyan-50' },
    { label: 'Contactos', value: k.contactos, icon: Mail, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Compras aprobadas', value: k.compras, prev: p.compras, icon: ShoppingCart, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Ingresos', value: k.ingresos_usd, prev: p.ingresos_usd, icon: DollarSign, color: 'text-green-800', bg: 'bg-green-100', format: fmtMoney },
  ]

  const series = [
    { key: 'pageviews', label: 'Pageviews', color: C.navy },
    { key: 'sesiones', label: 'Sesiones', color: C.blue },
    { key: 'registros', label: 'Registros', color: C.teal },
    { key: 'publicaciones', label: 'Publicaciones', color: C.gold },
    { key: 'mensajes', label: 'Mensajes', color: C.green },
    { key: 'compras', label: 'Compras', color: C.red },
  ]

  const funnelSteps = [
    { label: 'Pageview → Registro', value: funnel.pageview_a_registro, icon: UserPlus },
    { label: 'Registro → Publicación', value: funnel.registro_a_publicacion, icon: Home },
    { label: 'Contacto → Compra', value: funnel.contacto_a_compra, icon: ShoppingCart },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} format={kpi.format || fmtNum} />
        ))}
      </div>

      <Card
        title={`Evolución diaria — últimos ${data.dias} día(s)`}
        icon={TrendingUp}
        right={<Legend series={series} />}
      >
        {serie.length > 0 ? <AreaChart data={serie} series={series} /> : <Empty />}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Embudo de conversión (%)" icon={Gauge}>
          <div className="space-y-4">
            {funnelSteps.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-600 flex items-center gap-1.5"><f.icon size={14} className="text-brand-primary" />{f.label}</span>
                  <span className="font-bold text-gray-900">{Number(f.value || 0).toFixed(2)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent" style={{ width: `${Math.min(100, Number(f.value || 0))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Actividad por tipo (barras)" icon={BarChart3}>
          <div className="space-y-3">
            {[
              ['Pageviews', k.pageviews, C.navy],
              ['Registros', k.registros, C.teal],
              ['Publicaciones', k.publicaciones, C.gold],
              ['Mensajes', k.mensajes, C.green],
              ['Favoritos', k.favoritos, C.red],
              ['Búsquedas', k.busquedas, C.blue],
              ['Contactos', k.contactos, '#B08542'],
              ['Compras', k.compras, '#3E7C4F'],
            ].map(([label, v, color]) => (
              <div key={label as string} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-gray-500 text-xs truncate">{label as string}</span>
                <div className="flex-1 h-2 rounded bg-gray-100 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(Number(v) / Math.max(1, Number(k.pageviews))) * 100}%`, backgroundColor: color as string }} />
                </div>
                <span className="w-12 text-right font-semibold text-xs tabular-nums">{fmtNum(Number(v))}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Créditos vendidos" icon={Star}>
          <p className="text-3xl font-black text-gray-900">{fmtNum(k.creditos_vendidos)}</p>
          <p className="text-xs text-gray-500 mt-1">créditos aprobados en el periodo</p>
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Conversaciones iniciadas</p>
              <p className="font-bold text-gray-900">{fmtNum(k.conversaciones)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Ingresos</p>
              <p className="font-bold text-green-700">{fmtMoney(k.ingresos_usd)}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TRÁFICO
// ---------------------------------------------------------------------------
export function TraficoSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Loading label="Cargando tráfico…" />
  if (!data) return <Empty msg="No se pudo cargar el tráfico" />

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Páginas más vistas" icon={Eye} right={<span className="text-xs text-gray-400">pageviews / sesiones</span>}>
          <BarList rows={data.top_rutas} labelKey="ruta" valueKey="views" secondaryKey="sesiones" color={C.navy} />
        </Card>
        <Card title="Fuentes de tráfico (referrers)" icon={Globe}>
          <BarList rows={data.top_referrers} labelKey="fuente" valueKey="views" color={C.blue} />
        </Card>
        <Card title="Campañas UTM" icon={TrendingUp}>
          <BarList
            rows={(data.top_utm_sources || []).map((r: any) => ({
              ...r,
              fuente: [r.source, r.medium, r.campaign].filter(Boolean).join(' / ') || '—',
            }))}
            labelKey="fuente" valueKey="views" color={C.gold}
          />
        </Card>
        <Card title="Búsquedas internas más frecuentes" icon={Search}>
          <BarList rows={data.top_busquedas} labelKey="q" valueKey="count" color={C.teal} />
        </Card>
        <Card title="Dispositivos" icon={Smartphone}>
          <Donut rows={data.dispositivos} labelKey="dispositivo" valueKey="views" />
        </Card>
        <Card title="Navegadores" icon={Globe}>
          <Donut rows={data.navegadores} labelKey="navegador" valueKey="views" />
        </Card>
        <Card title="Países (por IP)" icon={MapPin}>
          <BarList rows={data.paises} labelKey="pais" valueKey="views" color={C.red} />
        </Card>
        <Card title="Horas pico (hora de Venezuela)" icon={Clock}>
          <HourChart rows={data.horas_pico || []} />
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// USUARIOS
// ---------------------------------------------------------------------------
export function UsuariosSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Loading label="Cargando usuarios…" />
  if (!data) return <Empty msg="No se pudo cargar usuarios" />

  const serie = data.serie || []
  const series = [
    { key: 'registros', label: 'Registros', color: C.teal },
    { key: 'logins', label: 'Logins', color: C.blue },
    { key: 'activos', label: 'Activos', color: C.gold },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Usuarios totales" value={data.total_usuarios} icon={Users} color="text-brand-primary" bg="bg-brand-primary/10" />
        <KpiCard label="Nuevos en el periodo" value={data.nuevos_periodo} icon={UserPlus} color="text-teal-700" bg="bg-teal-50" />
        <KpiCard label="Activos en el periodo" value={data.activos_periodo} icon={Activity} color="text-blue-700" bg="bg-blue-50" />
        <KpiCard label="Verificados" value={data.verificados} icon={ShieldCheck} color="text-green-700" bg="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Registros / logins / activos por día" icon={TrendingUp} right={<Legend series={series} />}>
          {serie.length > 0 ? <AreaChart data={serie} series={series} height={220} /> : <Empty />}
        </Card>
        <Card title="Distribución por tipo de cuenta" icon={Layers}>
          <BarList rows={data.por_tipo_cuenta} labelKey="tipo" valueKey="n" color={C.navy} />
        </Card>
        <Card title="Planes activos" icon={Star}>
          <BarList rows={data.planes_activos} labelKey="plan" valueKey="n" color={C.gold} />
        </Card>
        <Card title="Saldo de créditos en circulación" icon={DollarSign}>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-black text-gray-900">{fmtNum(data.saldo_creditos?.total)}</p>
              <p className="text-xs text-gray-500">créditos totales</p>
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{fmtNum(data.saldo_creditos?.promedio)}</p>
              <p className="text-xs text-gray-500">promedio por usuario</p>
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{fmtNum(data.saldo_creditos?.usuarios_con_creditos)}</p>
              <p className="text-xs text-gray-500">usuarios con saldo</p>
            </div>
          </div>
        </Card>
        <Card title="Top estados de usuarios" icon={MapPin}>
          <BarList rows={data.top_estados} labelKey="estado" valueKey="n" color={C.blue} />
        </Card>
        <Card title="Top ciudades de usuarios" icon={MapPin}>
          <BarList rows={data.top_ciudades} labelKey="ciudad" valueKey="n" color={C.red} />
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CONTENIDO Y MODERACIÓN
// ---------------------------------------------------------------------------
export function ContenidoSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Loading label="Cargando contenido…" />
  if (!data) return <Empty msg="No se pudo cargar el contenido" />

  const serie = data.serie_publicaciones || []
  const series = [
    { key: 'creadas', label: 'Creadas', color: C.navy },
    { key: 'aprobadas', label: 'Aprobadas', color: C.green },
    { key: 'rechazadas', label: 'Rechazadas', color: C.red },
    { key: 'mensajes', label: 'Mensajes', color: C.blue },
    { key: 'favoritos', label: 'Favoritos', color: C.gold },
  ]
  const m = data.moderacion || {}
  const chat = data.chat || {}

  return (
    <div className="space-y-5">
      {/* Alerta de moderación pendiente */}
      {Number(m.pendientes) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck size={20} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            Hay <strong>{fmtNum(m.pendientes)}</strong> publicación(es) pendientes de moderar.
            Tiempo medio de moderación en el periodo: <strong>{m.tiempo_medio_moderacion_min} min</strong>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pendientes de moderar" value={m.pendientes} icon={Clock} color="text-amber-700" bg="bg-amber-50" />
        <KpiCard label="Aprobadas (periodo)" value={m.aprobadas_periodo} icon={ShieldCheck} color="text-green-700" bg="bg-green-50" />
        <KpiCard label="Rechazadas (periodo)" value={m.rechazadas_periodo} icon={Inbox} color="text-red-600" bg="bg-red-50" />
        <KpiCard label="Tiempo medio de moderación" value={Number(m.tiempo_medio_moderacion_min)} icon={Gauge} color="text-blue-700" bg="bg-blue-50" format={(v) => `${v} min`} />
      </div>

      <Card title="Publicaciones, moderación y engagement por día" icon={TrendingUp} right={<Legend series={series} />}>
        {serie.length > 0 ? <AreaChart data={serie} series={series} height={230} /> : <Empty />}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Inmuebles más vistos" icon={Eye}>
          <BarList rows={data.top_inmuebles_vistos} labelKey="titulo" valueKey="views" color={C.navy} />
        </Card>
        <Card title="Vendedores con más mensajes recibidos" icon={MessageSquare}>
          <BarList rows={data.top_vendedores_mensajes} labelKey="nombre" valueKey="mensajes_recibidos" secondaryKey="propiedades" color={C.teal} />
        </Card>
        <Card title="Publicaciones por estado" icon={MapPin}>
          <BarList rows={data.por_estado} labelKey="estado" valueKey="total" secondaryKey="activas" color={C.blue} />
        </Card>
        <Card title="Publicaciones por ciudad" icon={MapPin}>
          <BarList rows={data.por_ciudad} labelKey="ciudad" valueKey="total" secondaryKey="activas" color={C.gold} />
        </Card>
        <Card title="Por tipo de inmueble" icon={Home}>
          <BarList rows={data.por_tipo} labelKey="tipo" valueKey="n" color={C.navy} />
        </Card>
        <Card title="Por operación" icon={Package}>
          <BarList rows={data.por_operacion} labelKey="operacion" valueKey="n" color={C.red} />
        </Card>
      </div>

      <Card title="Chat y contacto" icon={MessageSquare}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-black text-gray-900">{fmtNum(chat.conversaciones_periodo)}</p>
            <p className="text-xs text-gray-500">conversaciones nuevas (periodo)</p>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{fmtNum(chat.mensajes_periodo)}</p>
            <p className="text-xs text-gray-500">mensajes enviados (periodo)</p>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{fmtNum(chat.mensajes_no_leidos)}</p>
            <p className="text-xs text-gray-500">mensajes sin leer (total)</p>
          </div>
          <div>
            <p className="text-2xl font-black text-green-700">{Number(chat.tasa_respuesta_pct || 0).toFixed(1)}%</p>
            <p className="text-xs text-gray-500">tasa de respuesta (conversaciones con ≥2 mensajes)</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ACTIVIDAD
// ---------------------------------------------------------------------------
const TIPO_META: Record<string, { label: string; color: string }> = {
  registro: { label: 'Registro', color: 'bg-teal-100 text-teal-800' },
  publicacion_creada: { label: 'Publicación', color: 'bg-blue-100 text-blue-800' },
  compra_creditos: { label: 'Compra', color: 'bg-green-100 text-green-800' },
  contacto: { label: 'Contacto', color: 'bg-amber-100 text-amber-800' },
  auditoria: { label: 'Admin', color: 'bg-purple-100 text-purple-800' },
}

export function ActividadSection({ data, loading }: { data: any; loading: boolean }) {
  if (loading && !data) return <Loading label="Cargando actividad…" />
  const rows = Array.isArray(data) ? data : []
  return (
    <Card title="Actividad reciente del sitio" icon={Activity}>
      {rows.length === 0 ? <Empty msg="Aún no hay actividad registrada" /> : (
        <ul className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto pr-1">
          {rows.map((r: any, i: number) => {
            const meta = TIPO_META[r.tipo] || { label: r.tipo, color: 'bg-gray-100 text-gray-700' }
            return (
              <li key={i} className="py-2.5 flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.color}`}>{meta.label}</span>
                <span className="text-sm text-gray-700 flex-1 truncate">{r.descripcion}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap" title={String(r.fecha)}>{timeAgo(r.fecha)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
