import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { leerCookieSesion, parseSesionCookie, payloadDesdeToken, tokenNoExpirado } from './auth-cookie'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Crea un cliente de Supabase para uso en servidor con la service role key.
 * Usa la service role key para tener permisos completos (bypass RLS si es necesario).
 */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * ✅ HYDRATION FIX: Parse JWT directly from cookies (NO network call).
 */
export async function getServerUser(): Promise<any | null> {
  try {
    const cookieStore = await cookies()
    const sesion = parseSesionCookie(leerCookieSesion(cookieStore.getAll()))

    const accessToken = sesion?.access_token
    if (!accessToken) return null

    const payload = payloadDesdeToken(accessToken)
    if (!payload?.sub) return null

    return {
      id: payload.sub,
      email: payload.email,
      user_metadata: payload.user_metadata || {},
      app_metadata: payload.app_metadata || {},
      aud: payload.aud || 'authenticated',
      role: payload.role || 'authenticated',
      created_at: payload.created_at || '',
    }
  } catch {
    return null
  }
}

/**
 * Verifica en el servidor el JWT de sesión guardado en cookies.
 *
 * 1. Lee la cookie de sesión de forma robusta (chunks `.0/.1` y las dos
 *    claves posibles: 'sb-auth-token' del navegador y 'sb-<ref>-auth-token'
 *    de las API routes).
 * 2. Intenta la verificación real contra Supabase (sb.auth.getUser) pero con
 *    un timeout de 4 s: si Supabase tarda o no responde, NO se bloquea la
 *    página — se usa el JWT parseado localmente si no ha expirado.
 * 3. Si Supabase rechaza el token (401/403) se devuelve null.
 *
 * Nota de seguridad: el parseo local no valida la firma, pero la autorización
 * real siempre ocurre en las API routes (cada llamada lleva el token a
 * Supabase y RLS aplica los permisos). Este guard solo decide si se renderiza
 * el panel; nunca expone datos por sí mismo.
 */
export async function getVerifiedUserFromCookies(): Promise<{ id: string; email?: string; [k: string]: any } | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const cookieStore = await cookies()
    const sesion = parseSesionCookie(leerCookieSesion(cookieStore.getAll()))
    const accessToken = sesion?.access_token
    if (!accessToken) return null

    const payload = payloadDesdeToken(accessToken)
    if (!payload?.sub) return null

    if (url && serviceKey) {
      try {
        const sb = createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const verificacion = await Promise.race([
          sb.auth.getUser(accessToken),
          new Promise<{ data: { user: any }; error: any }>((resolve) =>
            setTimeout(() => resolve({ data: { user: null }, error: { message: 'timeout verificación', status: 0 } }), 4000)
          ),
        ])
        if (!verificacion.error && verificacion.data.user) {
          return verificacion.data.user
        }
        const status = (verificacion.error as any)?.status
        // Supabase rechazó el token explícitamente → sesión inválida
        if (status === 401 || status === 403) return null
        // Si fue timeout/red, seguir con el fallback local
      } catch {
        // error de red al verificar: seguir con el fallback local
      }
    }

    // Fallback: token firmado por Supabase y no expirado (autorización real en las API)
    if (tokenNoExpirado(payload)) {
      return {
        id: payload.sub,
        email: payload.email,
        user_metadata: payload.user_metadata || {},
        app_metadata: payload.app_metadata || {},
        role: payload.role || 'authenticated',
      }
    }
    return null
  } catch {
    return null
  }
}
