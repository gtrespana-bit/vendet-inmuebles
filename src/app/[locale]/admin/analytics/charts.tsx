'use client'

import React from 'react'

// ---------------------------------------------------------------------------
// Gráficas SVG ligeras (sin librerías externas) para el panel de analítica
// ---------------------------------------------------------------------------

export function fmtNum(n: number | null | undefined): string {
  const v = Number(n || 0)
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(v)
}

export function fmtMoney(n: number | null | undefined): string {
  return '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n || 0))
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short' }).format(d)
}

export function timeAgo(iso: string | Date): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `hace ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

/** Insignia de variación vs periodo anterior (verde si sube, rojo si baja). */
export function DeltaBadge({ actual, prev, invert = false }: { actual: number; prev: number; invert?: boolean }) {
  const a = Number(actual || 0)
  const p = Number(prev || 0)
  if (p === 0) {
    if (a === 0) return <span className="text-xs text-gray-400">—</span>
    return <span className="text-xs font-semibold text-green-600">nuevo</span>
  }
  const pct = ((a - p) / p) * 100
  const up = pct >= 0
  const good = invert ? !up : up
  return (
    <span className={`text-xs font-semibold ${good ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

interface AreaChartProps {
  data: Array<Record<string, any>>
  series: Array<{ key: string; label: string; color: string }>
  height?: number
}

/** Gráfica de áreas multi-serie con viewBox responsive. */
export function AreaChart({ data, series, height = 230 }: AreaChartProps) {
  const W = 760
  const pad = { l: 46, r: 14, t: 16, b: 26 }
  const iw = W - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const n = data.length
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)))
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => pad.t + ih - (Math.min(v, max) / max) * ih

  const xTicks = Array.from(new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1].filter((i) => i >= 0 && i < n)))

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full h-auto" role="img" aria-label="Gráfica de evolución">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const gy = pad.t + ih * (1 - f)
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={gy} y2={gy} stroke="#ececec" strokeWidth={1} />
            <text x={pad.l - 8} y={gy + 3} textAnchor="end" fontSize={10} fill="#9ca3af">{fmtNum(max * f)}</text>
          </g>
        )
      })}
      {xTicks.map((i) => (
        <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">
          {fmtDate(String(data[i]?.fecha))}
        </text>
      ))}
      {series.map((s) => {
        const pts = data.map((d, i) => [x(i), y(Number(d[s.key]) || 0)] as [number, number])
        if (pts.length === 0) return null
        const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
        const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + ih).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.t + ih).toFixed(1)} Z`
        return (
          <g key={s.key}>
            <path d={area} fill={s.color} fillOpacity={0.09} stroke="none" />
            <path d={line} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill={s.color}>
                <title>{`${fmtDate(String(data[i]?.fecha))} · ${s.label}: ${fmtNum(Number(data[i]?.[s.key]) || 0)}`}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/** Barras horizontales para rankings (top páginas, fuentes, búsquedas...). */
export function BarList({
  rows,
  labelKey,
  valueKey,
  secondaryKey,
  color = '#16294B',
  maxRows = 10,
  formatValue = fmtNum,
}: {
  rows: Array<Record<string, any>>
  labelKey: string
  valueKey: string
  secondaryKey?: string
  color?: string
  maxRows?: number
  formatValue?: (v: number) => string
}) {
  const list = (rows || []).slice(0, maxRows)
  const max = Math.max(1, ...list.map((r) => Number(r[valueKey]) || 0))
  if (list.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">Sin datos en este periodo</p>
  return (
    <div className="space-y-2.5">
      {list.map((r, i) => {
        const v = Number(r[valueKey]) || 0
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-gray-700" title={String(r[labelKey])}>{String(r[labelKey])}</span>
              <span className="whitespace-nowrap font-semibold text-gray-900">
                {formatValue(v)}
                {secondaryKey && <span className="text-xs text-gray-400 font-normal"> · {fmtNum(Number(r[secondaryKey]) || 0)} ses.</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Donut para distribución (dispositivos, navegadores...). */
export function Donut({ rows, labelKey, valueKey }: { rows: Array<Record<string, any>>; labelKey: string; valueKey: string }) {
  const COLORS = ['#16294B', '#B08542', '#2E7D6B', '#C0564F', '#5B7DB1', '#8C6526', '#6B7280']
  const list = (rows || []).filter((r) => Number(r[valueKey]) > 0)
  const total = list.reduce((a, r) => a + Number(r[valueKey]), 0)
  if (total === 0) return <p className="text-sm text-gray-400 py-6 text-center">Sin datos en este periodo</p>
  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f1f1" strokeWidth={14} />
        {list.map((r, i) => {
          const frac = Number(r[valueKey]) / total
          const dash = `${frac * C} ${C}`
          const el = (
            <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={14} strokeDasharray={dash} strokeDashoffset={-offset}>
              <title>{`${r[labelKey]}: ${fmtNum(Number(r[valueKey]))} (${((frac * 100).toFixed(1))}%)`}</title>
            </circle>
          )
          offset += frac * C
          return el
        })}
        <text x="50" y="47" textAnchor="middle" fontSize="15" fontWeight="800" fill="#111827" className="rotate-90 origin-center">{fmtNum(total)}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="7" fill="#6b7280" className="rotate-90 origin-center">pageviews</text>
      </svg>
      <ul className="space-y-1.5 text-sm flex-1">
        {list.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-gray-700 truncate flex-1">{String(r[labelKey])}</span>
            <span className="font-semibold text-gray-900">{fmtNum(Number(r[valueKey]))}</span>
            <span className="text-xs text-gray-400 w-12 text-right">{((Number(r[valueKey]) / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Barras verticales para distribución horaria. */
export function HourChart({ rows }: { rows: Array<{ hora: number; views: number }> }) {
  const data = Array.from({ length: 24 }, (_, h) => rows.find((r) => Number(r.hora) === h) || { hora: h, views: 0 })
  const max = Math.max(1, ...data.map((d) => d.views))
  return (
    <div className="flex items-end gap-[3px] h-28">
      {data.map((d) => (
        <div key={d.hora} className="flex-1 flex flex-col items-center justify-end h-full group relative">
          <div
            className="w-full rounded-t bg-brand-primary/80 group-hover:bg-brand-primary transition"
            style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views > 0 ? 3 : 1 }}
            title={`${d.hora}:00 — ${fmtNum(d.views)} pageviews`}
          />
          {d.hora % 4 === 0 && <span className="text-[9px] text-gray-400 mt-1">{d.hora}h</span>}
        </div>
      ))}
    </div>
  )
}
