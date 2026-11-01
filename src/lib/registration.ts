import {
  TRIAL_DAYS,
  isAccountType,
  isPlanName,
  planForAccountType,
  type AccountType,
  type PlanName,
} from './plan-catalog.ts'

/**
 * Lógica pura del registro de cuentas.
 *
 * Vive fuera de la página para poder probarla: qué campos pide cada tipo de
 * cuenta, qué se valida en cada paso y qué metadatos se envían a Supabase Auth
 * (que un trigger convierte en `perfiles` + `suscripciones` con prueba de 30 días).
 */

export interface RegistrationDraft {
  tipoCuenta: AccountType
  plan: PlanName
  nombre: string
  apellido: string
  email: string
  telefono: string
  estado: string
  ciudad: string
  empresa: string
  licencia: string
  password: string
  repeatPassword: string
}

export type RegistrationErrorKey =
  | 'type'
  | 'name'
  | 'surname'
  | 'email'
  | 'empresa'
  | 'password'
  | 'passwordUpper'
  | 'passwordNumber'
  | 'passwordMismatch'

export const EMPTY_DRAFT: RegistrationDraft = {
  tipoCuenta: 'particular',
  plan: 'gratuita',
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  estado: '',
  ciudad: '',
  empresa: '',
  licencia: '',
  password: '',
  repeatPassword: '',
}

/** Las agencias se identifican por el nombre del negocio y un responsable. */
export function usesSurname(tipo: AccountType): boolean {
  return tipo !== 'agencia'
}

/** Solo las agencias piden nombre comercial de la inmobiliaria. */
export function requiresCompany(tipo: AccountType): boolean {
  return tipo === 'agencia'
}

/** Profesionales y agencias pueden indicar su licencia de corretaje. */
export function offersLicense(tipo: AccountType): boolean {
  return tipo !== 'particular'
}

/** Cambiar de tipo de cuenta recoloca el plan sugerido y limpia campos ajenos. */
export function applyAccountType(draft: RegistrationDraft, tipo: AccountType): RegistrationDraft {
  return {
    ...draft,
    tipoCuenta: tipo,
    plan: planForAccountType(tipo),
    empresa: requiresCompany(tipo) ? draft.empresa : '',
    licencia: offersLicense(tipo) ? draft.licencia : '',
    apellido: usesSurname(tipo) ? draft.apellido : '',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateAccountStep(tipo: unknown): RegistrationErrorKey | null {
  return isAccountType(tipo) ? null : 'type'
}

export function validatePlanStep(plan: unknown): RegistrationErrorKey | null {
  return isPlanName(plan) ? null : 'type'
}

/** Validación del paso de datos, con reglas distintas según el tipo de cuenta. */
export function validateDetailsStep(draft: RegistrationDraft): RegistrationErrorKey | null {
  const nombre = draft.nombre.trim()
  if (nombre.length < 2) return 'name'
  if (usesSurname(draft.tipoCuenta) && draft.apellido.trim().length < 2) return 'surname'
  if (requiresCompany(draft.tipoCuenta) && draft.empresa.trim().length < 2) return 'empresa'
  if (!EMAIL_RE.test(draft.email.trim())) return 'email'
  if (draft.password.length < 8) return 'password'
  if (!/[A-Z]/.test(draft.password)) return 'passwordUpper'
  if (!/[0-9]/.test(draft.password)) return 'passwordNumber'
  if (draft.password !== draft.repeatPassword) return 'passwordMismatch'
  return null
}

/** Nombre que se guarda en `perfiles.nombre` (persona o responsable de agencia). */
export function displayName(draft: RegistrationDraft): string {
  return [draft.nombre, usesSurname(draft.tipoCuenta) ? draft.apellido : '']
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Metadatos que viajan en `auth.signUp({ options: { data } })`. El trigger
 * `handle_new_auth_user` los copia al perfil y crea la suscripción de prueba.
 */
export function buildSignupMetadata(draft: RegistrationDraft): Record<string, string> {
  const nombreCompleto = displayName(draft)
  const metadata: Record<string, string> = {
    nombre_completo: nombreCompleto,
    nombre: nombreCompleto,
    email: draft.email.trim(),
    tipo_cuenta: draft.tipoCuenta,
    plan: draft.plan,
    trial_dias: String(TRIAL_DAYS),
  }

  const telefono = draft.telefono.trim()
  if (telefono) metadata.telefono = telefono
  if (draft.estado.trim()) metadata.estado = draft.estado.trim()
  if (draft.ciudad.trim()) metadata.ciudad = draft.ciudad.trim()
  if (requiresCompany(draft.tipoCuenta) && draft.empresa.trim()) metadata.empresa_nombre = draft.empresa.trim()
  if (offersLicense(draft.tipoCuenta) && draft.licencia.trim()) metadata.licencia_corredor = draft.licencia.trim()

  return metadata
}

/** Fin de la prueba gratuita (mismo cálculo que el trigger de la base de datos). */
export function trialEndsAt(start: Date = new Date(), dias: number = TRIAL_DAYS): string {
  return new Date(start.getTime() + dias * 24 * 60 * 60 * 1000).toISOString()
}
