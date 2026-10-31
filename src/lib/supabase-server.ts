import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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
    const allCookies = cookieStore.getAll()

    const authCookie = allCookies.find(c =>
      c.name.includes('auth-token')
    )

    if (!authCookie?.value) return null

    let parsed: any
    try {
      parsed = JSON.parse(authCookie.value)
    } catch {
      try {
        parsed = JSON.parse(decodeURIComponent(authCookie.value))
      } catch {
        return null
      }
    }

    const accessToken = parsed?.access_token
    if (!accessToken) return null

    const parts = accessToken.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    )

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
 * Verifica en el servidor el JWT de sesión guardado en cookies llamando a
 * Supabase (verificación real, no solo parseo del payload).
 * Devuelve el usuario verificado o null. Úsalo en layouts/páginas privadas.
 */
export async function getVerifiedUserFromCookies(): Promise<{ id: string; email?: string; [k: string]: any } | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return null

    const cookieStore = await cookies()
    const authCookie = cookieStore.getAll().find((c) => c.name.includes('auth-token'))
    if (!authCookie?.value) return null

    let parsed: any = null
    try {
      parsed = JSON.parse(authCookie.value)
    } catch {
      try {
        parsed = JSON.parse(decodeURIComponent(authCookie.value))
      } catch {
        return null
      }
    }

    const accessToken = parsed?.access_token
    if (!accessToken) return null

    const sb = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await sb.auth.getUser(accessToken)
    if (error || !data.user) return null
    return data.user
  } catch {
    return null
  }
}
