import { redirect } from 'next/navigation'
import { getVerifiedUserFromCookies } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin-config'

/**
 * Guardia de servidor para TODAS las rutas /admin/*.
 * Verifica la sesión contra Supabase (no solo el cliente) y exige email admin.
 * La aplicación real de permisos ocurre también en cada API route (requireAdmin).
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const loginPath = locale === 'en' ? '/en/login' : '/login'

  const user = await getVerifiedUserFromCookies()
  if (!user || !isAdminEmail(user.email)) {
    redirect(loginPath)
  }

  return <>{children}</>
}
