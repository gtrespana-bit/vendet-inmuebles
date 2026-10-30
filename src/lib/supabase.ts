import { createClient } from '@supabase/supabase-js'

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase-not-configured.invalid'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'supabase-not-configured'

// A disabled transport lets public pages render in a fresh checkout without sending
// browser requests to localhost or a placeholder service. Real API calls still require
// the Supabase URL and anon key to be configured.
const unavailableFetch: typeof fetch = async () => {
  throw new Error('Supabase is not configured for this environment.')
}

const transport = configured ? undefined : { fetch: unavailableFetch }

// Patrón Singleton estricto para evitar múltiples instancias de GoTrueClient
let globalSupabase: ReturnType<typeof createClient> | null = null
let globalSupabaseAuth: ReturnType<typeof createClient> | null = null

// Cliente estándar con persistencia de sesión (para consultas de datos y mantener estado de autenticación)
export const getSupabaseClient = () => {
  if (!globalSupabase) {
    globalSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: transport,
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-auth-token',
        flowType: 'pkce',
      },
    })
  }
  return globalSupabase
}

// Cliente de autenticación con refresh (solo para login/logout)
export const getSupabaseAuthClient = () => {
  if (!globalSupabaseAuth) {
    globalSupabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: transport,
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-auth-token',
        flowType: 'pkce',
      },
    })
  }
  return globalSupabaseAuth
}

// Exportación por defecto para compatibilidad con el código existente
export const supabase = getSupabaseClient() as any

export const isSupabaseConfigured = () => configured
