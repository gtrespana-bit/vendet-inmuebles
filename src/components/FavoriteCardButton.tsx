'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { localizePath } from '@/lib/auth-redirect'
import { useUserFavoriteStatus } from '@/hooks/useUserFavorites'

interface FavoriteCardButtonProps {
  propertyId: string
  propertySlug?: string | null
  ownerId?: string | null
  locale?: string
  className?: string
}

export default function FavoriteCardButton({
  propertyId,
  propertySlug,
  ownerId,
  locale: propLocale,
  className = 'property-card__fav',
}: FavoriteCardButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = propLocale || (pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es')
  const isEnglish = locale === 'en'
  const { user, loading: authLoading } = useAuth()
  const { isSaved, updateSaved } = useUserFavoriteStatus(user?.id, propertyId)
  const [busy, setBusy] = useState(false)

  // El propietario no puede guardarse su propio anuncio
  if (user && ownerId && user.id === ownerId) {
    return null
  }

  const label = !user
    ? isEnglish
      ? 'Sign in to save to favorites'
      : 'Inicia sesión para guardar en favoritos'
    : isSaved
      ? isEnglish
        ? 'Remove from favorites'
        : 'Quitar de favoritos'
      : isEnglish
        ? 'Save to favorites'
        : 'Guardar en favoritos'

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (authLoading || busy) return

    if (!user) {
      const target = pathname || `/inmueble/${propertySlug || propertyId}`
      router.push(localizePath(`/login?redirect=${encodeURIComponent(target)}`, locale))
      return
    }

    const previous = isSaved
    const next = !previous
    setBusy(true)
    updateSaved(next)

    try {
      const res = await fetch('/api/favorito/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({ productId: propertyId, isFavorited: previous }),
      })
      if (!res.ok) {
        updateSaved(previous)
        return
      }
      const data = await res.json().catch(() => ({}))
      updateSaved(data.action ? data.action === 'added' : next)
    } catch {
      updateSaved(previous)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={isSaved}
      aria-label={label}
      title={label}
      className={`${className}${isSaved ? ' is-saved' : ''}`}
    >
      <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  )
}
