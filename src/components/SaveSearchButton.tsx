'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bell, BellRing, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { localizePath } from '@/lib/auth-redirect'
import {
  computeSavedSearchFingerprint,
  hasMeaningfulSavedSearchFilters,
  normalizeSavedSearchFilters,
} from '@/lib/saved-searches'

export default function SaveSearchButton() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const locale: 'es' | 'en' = isEn ? 'en' : 'es'

  const filters = useMemo(
    () => normalizeSavedSearchFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )
  const canSave = hasMeaningfulSavedSearchFilters(filters)
  const currentFingerprint = useMemo(
    () => (canSave ? computeSavedSearchFingerprint(filters) : ''),
    [canSave, filters],
  )

  const [savedId, setSavedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!user || !canSave || !currentFingerprint) {
      setSavedId(null)
      return
    }

    ;(async () => {
      try {
        const res = await fetch('/api/busquedas-guardadas', {
          headers: await getSupabaseAuthHeaders(),
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const found = (data.items || []).find(
          (row: any) => row.huella_filtros === currentFingerprint && row.alerta_email !== false,
        )
        setSavedId(found ? String(found.id) : null)
      } catch {
        // silencioso
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, canSave, currentFingerprint])

  if (!canSave) return null

  async function handleToggleSave() {
    if (authLoading || saving) return
    if (!user) {
      const qs = searchParams.toString()
      const returnUrl = qs ? `/catalogo?${qs}` : '/catalogo'
      router.push(localizePath(`/login?redirect=${encodeURIComponent(returnUrl)}`, locale))
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(await getSupabaseAuthHeaders()),
      }

      if (savedId) {
        const res = await fetch(`/api/busquedas-guardadas?id=${encodeURIComponent(savedId)}`, {
          method: 'DELETE',
          headers,
        })
        if (res.ok) {
          setSavedId(null)
          setFeedback(isEn ? 'Alert removed' : 'Alerta desactivada')
        }
      } else {
        const res = await fetch('/api/busquedas-guardadas', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filtros: filters,
            frecuencia: 'diaria',
            alertaEmail: true,
            locale,
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          setFeedback(json.error || (isEn ? 'Could not save search' : 'No se pudo guardar'))
        } else {
          setSavedId(String(json.item?.id || 'saved'))
          setFeedback(
            isEn
              ? 'Alert active! We will email you new matches.'
              : '¡Alerta activa! Te avisaremos por correo cuando entren nuevos inmuebles.',
          )
        }
      }
    } catch {
      setFeedback(isEn ? 'Connection error' : 'Error de conexión')
    } finally {
      setSaving(false)
      setTimeout(() => setFeedback(null), 4000)
    }
  }

  return (
    <div className="inline-flex flex-col items-start sm:items-end gap-1">
      <button
        type="button"
        onClick={handleToggleSave}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold border transition ${
          savedId
            ? 'bg-[#16294B] text-white border-[#16294B]'
            : 'bg-white text-[#16294B] border-[#16294B]/20 hover:border-[#16294B] hover:bg-[#F7F4EE]'
        }`}
      >
        {saving ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : savedId ? (
          <>
            <BellRing size={14} aria-hidden="true" />
            <Check size={13} aria-hidden="true" />
          </>
        ) : (
          <Bell size={14} aria-hidden="true" />
        )}
        <span>
          {savedId
            ? isEn
              ? 'Alert active'
              : 'Alerta activa'
            : isEn
              ? 'Save search & alerts'
              : 'Guardar búsqueda y alerta'}
        </span>
      </button>
      {feedback && (
        <span role="status" className="text-[11px] font-medium text-[#526d56]">
          {feedback}
        </span>
      )}
    </div>
  )
}
