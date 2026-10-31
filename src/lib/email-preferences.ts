import crypto from 'node:crypto'

/**
 * Tokens firmados para gestionar preferencias de correo desde el propio email
 * (enlaces de baja / reactivación) sin pedir sesión al usuario.
 *
 * Formato: `<userId>.<firma HMAC-SHA256>`
 */

function getSecret(): string {
  return (
    process.env.EMAIL_PREFERENCES_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  )
}

function sign(userId: string): string | null {
  const secret = getSecret()
  if (!secret) return null
  return crypto.createHmac('sha256', secret).update(`email-prefs:${userId}`).digest('base64url')
}

export function crearTokenPreferencias(userId: string): string | null {
  const firma = sign(userId)
  return firma ? `${userId}.${firma}` : null
}

export function verificarTokenPreferencias(token: string | null | undefined): string | null {
  if (!token) return null
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null

  const userId = token.slice(0, separator)
  const firma = token.slice(separator + 1)
  const esperada = sign(userId)
  if (!esperada) return null

  const recibidaBuffer = Buffer.from(firma)
  const esperadaBuffer = Buffer.from(esperada)
  if (recibidaBuffer.length !== esperadaBuffer.length) return null
  if (!crypto.timingSafeEqual(recibidaBuffer, esperadaBuffer)) return null

  return userId
}

export function urlPreferenciasEmail(userId: string): string {
  const base = (process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://venezuela-inmuebles.online').replace(/\/$/, '')
  const token = crearTokenPreferencias(userId)
  return token
    ? `${base}/api/email/baja?token=${encodeURIComponent(token)}`
    : `${base}/mi-perfil`
}
