/**
 * Validación y normalización de URLs personalizadas de escaparate (`/vendedor/[slug]`) — F12.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/

export const RESERVED_STOREFRONT_SLUGS = new Set([
  'admin',
  'agencias',
  'api',
  'asesores',
  'auth',
  'ayuda',
  'blog',
  'buscar',
  'catalogo',
  'chat',
  'contacto',
  'creditos',
  'dashboard',
  'demo',
  'editar',
  'en',
  'es',
  'favoritos',
  'guias',
  'help',
  'home',
  'inmuebles',
  'legal',
  'login',
  'logout',
  'mapa',
  'mensajes',
  'moderacion',
  'nuevo',
  'oficial',
  'pagos',
  'perfil',
  'planes',
  'pricing',
  'privacidad',
  'propiedad',
  'propiedades',
  'publicar',
  'register',
  'registro',
  'root',
  'search',
  'settings',
  'sistema',
  'soporte',
  'support',
  'terminos',
  'vendedor',
  'vendedores',
  'venezuela',
  'venezuela-inmuebles',
  'verificacion',
  'verificado',
])

export function isUuidIdentifier(value: string): boolean {
  return UUID_REGEX.test(value.trim())
}

export function normalizeStorefrontSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface SlugValidationResult {
  valid: boolean
  normalized: string
  reason?: 'empty' | 'length' | 'format' | 'uuid' | 'reserved'
}

export function validateStorefrontSlug(raw: string): SlugValidationResult {
  const normalized = normalizeStorefrontSlug(raw)
  if (!normalized) {
    return { valid: false, normalized: '', reason: 'empty' }
  }
  if (normalized.length < 3 || normalized.length > 50) {
    return { valid: false, normalized, reason: 'length' }
  }
  if (UUID_REGEX.test(normalized)) {
    return { valid: false, normalized, reason: 'uuid' }
  }
  if (RESERVED_STOREFRONT_SLUGS.has(normalized)) {
    return { valid: false, normalized, reason: 'reserved' }
  }
  if (!SLUG_REGEX.test(normalized) || normalized.includes('--')) {
    return { valid: false, normalized, reason: 'format' }
  }
  return { valid: true, normalized }
}

export function canPlanUseCustomStorefront(plan: string | null | undefined): boolean {
  return plan === 'profesional' || plan === 'agencia'
}
