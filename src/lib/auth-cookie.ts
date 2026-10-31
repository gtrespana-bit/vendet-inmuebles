/**
 * Lectura robusta de la cookie de sesión de Supabase (@supabase/ssr).
 *
 * Por qué existe esto: @supabase/ssr guarda la sesión en cookies que pueden
 * estar FRAGMENTADAS (chunks) cuando el JSON supera ~3180 caracteres:
 *   sb-auth-token            (sesión pequeña, cookie única)
 *   sb-auth-token.0, .1, ... (sesión grande, fragmento i en cookie "name.i")
 * Además el cliente del navegador usa storageKey 'sb-auth-token'
 * (src/lib/supabase.ts) mientras que las API routes usan la clave por defecto
 * "sb-<project-ref>-auth-token": pueden coexistir DOS cookies de sesión.
 *
 * Leer con `find(c => c.name.includes('auth-token'))` devuelve a veces un
 * fragmento `.0` (no es JSON) y el parseo falla → el usuario "no puede entrar"
 * aunque el login haya tenido éxito. Este módulo nunca falla: devuelve null.
 */

export interface CookieLike {
  name: string
  value: string
}

/** Claves de cookie de sesión posibles, en orden de preferencia. */
export function clavesCookieSesion(): string[] {
  const claves = ['sb-auth-token'] // storageKey del cliente navegador
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (url) {
    try {
      const ref = new URL(url).hostname.split('.')[0]
      if (ref) claves.push(`sb-${ref}-auth-token`) // clave por defecto de @supabase/ssr
    } catch {
      // URL inválida: ignorar
    }
  }
  return claves
}

/**
 * Devuelve el valor completo de la cookie de sesión (reensamblando chunks
 * `.0`, `.1`, ... si es necesario) o null si no hay cookie de sesión.
 */
export function leerCookieSesion(cookies: CookieLike[]): string | null {
  for (const clave of clavesCookieSesion()) {
    const directa = cookies.find((c) => c.name === clave)
    if (directa?.value) return directa.value
    const partes: string[] = []
    for (let i = 0; ; i++) {
      const chunk = cookies.find((c) => c.name === `${clave}.${i}`)
      if (!chunk?.value) break
      partes.push(chunk.value)
    }
    if (partes.length > 0) return partes.join('')
  }
  return null
}

/** Parsea el valor de la cookie de sesión a un objeto con access_token. */
export function parseSesionCookie(valor: string | null | undefined): { access_token?: string; [k: string]: any } | null {
  if (!valor) return null
  try {
    return JSON.parse(valor)
  } catch {
    // a veces el valor llega URL-encoded
  }
  try {
    return JSON.parse(decodeURIComponent(valor))
  } catch {
    return null
  }
}

/** Extrae y decodifica el payload del JWT (sin verificar la firma). */
export function payloadDesdeToken(token: string): Record<string, any> | null {
  try {
    const partes = token.split('.')
    if (partes.length !== 3) return null
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

/** true si el JWT no ha expirado (margen de 30 s). */
export function tokenNoExpirado(payload: Record<string, any> | null): boolean {
  if (!payload) return false
  const exp = typeof payload.exp === 'number' ? payload.exp : 0
  return exp > Math.floor(Date.now() / 1000) - 30
}
