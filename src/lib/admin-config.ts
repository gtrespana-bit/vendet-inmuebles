// Shared admin configuration.
//
// IMPORTANTE: mantener esta lista sincronizada con la función SQL
// `public.is_admin()` en Supabase (ver supabase/migrations/004_admin_acceso_y_metricas.sql).
// El cliente, las API routes y las políticas RLS deben coincidir.
export const ADMIN_EMAILS = ['gtrespana@gmail.com', 'jdmimportesp@gmail.com']

/** Comprueba si un email pertenece a un administrador (normaliza mayúsculas). */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
