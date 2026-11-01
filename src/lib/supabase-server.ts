import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { verifySession } from './verify-session'
import { leerCookieSesion, parseSesionCookie } from './auth-cookie'

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
    },
    global: {
      // Next.js 14 cachea los fetch de los Server Components en el Data Cache.
      // Los datos de los anuncios (ambientes, fotos, contacto, visitas…) deben
      // leerse siempre frescos; sin esto una edición puede tardar en verse.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

/** Verified once per server render; never derive identity or roles from unsigned payloads. */
export const getVerifiedUserFromCookies = cache(async () => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    const cookieStore = await cookies()
    const token = parseSesionCookie(leerCookieSesion(cookieStore.getAll()))?.access_token
    return await verifySession(token, (accessToken, signal) => {
      const sb = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal, cache: 'no-store' }) },
      })
      return sb.auth.getUser(accessToken)
    })
  } catch {
    return null
  }
})

// Hydration must use the same verified identity as protected layouts.
export const getServerUser = getVerifiedUserFromCookies
