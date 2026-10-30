'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Share2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { localizePath } from '@/lib/auth-redirect'

interface PropertyDetailActionsProps {
  propertyId: string
  title: string
  locale: string
  labels: {
    save: string
    saved: string
    share: string
    copied: string
    error: string
    signIn: string
  }
}

export default function PropertyDetailActions({ propertyId, title, locale, labels }: PropertyDetailActionsProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!user || !isSupabaseConfigured()) {
      setIsSaved(false)
      return
    }

    supabase
      .from('favoritos')
      .select('producto_id')
      .eq('producto_id', propertyId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { producto_id: string } | null }) => {
        if (!cancelled) setIsSaved(Boolean(data))
      })
      .catch(() => undefined)

    return () => { cancelled = true }
  }, [propertyId, user])

  async function toggleFavorite() {
    if (authLoading || saving) return
    if (!user) {
      const returnPath = `/inmueble/${propertyId}`
      router.push(localizePath(`/login?redirect=${encodeURIComponent(returnPath)}`, locale))
      return
    }
    setSaving(true)
    setStatus('')
    try {
      const response = await fetch('/api/favorito/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({ productId: propertyId, isFavorited: isSaved }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || labels.error)
      setIsSaved(result.action === 'added' || !isSaved)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : labels.error)
    } finally {
      setSaving(false)
    }
  }

  async function shareProperty() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setStatus(labels.copied)
      window.setTimeout(() => setStatus(''), 2600)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setStatus(labels.error)
      window.setTimeout(() => setStatus(''), 2600)
    }
  }

  return (
    <div className="property-detail-actions">
      <button
        type="button"
        className={`property-detail-actions__button ${isSaved ? 'is-saved' : ''}`}
        onClick={toggleFavorite}
        disabled={saving || authLoading}
        aria-pressed={isSaved}
        aria-label={!user ? labels.signIn : isSaved ? labels.saved : labels.save}
        title={!user ? labels.signIn : isSaved ? labels.saved : labels.save}
      >
        <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
        <span>{saving ? '…' : isSaved ? labels.saved : labels.save}</span>
      </button>
      <button
        type="button"
        className="property-detail-actions__button"
        onClick={shareProperty}
        aria-label={labels.share}
      >
        <Share2 size={18} aria-hidden="true" />
        <span>{labels.share}</span>
      </button>
      {status && <span className="property-detail-actions__status" role="status">{status}</span>}
    </div>
  )
}
