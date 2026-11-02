/**
 * Calculadora inmobiliaria adaptada a la realidad del mercado venezolano:
 *  - Doble referencia USD y Bolívares a tasa oficial BCV
 *  - Plan de financiamiento directo corto (inicial + cuotas 6–48 meses)
 *  - Estimación de gastos de protocolización/cierre (SAREN / honorarios)
 *  - Retorno bruto y neto por alquiler (ROI anual / años de recuperación)
 *  - Desembolso inicial estimado para inquilinos en contratos de arrendamiento
 */

export interface DirectFinancingInput {
  priceUsd: number
  downPaymentPct: number
  termMonths: number
  annualInterestPct?: number
  closingCostsPct?: number
  bcvRate?: number | null
}

export interface DirectFinancingResult {
  priceUsd: number
  priceVes: number | null
  downPaymentUsd: number
  closingCostsUsd: number
  upfrontTotalUsd: number
  financedPrincipalUsd: number
  monthlyPaymentUsd: number
  monthlyPaymentVes: number | null
  totalPaidUsd: number
}

export interface RentalYieldInput {
  priceUsd: number
  estimatedMonthlyRentUsd: number
  annualExpensesPct?: number
}

export interface RentalYieldResult {
  grossAnnualIncomeUsd: number
  netAnnualIncomeUsd: number
  grossYieldPct: number
  netYieldPct: number
  paybackYears: number | null
}

export interface RentalMoveInInput {
  monthlyRentUsd: number
  depositMonths: number
  advanceMonths: number
  adminFeeMonths?: number
  bcvRate?: number | null
}

export interface RentalMoveInResult {
  monthlyRentUsd: number
  monthlyRentVes: number | null
  depositUsd: number
  advanceUsd: number
  adminFeeUsd: number
  totalMoveInUsd: number
  totalMoveInVes: number | null
}

export interface ZonePriceBenchmarkResult {
  listingPricePerM2: number
  medianPricePerM2: number
  minPricePerM2: number
  maxPricePerM2: number
  sampleCount: number
  deltaPct: number
  positioning: 'below_market' | 'at_market' | 'above_market'
}

/**
 * Compara el `$/m²` de un inmueble frente a la mediana de inmuebles similares activos
 * en su misma urbanización/ciudad (requiere al menos 2 comparables válidos).
 */
export function computeZonePriceBenchmark(
  listingPricePerM2: number | null | undefined,
  comparablePricesPerM2: Array<number | null | undefined>,
): ZonePriceBenchmarkResult | null {
  const current = Number(listingPricePerM2)
  if (!Number.isFinite(current) || current <= 0) return null

  const valid = comparablePricesPerM2
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 20 && v < 50000)
    .sort((a, b) => a - b)

  if (valid.length < 2) return null

  const mid = Math.floor(valid.length / 2)
  const median =
    valid.length % 2 === 0
      ? round2((valid[mid - 1] + valid[mid]) / 2)
      : round2(valid[mid])

  if (median <= 0) return null

  const deltaPct = round2(((current - median) / median) * 100)
  const positioning: ZonePriceBenchmarkResult['positioning'] =
    deltaPct <= -8 ? 'below_market' : deltaPct >= 8 ? 'above_market' : 'at_market'

  return {
    listingPricePerM2: Math.round(current),
    medianPricePerM2: Math.round(median),
    minPricePerM2: Math.round(valid[0]),
    maxPricePerM2: Math.round(valid[valid.length - 1]),
    sampleCount: valid.length,
    deltaPct,
    positioning,
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(n, min), max)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function estimateDirectFinancing(input: DirectFinancingInput): DirectFinancingResult {
  const priceUsd = Math.max(0, Number(input.priceUsd) || 0)
  const downPct = clamp(Number(input.downPaymentPct), 0, 100)
  const termMonths = Math.max(1, Math.round(clamp(Number(input.termMonths), 1, 120)))
  const annualRate = clamp(Number(input.annualInterestPct ?? 0), 0, 60)
  const closingPct = clamp(Number(input.closingCostsPct ?? 2.5), 0, 15)
  const bcv = input.bcvRate && Number.isFinite(input.bcvRate) && input.bcvRate > 0 ? Number(input.bcvRate) : null

  const downPaymentUsd = round2((priceUsd * downPct) / 100)
  const closingCostsUsd = round2((priceUsd * closingPct) / 100)
  const upfrontTotalUsd = round2(downPaymentUsd + closingCostsUsd)
  const financedPrincipalUsd = round2(Math.max(0, priceUsd - downPaymentUsd))

  let monthlyPaymentUsd = 0
  if (financedPrincipalUsd > 0) {
    const monthlyRate = annualRate / 100 / 12
    if (monthlyRate <= 0) {
      monthlyPaymentUsd = round2(financedPrincipalUsd / termMonths)
    } else {
      const factor = Math.pow(1 + monthlyRate, termMonths)
      monthlyPaymentUsd = round2((financedPrincipalUsd * (monthlyRate * factor)) / (factor - 1))
    }
  }

  const totalPaidUsd = round2(downPaymentUsd + monthlyPaymentUsd * termMonths)

  return {
    priceUsd,
    priceVes: bcv ? round2(priceUsd * bcv) : null,
    downPaymentUsd,
    closingCostsUsd,
    upfrontTotalUsd,
    financedPrincipalUsd,
    monthlyPaymentUsd,
    monthlyPaymentVes: bcv ? round2(monthlyPaymentUsd * bcv) : null,
    totalPaidUsd,
  }
}

