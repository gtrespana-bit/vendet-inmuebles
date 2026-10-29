import { supabase } from '@/lib/supabase'

/** Returns a bearer header for authenticated server-side API routes. */
export async function getSupabaseAuthHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    throw new Error('Tu sesión ha caducado. Inicia sesión de nuevo.')
  }

  return { Authorization: `Bearer ${data.session.access_token}` }
}
