'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { localizePath } from '@/lib/auth-redirect'

export default function MiPerfilRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es'

  useEffect(() => {
    if (loading) return
    const profilePath = '/dashboard?tab=perfil'
    if (user) {
      router.replace(localizePath(profilePath, locale))
    } else {
      router.replace(localizePath(`/login?redirect=${encodeURIComponent(profilePath)}`, locale))
    }
  }, [loading, locale, router, user])

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#f8f5ef] px-4" aria-busy="true">
      <p className="text-sm text-[#766d63]">{locale === 'en' ? 'Opening your account…' : 'Abriendo tu cuenta…'}</p>
    </div>
  )
}
