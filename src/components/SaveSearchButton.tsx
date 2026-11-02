'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bell, BellRing, Check, Loader2, Zap } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { localizePath } from '@/lib/auth-redirect'
import {
  buildSavedSearchQueryString,
  computeSavedSearchFingerprint,
  hasMeaningfulSavedSearchFilters,
  normalizeSavedSearchFilters,
  type SavedSearchFilters,
  type SavedSearchFrequency,
} from '@/lib/saved-searches'

interface SaveSearchButtonProps {
  presetFilters?: Partial<SavedSearchFilters>
  label?: string
}

function SaveSearchCore({
  rawInput,
  customLabel,
}: {
  rawInput: URLSearchParams | Record<string, unknown>
  customLabel?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const locale: 'es' | 'en' = isEn ? 'en' : 'es'

  const filters = useMemo(() => normalizeSavedSearchFilters(rawInput), [rawInput])
  const canSave = hasMeaningfulSavedSearchFilters(filters)
  const currentFingerprint = useMemo(
    () => (canSave ? computeSavedSearchFingerprint(filters) : ''),
    [canSave, filters],
  )

  const [savedId, setSavedId] = useState<string | null>(null)
  const [frequency, setFrequency] = useState<SavedSearchFrequency>('inmediata')
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
        if (found) {
          setSavedId(String(found.id))
          if (found.frecuencia === 'inmediata' || found.frecuencia === 'diaria') {
            setFrequency(found.frecuencia)
          }
        } else {
          setSavedId(null)
        }
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
      const qs = buildSavedSearchQueryString(filters)
      const returnUrl = pathname?.includes('/catalogo')
        ? qs
          ? `/catalogo?${qs}`
          : '/catalogo'
        : pathname || '/catalogo'
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
            frecuencia: frequency,
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
            frequency === 'inmediata'
              ? isEn
                ? 'Instant alert active! We will notify you as soon as a match goes live.'
                : '¡Alerta inmediata activa! Te avisaremos apenas se publique un inmueble compatible.'
              : isEn
                ? 'Daily digest active! We will email you new matches.'
                : '¡Resumen diario activo! Te enviaremos los nuevos inmuebles por correo.',
          )
        }
      }
    } catch {
      setFeedback(isEn ? 'Connection error' : 'Error de conexión')
    } finally {
      setSaving(false)
      setTimeout(() => setFeedback(null), 5000)
    }
  }

  async function handleFrequencySwitch(nextFreq: SavedSearchFrequency) {
    setFrequency(nextFreq)
    if (!savedId || saving) return
    try {
      const res = await fetch('/api/busquedas-guardadas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getSupabaseAuthHeaders()),
        },
        body: JSON.stringify({ id: savedId, frecuencia: nextFreq }),
      })
      if (res.ok) {
        setFeedback(
          nextFreq === 'inmediata'
            ? isEn
              ? 'Switched to instant alerts'
              : 'Cambiada a alerta inmediata'
            : isEn
              ? 'Switched to daily summary'
              : 'Cambiada a resumen diario',
        )
        setTimeout(() => setFeedback(null), 3500)
      }
    } catch {
      // silencioso
    }
  }

  return (
    <div className="inline-flex flex-col items-start sm:items-end gap-1.5">
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <div
          className="inline-flex items-center rounded-full border border-[#16294B]/15 bg-[#f7f4ee] p-0.5 text-[11px]"
          role="group"
          aria-label={isEn ? 'Alert frequency' : 'Frecuencia de alerta'}
        >
          <button
            type="button"
            onClick={() => handleFrequencySwitch('inmediata')}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition ${
              frequency === 'inmediata'
                ? 'bg-[#16294B] text-white'
                : 'text-[#475569] hover:text-[#16294B]'
            }`}
          >
            <Zap size={11} aria-hidden="true" />
            <span>{isEn ? 'Instant' : 'Inmediata'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleFrequencySwitch('diaria')}
            className={`rounded-full px-2.5 py-1 font-semibold transition ${
              frequency === 'diaria'
                ? 'bg-[#16294B] text-white'
                : 'text-[#475569] hover:text-[#16294B]'
            }`}
          >
            {isEn ? 'Daily' : 'Diaria'}
          </button>
        </div>

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
              : customLabel ||
                (isEn ? 'Save search & alerts' : 'Guardar búsqueda y alerta')}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {feedback && (
          <span role="status" className="text-[11px] font-medium text-[#526d56]">
            {feedback}
          </span>
        )}
        {savedId && (
          <LocalLink
            href="/dashboard?tab=favoritos"
            className="text-[11px] font-semibold text-[#8C6526] hover:underline"
          >
            {isEn ? 'Manage my alerts →' : 'Gestionar mis alertas →'}
          </LocalLink>
        )}
      </div>
    </div>
  )
}

function SaveSearchFromUrl({ label }: { label?: string }) {
  const searchParams = useSearchParams()
  const serialized = searchParams.toString()
  const paramsObj = useMemo(() => new URLSearchParams(serialized), [serialized])
  return <SaveSearchCore rawInput={paramsObj} customLabel={label} />
}

export default function SaveSearchButton({ presetFilters, label }: SaveSearchButtonProps = {}) {
  if (presetFilters) {
    return (
      <SaveSearchCore
        rawInput={presetFilters as Record<string, unknown>}
        customLabel={label}
      />
    )
  }

  return (
    <Suspense fallback={null}>
      <SaveSearchFromUrl label={label} />
    </Suspense>
  )
}
