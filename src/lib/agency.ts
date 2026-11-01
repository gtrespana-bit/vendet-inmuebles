import { createHash, randomBytes } from 'node:crypto'

export type AgencyRole = 'admin' | 'agente'

export interface EffectiveAgencyContext {
  id: string
  nombre: string
  descripcion: string | null
  logo_url: string | null
  owner_id: string
  rol: AgencyRole
  isOwner: boolean
  isAdmin: boolean
  agenciaPlanActivo: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TOKEN_RE = /^[a-f0-9]{48}$/

export function generateInviteToken(): string {
  return randomBytes(24).toString('hex')
}

export function isValidInviteToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value.trim())
}

export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken.trim()).digest('hex')
}

export function normalizeInviteEmail(value: unknown): { ok: true; email: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, email: null }
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Correo electrónico inválido' }
  }
  const clean = value.trim().toLowerCase()
  if (!clean) {
    return { ok: true, email: null }
  }
  if (clean.length > 254 || !EMAIL_RE.test(clean)) {
    return { ok: false, error: 'Introduce un correo electrónico válido' }
  }
  return { ok: true, email: clean }
}

export function isValidAgencyRole(value: unknown): value is AgencyRole {
  return value === 'admin' || value === 'agente'
}

export function canManageAgencyTeam(actorId: string, ownerId: string, actorRole: AgencyRole | null): boolean {
  if (!actorId || !ownerId) return false
  return actorId === ownerId || actorRole === 'admin'
}

export function canTransferAgencyCredits(actorId: string, ownerId: string): boolean {
  return Boolean(actorId && ownerId && actorId === ownerId)
}

export function canInviteMatchUserEmail(inviteEmail: string | null | undefined, userEmail: string | null | undefined): boolean {
  if (!inviteEmail) return true
  if (!userEmail) return false
  return inviteEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()
}

/**
 * Determina el titular jurídico (`usuario_id`), la organización (`agencia_id`) y
 * el asesor responsable (`agente_asignado_id`) al publicar en nombre de una agencia.
 *
 * Regla acordada:
 * - Si el usuario pertenece a una agencia con plan Agencia vigente, la cartera
 *   pertenece a la agencia (`usuario_id = agency.owner_id`, `agencia_id = agency.id`).
 * - El dueño o un admin de la agencia puede elegir a qué miembro activo asignar el
 *   inmueble; un agente regular queda asignado automáticamente a sí mismo.
 */
export function resolveEffectiveAgencyPublisher(params: {
  userId: string
  agency: EffectiveAgencyContext | null
  requestedAgentId?: string | null
  activeMemberIds?: ReadonlySet<string>
}): {
  usuario_id: string
  agencia_id: string | null
  agente_asignado_id: string | null
} {
  const { userId, agency, requestedAgentId, activeMemberIds } = params
  if (!agency || !agency.agenciaPlanActivo) {
    return {
      usuario_id: userId,
      agencia_id: null,
      agente_asignado_id: null,
    }
  }

  let assigned = userId
  if (
    requestedAgentId &&
    (agency.isOwner || agency.isAdmin) &&
    (requestedAgentId === agency.owner_id || activeMemberIds?.has(requestedAgentId))
  ) {
    assigned = requestedAgentId
  }

  return {
    usuario_id: agency.owner_id,
    agencia_id: agency.id,
    agente_asignado_id: assigned,
  }
}
