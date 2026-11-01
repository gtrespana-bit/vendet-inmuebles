import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getVerifiedUserFromCookies } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin-config'
import { NOINDEX_ROBOTS } from '@/lib/seo-metadata'

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
}

/**
 * Guardia de servidor para TODAS las rutas /admin/*.
 * Verifica la sesión contra Supabase (no solo el cliente) y exige email o rol admin.
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
  const isAdmin = Boolean(user && (isAdminEmail(user.email) || user.app_metadata?.role === 'admin'))
  if (!isAdmin) {
    redirect(loginPath)
  }

  return <>{children}</>
}
