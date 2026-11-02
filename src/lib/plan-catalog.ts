/**
 * Catálogo puro de tipos de cuenta y planes.
 *
 * Sin dependencias de servidor: lo usan el formulario de registro, la página de
 * planes, la portada y el control de límites del API (`src/lib/plans.ts`).
 *
 * Reglas de negocio vigentes:
 * - Prueba gratuita: 30 días en cualquiera de los planes, sin tarjeta.
 * - Plan Gratuita: 3 anuncios activos · 8 fotos · 0 créditos.
 * - Plan Profesional: 10 anuncios activos · 20 fotos · 5 créditos.
 * - Plan Profesional Plus: 35 anuncios activos · 30 fotos · 12 créditos (1 usuario, sin multiagente).
 * - Plan Agencia: anuncios ilimitados · 30 fotos · 20 créditos + equipo multiagente.
 */

export type PlanName = 'gratuita' | 'profesional' | 'profesional_plus' | 'agencia'
export type PaidPlanName = Exclude<PlanName, 'gratuita'>
export type AccountType = 'particular' | 'profesional' | 'agencia'

/** Días de prueba gratuita que se activan al crear cualquier cuenta. */
export const TRIAL_DAYS = 30

/** Valor interno de «sin límite» (se muestra como ∞ y nunca se alcanza). */
export const UNLIMITED_LISTINGS = 999999

export interface PlanLimits {
  maxAnuncios: number
  maxFotos: number
  creditosMes: number
}

export const PLAN_NAMES: readonly PlanName[] = [
  'gratuita',
  'profesional',
  'profesional_plus',
  'agencia',
]

export const PAID_PLAN_NAMES: readonly PaidPlanName[] = [
  'profesional',
  'profesional_plus',
  'agencia',
]

export const ACCOUNT_TYPES: readonly AccountType[] = ['particular', 'profesional', 'agencia']

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  gratuita: { maxAnuncios: 3, maxFotos: 8, creditosMes: 0 },
  profesional: { maxAnuncios: 10, maxFotos: 20, creditosMes: 5 },
  profesional_plus: { maxAnuncios: 35, maxFotos: 30, creditosMes: 12 },
  agencia: { maxAnuncios: UNLIMITED_LISTINGS, maxFotos: 30, creditosMes: 20 },
}

export const PLAN_RANK: Record<PlanName, number> = {
  gratuita: 0,
  profesional: 1,
  profesional_plus: 2,
  agencia: 3,
}

/** Plan que se preselecciona según el tipo de cuenta elegido al registrarse. */
export const PLAN_BY_ACCOUNT_TYPE: Record<AccountType, PlanName> = {
  particular: 'gratuita',
  profesional: 'profesional',
  agencia: 'agencia',
}

/** Tipo de cuenta que corresponde a un plan (Profesional Plus es individual -> `profesional`). */
export const ACCOUNT_TYPE_BY_PLAN: Record<PlanName, AccountType> = {
  gratuita: 'particular',
  profesional: 'profesional',
  profesional_plus: 'profesional',
  agencia: 'agencia',
}

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === 'string' && (ACCOUNT_TYPES as readonly string[]).includes(value)
}

export function isPlanName(value: unknown): value is PlanName {
  return typeof value === 'string' && (PLAN_NAMES as readonly string[]).includes(value)
}

export function isPaidPlanName(value: unknown): value is PaidPlanName {
  return typeof value === 'string' && (PAID_PLAN_NAMES as readonly string[]).includes(value)
}

export function getPlanRank(plan: unknown): number {
  return isPlanName(plan) ? PLAN_RANK[plan] : 0
}

export function isPlanUpgrade(currentPlan: unknown, targetPlan: unknown): boolean {
  return getPlanRank(targetPlan) > getPlanRank(currentPlan)
}

export function getPlanDisplayName(plan: unknown, locale: 'es' | 'en' = 'es'): string {
  const en = locale === 'en'
  switch (plan) {
    case 'agencia':
      return en ? 'Agency' : 'Agencia'
    case 'profesional_plus':
      return en ? 'Professional Plus' : 'Profesional Plus'
    case 'profesional':
      return en ? 'Professional' : 'Profesional'
    default:
      return en ? 'Free' : 'Gratuita'
  }
}

export function planForAccountType(tipo: AccountType): PlanName {
  return PLAN_BY_ACCOUNT_TYPE[tipo] ?? 'gratuita'
}

export function accountTypeForPlan(plan: PlanName): AccountType {
  return ACCOUNT_TYPE_BY_PLAN[plan] ?? 'particular'
}

export function isUnlimited(maxAnuncios: number): boolean {
  return maxAnuncios >= UNLIMITED_LISTINGS
}

/** «3», «10», «35» o «∞» para mostrar el límite de anuncios en la interfaz. */
export function formatListingLimit(maxAnuncios: number): string {
  return isUnlimited(maxAnuncios) ? '∞' : String(maxAnuncios)
}
