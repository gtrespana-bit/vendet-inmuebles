'use client'

import React from 'react'
import { DeltaBadge, fmtNum } from './charts'

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
      <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Empty({ msg = 'Sin datos en este periodo' }: { msg?: string }) {
  return <p className="text-sm text-gray-400 py-8 text-center">{msg}</p>
}

export function Card({
  title,
  icon: Icon,
  children,
  right,
  className = '',
}: {
  title: string
  icon?: React.ComponentType<{ size?: number | string; className?: string }>
  children: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={16} className="text-brand-primary shrink-0" />}
          <h3 className="font-bold text-gray-900 text-sm truncate">{title}</h3>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

/** Tarjeta KPI con valor, variación vs periodo anterior e icono. */
export function KpiCard({
  label,
  value,
  prev,
  icon: Icon,
  color = 'text-brand-primary',
  bg = 'bg-brand-primary/10',
  format = fmtNum,
  invert = false,
  hint,
}: {
  label: string
  value: number
  prev?: number
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  color?: string
  bg?: string
  format?: (v: number) => string
  invert?: boolean
  hint?: string
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
        {prev !== undefined && <DeltaBadge actual={value} prev={prev} invert={invert} />}
      </div>
      <p className="text-2xl font-black text-gray-900 mt-2 tabular-nums">{format(value)}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

/** Leyenda de series para las gráficas. */
export function Legend({ series }: { series: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}
