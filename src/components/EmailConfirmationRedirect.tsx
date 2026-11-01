'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { resolveRootAuthCallbackRedirect } from '@/lib/auth-confirm'

const INITIAL_ROOT_SEARCH = typeof window !== 'undefined' ? window.location.search : ''
const INITIAL_ROOT_HASH = typeof window !== 'undefined' ? window.location.hash : ''

/**
 * Redirige a /confirm (o /reset-password) si el usuario aterriza en la portada
 * desde un enlace de correo cuyo redirect_to apuntaba a la raíz del sitio.
 */
export default function EmailConfirmationRedirect() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const search = window.location.search || INITIAL_ROOT_SEARCH
    const hash = window.location.hash || INITIAL_ROOT_HASH
    const target = resolveRootAuthCallbackRedirect(pathname, search, hash)
    if (target) {
      router.replace(target)
    }
  }, [pathname, router])

  return null
}
