import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase-not-configured.invalid'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'supabase-not-configured'

// A disabled transport lets public pages render in a fresh checkout without sending
// browser requests to localhost or a placeholder service. Real API calls still require
// the Supabase URL and anon key to be configured.
const unavailableFetch: typeof fetch = async () => {
  throw new Error('Supabase is not configured for this environment.')
}

const esNavegador = () => typeof window !== 'undefined' && typeof window.document !== 'undefined'

// ---------------------------------------------------------------------------
// Cliente del NAVEGADOR: basado en COOKIES (@supabase/ssr) con la clave por
// defecto `sb-<project-ref>-auth-token`: LA MISMA cookie que escriben las API
// routes (/api/login, /api/auth/logout) con createServerClient.
//
// Por qué: antes este módulo usaba supabase-js plano (localStorage), así que el
// auto-refresh del token actualizaba solo localStorage y la cookie que leen los
// guardias del servidor (/admin, /dashboard) se quedaba con el access token
// expirado → rebote a /login aunque el usuario estuviera logueado. Con una única
// cookie, el auto-refresh del navegador la mantiene fresca para ambos lados.
//
// En el SERVIDOR (sitemap, etc.) se usa un cliente plano sin persistencia: solo
// sirve para consultas de datos públicas; la sesión de servidor vive en
// src/lib/supabase-server.ts y en las cookies leídas con src/lib/auth-cookie.ts.
// ---------------------------------------------------------------------------
let cliente: any = null

function crearCliente() {
  if (cliente) return cliente
  if (esNavegador()) {
    // OJO (@supabase/ssr 0.0.10): si se pasa un objeto de opciones SIN la
    // propiedad `cookies`, su destructuring deja cookies = undefined y
    // storage.getItem() lanza "TypeError: reading 'get'" en TODA llamada de
    // auth del navegador (getSession/setSession) -> el login mostraba
    // "Error de conexión". Hay que pasar siempre cookies: {}.
    const opciones: Record<string, unknown> = { cookies: {} }
    if (!configured) opciones.global = { fetch: unavailableFetch }
    cliente = createBrowserClient(supabaseUrl, supabaseAnonKey, opciones as any)
  } else {
    cliente = createClient(supabaseUrl, supabaseAnonKey, {
      ...(configured ? {} : { global: { fetch: unavailableFetch } }),
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return cliente
}

// Cliente estándar con persistencia de sesión (para consultas de datos y mantener estado de autenticación)
export const getSupabaseClient = () => crearCliente()

// Cliente de autenticación con refresh (solo para login/logout): misma instancia (misma cookie)
export const getSupabaseAuthClient = () => crearCliente()

// Exportación por defecto para compatibilidad con el código existente
export const supabase = crearCliente() as any

export const isSupabaseConfigured = () => configured
