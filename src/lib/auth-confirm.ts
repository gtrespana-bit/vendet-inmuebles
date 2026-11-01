export type ConfirmOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'

export type ParsedConfirmationCallback =
  | {
      kind: 'error'
      error: string
      errorCode: string
      errorDescription: string
      isExpiredOrUsed: boolean
    }
  | {
      kind: 'token_hash'
      tokenHash: string
      type: ConfirmOtpType
    }
  | {
      kind: 'implicit'
      accessToken: string
      refreshToken: string
      type: string
    }
  | {
      kind: 'pkce'
      code: string
      type: string
    }
  | {
      kind: 'confirmed_flag'
    }
  | {
      kind: 'none'
    }

const VALID_OTP_TYPES = new Set<ConfirmOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function normalizeOtpType(raw: string | null): ConfirmOtpType {
  const clean = (raw || '').trim().toLowerCase() as ConfirmOtpType
  if (VALID_OTP_TYPES.has(clean)) return clean
  return 'signup'
}

/**
 * Construye la URL absoluta de retorno tras confirmar correo (/confirm o /en/confirm).
 * Sin parámetros de consulta para coincidir siempre con uri_allow_list de Supabase Auth.
 */
export function buildEmailConfirmRedirectUrl(origin: string, locale: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '')
  const prefix = locale === 'en' ? '/en' : ''
  return `${cleanOrigin}${prefix}/confirm`
}

/**
 * Analiza query (?code=..., ?token_hash=...) y hash (#access_token=..., #error=...)
 * devueltos por Supabase Auth al confirmar correo o abrir un enlace de verificación.
 */
export function parseConfirmationCallback(
  search: string,
  hash: string
): ParsedConfirmationCallback {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

  const error = fragment.get('error') || query.get('error') || ''
  const errorCode = fragment.get('error_code') || query.get('error_code') || ''
  const errorDescription =
    fragment.get('error_description') || query.get('error_description') || ''

  if (error || errorCode || errorDescription) {
    const combined = `${error} ${errorCode} ${errorDescription}`.toLowerCase()
    const isExpiredOrUsed =
      errorCode === 'otp_expired' ||
      combined.includes('expired') ||
      combined.includes('invalid') ||
      combined.includes('already')
    return {
      kind: 'error',
      error,
      errorCode,
      errorDescription,
      isExpiredOrUsed,
    }
  }

  const tokenHash = (query.get('token_hash') || fragment.get('token_hash') || '').trim()
  if (tokenHash) {
    const rawType = query.get('type') || fragment.get('type')
    return {
      kind: 'token_hash',
      tokenHash,
      type: normalizeOtpType(rawType),
    }
  }

  const accessToken = (fragment.get('access_token') || '').trim()
  const refreshToken = (fragment.get('refresh_token') || '').trim()
  if (accessToken && refreshToken) {
    return {
      kind: 'implicit',
      accessToken,
      refreshToken,
      type: (fragment.get('type') || query.get('type') || 'signup').trim().toLowerCase(),
    }
  }

  const code = (query.get('code') || '').trim()
  if (code) {
    return {
      kind: 'pkce',
      code,
      type: (query.get('type') || fragment.get('type') || 'signup').trim().toLowerCase(),
    }
  }

  const confirmed = (query.get('confirmed') || '').trim().toLowerCase()
  if (confirmed === '1' || confirmed === 'true') {
    return { kind: 'confirmed_flag' }
  }

  return { kind: 'none' }
}

/**
 * Si un correo antiguo o generado desde el panel redirige a la raíz (/ o /en)
 * con parámetros de verificación de Supabase Auth, determina la ruta interna
 * adecuada (/confirm o /reset-password) para mostrar feedback claro al usuario.
 */
export function resolveRootAuthCallbackRedirect(
  pathname: string,
  search: string,
  hash: string
): string | null {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const isRootHome =
    normalizedPath === '/' || normalizedPath === '/es' || normalizedPath === '/en'
  if (!isRootHome) return null

  const parsed = parseConfirmationCallback(search, hash)
  if (parsed.kind === 'none' || parsed.kind === 'confirmed_flag') return null

  const localePrefix = normalizedPath === '/en' ? '/en' : ''
  const isRecovery =
    (parsed.kind === 'token_hash' && parsed.type === 'recovery') ||
    (parsed.kind === 'implicit' && parsed.type === 'recovery') ||
    (parsed.kind === 'pkce' && parsed.type === 'recovery')

  const baseTarget = isRecovery
    ? `${localePrefix}/reset-password`
    : `${localePrefix}/confirm`

  const cleanSearch = search ? (search.startsWith('?') ? search : `?${search}`) : ''
  const cleanHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : ''
  return `${baseTarget}${cleanSearch}${cleanHash}`
}
