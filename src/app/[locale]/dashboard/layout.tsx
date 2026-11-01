import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getVerifiedUserFromCookies } from '@/lib/supabase-server'
import { NOINDEX_ROBOTS } from '@/lib/seo-metadata'

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
}

/**
 * Guardia de servidor para TODAS las rutas /dashboard/*:
 * exige una sesión verificada en el servidor antes de renderizar el panel.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const loginPath = locale === 'en' ? '/en/login' : '/login'

  const user = await getVerifiedUserFromCookies()
  if (!user) {
    redirect(loginPath)
  }

  return <>{children}</>
}
