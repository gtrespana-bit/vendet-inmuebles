import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Patrón Singleton estricto para evitar múltiples instancias de GoTrueClient
let globalSupabase: ReturnType<typeof createClient> | null = null
let globalSupabaseAuth: ReturnType<typeof createClient> | null = null

// Cliente estándar con persistencia de sesión (para consultas de datos y mantener estado de autenticación)
export const getSupabaseClient = () => {
  if (!globalSupabase) {
    globalSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,  // Activar persistencia para mantener sesión entre recargas
        autoRefreshToken: true,  // Activar refresh automático para mantener sesión válida
        detectSessionInUrl: true,  // Habilitar detección de sesión en URL para casos de OAuth
        storageKey: 'sb-auth-token',
        flowType: 'pkce'
      }
    })
  }
  return globalSupabase
}

// Cliente de autenticación con refresh (solo para login/logout)
export const getSupabaseAuthClient = () => {
  if (!globalSupabaseAuth) {
    globalSupabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-auth-token',
        flowType: 'pkce'
      }
    })
  }
  return globalSupabaseAuth
}

// Exportación por defecto para compatibilidad con el código existente
// Usamos `as any` para evitar errores de tipos estrictos en RPCs no tipados
export const supabase = getSupabaseClient() as any

export const isSupabaseConfigured = () => {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}