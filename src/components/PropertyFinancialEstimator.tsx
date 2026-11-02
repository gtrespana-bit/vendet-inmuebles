'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calculator, TrendingUp, Landmark } from 'lucide-react'
import {
  estimateDirectFinancing,
  estimateRentalMoveIn,
  estimateRentalYield,
} from '@/lib/financial-estimator'

interface PropertyFinancialEstimatorProps {
  priceUsd: number
  isRent: boolean
  locale: string
}

export default function PropertyFinancialEstimator({
  priceUsd,
  isRent,
  locale,
}: PropertyFinancialEstimatorProps) {
  const isEn = locale === 'en'
  const numberLocale = isEn ? 'en-US' : 'es-VE'

  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'plan' | 'yield'>('plan')

  // Estado para Venta — Financiamiento directo corto
  const [downPaymentPct, setDownPaymentPct] = useState(40)
  const [termMonths, setTermMonths] = useState(18)
  const [annualInterestPct, setAnnualInterestPct] = useState(0)

  // Estado para Venta — Rentabilidad por alquiler (aprox. 0.65% mensual por defecto)
  const [estimatedRentUsd, setEstimatedRentUsd] = useState(() =>
    Math.max(150, Math.round((priceUsd * 0.0065) / 10) * 10),
  )

  // Estado para Alquiler — Desembolso de ingreso
  const [depositMonths, setDepositMonths] = useState(2)
  const [advanceMonths, setAdvanceMonths] = useState(1)
  const [adminMonths, setAdminMonths] = useState(1)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tasa-bcv')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const tasa = Number(data.tasa ?? data.promedio ?? data.usd ?? 0)
        if (Number.isFinite(tasa) && tasa > 0) setBcvRate(tasa)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const fmtUsd = (val: number) =>
    `$${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(Math.round(val))}`

  const fmtVes = (val: number) =>
    `Bs. ${new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(Math.round(val))}`

  const financing = useMemo(
    () =>
      estimateDirectFinancing({
        priceUsd,
        downPaymentPct,
        termMonths,
        annualInterestPct,
        closingCostsPct: 2.5,
        bcvRate,
      }),
    [priceUsd, downPaymentPct, termMonths, annualInterestPct, bcvRate],
  )

  const rentalYield = useMemo(
    () =>
      estimateRentalYield({
        priceUsd,
        estimatedMonthlyRentUsd: estimatedRentUsd,
        annualExpensesPct: 12,
      }),
    [priceUsd, estimatedRentUsd],
  )

  const moveIn = useMemo(
    () =>
      estimateRentalMoveIn({
        monthlyRentUsd: priceUsd,
        depositMonths,
        advanceMonths,
        adminFeeMonths: adminMonths,
        bcvRate,
      }),
    [priceUsd, depositMonths, advanceMonths, adminMonths, bcvRate],
  )

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null

  return (
    <section
      className="property-detail__panel"
      aria-labelledby="property-financial-estimator-title"
    >
      <div className="property-detail__section-heading">
        <div>
          <p className="property-detail__section-kicker">
            {isEn ? 'Financial planning & BCV reference' : 'Planificación financiera y referencia BCV'}
          </p>
          <h2 id="property-financial-estimator-title">
            {isRent
              ? isEn
                ? 'Estimated move-in cost'
                : 'Estimador de ingreso al alquiler'
              : isEn
                ? 'Payment plan & investment return'
                : 'Simulador de compra y rentabilidad'}
          </h2>
        </div>
        <Calculator size={20} aria-hidden="true" />
      </div>

      {bcvRate && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f4ee] border border-[#e7dfd1] px-3.5 py-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#16294B]">
            <Landmark size={14} className="text-[#8C6526]" aria-hidden="true" />
            {isEn
              ? `Official BCV rate reference: Bs. ${bcvRate.toFixed(2)} / USD`
              : `Referencia tasa oficial BCV: Bs. ${bcvRate.toFixed(2)} / USD`}
          </span>
          <span className="font-bold text-[#8C6526]">
            {isRent
              ? `${fmtVes(moveIn.monthlyRentVes || 0)}${isEn ? '/mo' : '/mes'}`
              : fmtVes(financing.priceVes || 0)}
          </span>
        </div>
      )}

      {isRent ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="rent-deposit" className="block text-xs font-semibold text-[#475569] mb-1">
                {isEn ? 'Security deposit (months)' : 'Meses de depósito'}
              </label>
              <select
                id="rent-deposit"
                value={depositMonths}
                onChange={(e) => setDepositMonths(Number(e.target.value))}
                className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4].map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? (isEn ? 'month' : 'mes') : isEn ? 'months' : 'meses'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rent-advance" className="block text-xs font-semibold text-[#475569] mb-1">
                {isEn ? 'Months in advance' : 'Meses adelantados'}
              </label>
              <select
                id="rent-advance"
                value={advanceMonths}
                onChange={(e) => setAdvanceMonths(Number(e.target.value))}
                className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm"
              >
                {[1, 2, 3, 6].map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? (isEn ? 'month' : 'mes') : isEn ? 'months' : 'meses'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rent-admin" className="block text-xs font-semibold text-[#475569] mb-1">
                {isEn ? 'Contract / agency fee' : 'Contrato / gestión'}
              </label>
              <select
                id="rent-admin"
                value={adminMonths}
                onChange={(e) => setAdminMonths(Number(e.target.value))}
                className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm"
              >
                <option value={0}>{isEn ? 'Direct (0)' : 'Trato directo (0)'}</option>
                <option value={1}>{isEn ? '1 month' : '1 mes administrativo'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500 m-0">{isEn ? 'Deposit' : 'Depósito'}</p>
              <p className="text-base font-bold text-[#16294B] mt-0.5 mb-0">{fmtUsd(moveIn.depositUsd)}</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500 m-0">{isEn ? 'Advance' : 'Adelanto'}</p>
              <p className="text-base font-bold text-[#16294B] mt-0.5 mb-0">{fmtUsd(moveIn.advanceUsd)}</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500 m-0">{isEn ? 'Legal / fee' : 'Gestión'}</p>
              <p className="text-base font-bold text-[#16294B] mt-0.5 mb-0">{fmtUsd(moveIn.adminFeeUsd)}</p>
            </div>
            <div className="rounded-xl bg-[#16294B] text-white p-3">
              <p className="text-[11px] text-white/75 m-0">{isEn ? 'Estimated total' : 'Total estimado ingreso'}</p>
              <p className="text-base font-bold text-[#E5C17B] mt-0.5 mb-0">{fmtUsd(moveIn.totalMoveInUsd)}</p>
              {moveIn.totalMoveInVes && (
                <p className="text-[10px] text-white/75 mt-0.5 mb-0">{fmtVes(moveIn.totalMoveInVes)}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="inline-flex rounded-xl bg-[#f4f1ea] p-1 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'plan' ? 'bg-[#16294B] text-white shadow-sm' : 'text-[#475569]'
              }`}
            >
              <Calculator size={13} aria-hidden="true" />
              <span>{isEn ? 'Direct payment plan' : 'Plan de pago directo'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('yield')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'yield' ? 'bg-[#16294B] text-white shadow-sm' : 'text-[#475569]'
              }`}
            >
              <TrendingUp size={13} aria-hidden="true" />
              <span>{isEn ? 'Investor ROI' : 'Rentabilidad alquiler'}</span>
            </button>
          </div>

          {activeTab === 'plan' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="fin-down" className="block text-xs font-semibold text-[#475569] mb-1">
                    {isEn ? `Down payment (${downPaymentPct}%)` : `Inicial (${downPaymentPct}%)`}
                  </label>
                  <input
                    id="fin-down"
                    type="range"
                    min={20}
                    max={80}
                    step={5}
                    value={downPaymentPct}
                    onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                    className="w-full accent-[#16294B]"
                  />
                  <span className="text-xs font-bold text-[#16294B]">{fmtUsd(financing.downPaymentUsd)}</span>
                </div>

                <div>
                  <label htmlFor="fin-term" className="block text-xs font-semibold text-[#475569] mb-1">
                    {isEn ? 'Term (months)' : 'Plazo de cuotas'}
                  </label>
                  <select
                    id="fin-term"
                    value={termMonths}
                    onChange={(e) => setTermMonths(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm"
                  >
                    {[6, 12, 18, 24, 36, 48].map((m) => (
                      <option key={m} value={m}>
                        {m} {isEn ? 'months' : 'meses'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="fin-rate" className="block text-xs font-semibold text-[#475569] mb-1">
                    {isEn ? 'Annual interest' : 'Tasa anual pactada'}
                  </label>
                  <select
                    id="fin-rate"
                    value={annualInterestPct}
                    onChange={(e) => setAnnualInterestPct(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm"
                  >
                    <option value={0}>{isEn ? '0% (No interest)' : '0% (Sin interés)'}</option>
                    <option value={6}>6% {isEn ? 'annual' : 'anual'}</option>
                    <option value={10}>10% {isEn ? 'annual' : 'anual'}</option>
                    <option value={12}>12% {isEn ? 'annual' : 'anual'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500 m-0">
                    {isEn ? 'Initial + closing (~2.5%)' : 'Inicial + gastos cierre (~2,5%)'}
                  </p>
                  <p className="text-lg font-bold text-[#16294B] mt-0.5 mb-0">
                    {fmtUsd(financing.upfrontTotalUsd)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-0">
                    {isEn ? 'Includes SAREN / legal est.' : 'Incluye estimado registro/honorarios'}
                  </p>
                </div>

                <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500 m-0">
                    {isEn ? 'Balance to finance' : 'Saldo a financiar'}
                  </p>
                  <p className="text-lg font-bold text-[#16294B] mt-0.5 mb-0">
                    {fmtUsd(financing.financedPrincipalUsd)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-0">
                    {termMonths} {isEn ? 'monthly installments' : 'cuotas mensuales'}
                  </p>
                </div>

                <div className="rounded-xl bg-[#16294B] text-white p-3">
                  <p className="text-[11px] text-white/75 m-0">
                    {isEn ? 'Estimated monthly payment' : 'Cuota mensual estimada'}
                  </p>
                  <p className="text-lg font-bold text-[#E5C17B] mt-0.5 mb-0">
                    {fmtUsd(financing.monthlyPaymentUsd)}
                    <span className="text-xs font-normal text-white/80">{isEn ? '/mo' : '/mes'}</span>
                  </p>
                  {financing.monthlyPaymentVes && (
                    <p className="text-[10px] text-white/75 mt-0.5 mb-0">
                      {fmtVes(financing.monthlyPaymentVes)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-w-xs">
                <label htmlFor="yield-rent" className="block text-xs font-semibold text-[#475569] mb-1">
                  {isEn ? 'Estimated monthly rent (USD)' : 'Canon mensual estimado de alquiler (USD)'}
                </label>
                <input
                  id="yield-rent"
                  type="number"
                  min={50}
                  max={50000}
                  step={25}
                  value={estimatedRentUsd}
                  onChange={(e) => setEstimatedRentUsd(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border border-[#d8d2c7] bg-white px-3 py-2 text-sm font-semibold text-[#16294B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500 m-0">
                    {isEn ? 'Gross annual income' : 'Ingreso bruto anual'}
                  </p>
                  <p className="text-lg font-bold text-[#16294B] mt-0.5 mb-0">
                    {fmtUsd(rentalYield.grossAnnualIncomeUsd)}
                  </p>
                </div>

                <div className="rounded-xl bg-[#16294B] text-white p-3">
                  <p className="text-[11px] text-white/75 m-0">
                    {isEn ? 'Gross / Net annual ROI' : 'Rentabilidad anual bruta / neta'}
                  </p>
                  <p className="text-lg font-bold text-[#E5C17B] mt-0.5 mb-0">
                    {rentalYield.grossYieldPct.toFixed(1)}%{' '}
                    <span className="text-xs font-normal text-white/80">
                      ({rentalYield.netYieldPct.toFixed(1)}% {isEn ? 'net' : 'neta'})
                    </span>
                  </p>
                </div>

                <div className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3">
                  <p className="text-[11px] text-slate-500 m-0">
                    {isEn ? 'Estimated payback' : 'Retorno estimado'}
                  </p>
                  <p className="text-lg font-bold text-[#16294B] mt-0.5 mb-0">
                    {rentalYield.paybackYears
                      ? `${rentalYield.paybackYears.toFixed(1)} ${isEn ? 'years' : 'años'}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#64748B] mt-3 mb-0">
            {isEn
              ? 'Illustrative calculation for buyer guidance. Payment terms depend on direct agreement with the seller.'
              : 'Cálculo referencial informativo. Las condiciones finales de pago o financiamiento dependen del acuerdo directo con el propietario o agencia.'}
          </p>
        </div>
      )}
    </section>
  )
}
