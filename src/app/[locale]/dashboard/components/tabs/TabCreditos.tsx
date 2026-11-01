"use client"

import { useState, useEffect } from 'react'
import { CreditCard, Zap, Star, CheckCircle } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { CREDIT_PACKAGES } from '@/lib/payment-catalog'
import type { PlanInfo } from '../../hooks/useDashboard'

const POPULAR_CREDITS = 15

export default function TabCreditos({
  creditos,
  planInfo,
  tasaBs,
}: {
  creditos: number
  planInfo?: PlanInfo | null
  tasaBs: number
  refreshCreditos?: () => void
}) {
  const [tasa, setTasa] = useState<number>(tasaBs || 487.12)

  useEffect(() => {
    fetch('/api/tasa-bcv')
      .then((r) => r.json())
      .then((d) => { if (d.tasa) setTasa(d.tasa) })
      .catch(() => {})
  }, [])

  const planIncluidos = planInfo?.creditosIncluidos ?? 0
  const planRestantes = planInfo?.creditosRestantesPlan ?? 0
  const totalDisponible = creditos + planRestantes

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="bg-gradient-to-r from-brand-primary to-blue-900 rounded-2xl p-6 text-white flex items-center justify-between gap-4">
        <div>
          <p className="text-sm opacity-80">Total disponible</p>
          <p className="text-4xl font-black">{totalDisponible} créditos</p>
          <p className="text-xs opacity-80 mt-2">
            Comprados (sin vencimiento): <strong>{creditos}</strong>
            {planIncluidos > 0 && (
              <> · Incluidos en tu plan este ciclo: <strong>{planRestantes} de {planIncluidos}</strong> (se usan primero)</>
            )}
          </p>
        </div>
        <CreditCard size={40} className="opacity-50 flex-shrink-0" />
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-lg mb-3">¿Para qué sirven?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="font-bold text-brand-primary flex items-center gap-2"><Zap size={18} className="text-yellow-500" /> Boost — 1 crédito</p>
            <p className="text-sm text-gray-600 mt-1">Sube tu publicación al primer lugar del listado</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="font-bold text-brand-primary flex items-center gap-2"><Star size={18} className="text-[var(--gold-text)]" /> Destacado</p>
            <p className="text-sm text-gray-600 mt-1">4cr / 12h · 6cr / 24h · 10cr / 48h</p>
          </div>
        </div>
      </div>

      {/* Paquetes */}
      <h3 className="text-xl font-bold text-gray-800 text-center">Elige tu paquete</h3>
      <p className="text-center text-sm text-gray-500">
        Tasa BCV referencial: <span className="font-bold text-brand-primary">Bs. {tasa.toFixed(2)} por $</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CREDIT_PACKAGES.map((pkg) => {
          const popular = pkg.creditos === POPULAR_CREDITS
          const porCredito = (pkg.precio / pkg.creditos).toFixed(2)
          const precioBs = (pkg.precio * tasa).toFixed(2)
          return (
            <div
              key={pkg.creditos}
              className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition hover:-translate-y-1 ${popular ? 'border-brand-accent' : 'border-transparent'}`}
            >
              {popular && (
                <div className="bg-brand-accent text-[var(--on-gold)] text-center py-1.5 text-xs font-bold">
                  ⭐ MÁS POPULAR
                </div>
              )}
              <div className="bg-gradient-to-br from-brand-primary to-blue-800 p-6 text-white text-center">
                <p className="text-5xl font-black">{pkg.creditos}</p>
                <p className="text-sm opacity-80">créditos</p>
              </div>
              <div className="p-6 text-center">
                <p className="text-3xl font-black text-gray-800 mb-1">
                  ${pkg.precio} <span className="text-sm font-normal text-gray-500">USD</span>
                </p>
                <p className="text-sm text-gray-400 mb-4">≈ Bs. {precioBs}</p>
                <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg py-1 px-2 inline-block">
                  ${porCredito} por crédito
                </p>
                <ul className="text-sm text-gray-600 space-y-2 mb-6 text-left">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    <strong>{pkg.creditos}</strong> boost(s) al #1
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    {pkg.creditos >= 4 ? `o ${Math.floor(pkg.creditos / 4)}× destacado 12h` : 'Acumulable para destacados'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    Sin expiración
                  </li>
                </ul>
                <LocalLink
                  href={`/pagos?creditos=${pkg.creditos}`}
                  className="block w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition text-center"
                >
                  Comprar en Pagos →
                </LocalLink>
              </div>
            </div>
          )
        })}
      </div>

      {/* Métodos reales */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-lg mb-4 text-center">Métodos de pago disponibles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
          {[
            { nombre: 'Pago Móvil (Bs. a tasa BCV)', emoji: '📱' },
            { nombre: 'Binance Pay (USDT)', emoji: '🟡' },
          ].map((m) => (
            <div key={m.nombre} className="rounded-xl p-4 text-center bg-gray-50">
              <span className="text-3xl block mb-2">{m.emoji}</span>
              <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center mt-4">
          Las compras se registran y verifican en <LocalLink href="/pagos" className="underline text-brand-primary">Pagos y justificantes</LocalLink>, con activación provisional automática si el comprobante es legible y confirmación definitiva tras verificar el ingreso.
        </p>
      </div>
    </div>
  )
}