export function estimateRentalYield(input: RentalYieldInput): RentalYieldResult {
  const priceUsd = Math.max(0, Number(input.priceUsd) || 0)
  const monthlyRent = Math.max(0, Number(input.estimatedMonthlyRentUsd) || 0)
  const expensesPct = clamp(Number(input.annualExpensesPct ?? 12), 0, 80)

  const grossAnnualIncomeUsd = round2(monthlyRent * 12)
  const netAnnualIncomeUsd = round2(grossAnnualIncomeUsd * (1 - expensesPct / 100))

  if (priceUsd <= 0 || grossAnnualIncomeUsd <= 0) {
    return {
      grossAnnualIncomeUsd,
      netAnnualIncomeUsd,
      grossYieldPct: 0,
      netYieldPct: 0,
      paybackYears: null,
    }
  }

  const grossYieldPct = round2((grossAnnualIncomeUsd / priceUsd) * 100)
  const netYieldPct = round2((netAnnualIncomeUsd / priceUsd) * 100)
  const paybackYears = netAnnualIncomeUsd > 0 ? round2(priceUsd / netAnnualIncomeUsd) : null

  return {
    grossAnnualIncomeUsd,
    netAnnualIncomeUsd,
    grossYieldPct,
    netYieldPct,
    paybackYears,
  }
}

export function estimateRentalMoveIn(input: RentalMoveInInput): RentalMoveInResult {
  const monthlyRentUsd = Math.max(0, Number(input.monthlyRentUsd) || 0)
  const depositMonths = clamp(Math.round(Number(input.depositMonths) || 0), 0, 12)
  const advanceMonths = clamp(Math.round(Number(input.advanceMonths) || 1), 1, 12)
  const adminFeeMonths = clamp(Number(input.adminFeeMonths ?? 1), 0, 6)
  const bcv = input.bcvRate && Number.isFinite(input.bcvRate) && input.bcvRate > 0 ? Number(input.bcvRate) : null

  const depositUsd = round2(monthlyRentUsd * depositMonths)
  const advanceUsd = round2(monthlyRentUsd * advanceMonths)
  const adminFeeUsd = round2(monthlyRentUsd * adminFeeMonths)
  const totalMoveInUsd = round2(depositUsd + advanceUsd + adminFeeUsd)

  return {
    monthlyRentUsd,
    monthlyRentVes: bcv ? round2(monthlyRentUsd * bcv) : null,
    depositUsd,
    advanceUsd,
    adminFeeUsd,
    totalMoveInUsd,
    totalMoveInVes: bcv ? round2(totalMoveInUsd * bcv) : null,
  }
}
