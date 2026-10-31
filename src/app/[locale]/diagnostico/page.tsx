'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import LocalLink from '@/components/LocalLink'
import {
  Loader2, RefreshCw, Camera, Sparkles, CheckCircle2, XCircle, ExternalLink,
} from 'lucide-react'

type R2Report = {
  ok?: boolean
  configured?: boolean
  endpoint?: boolean
  accessKey?: boolean
  secretKey?: boolean
  bucket?: string | null
  publicUrl?: string | null
  writeTest?: string
  probeUrl?: string
  error?: string
}

const AI_SAMPLE = {
  descripcion:
    'Casa amplia en urbanización con 3 habitaciones, 2 baños, sala-comedor, cocina integral, patio trasero y estacionamiento para 2 vehículos. Muy buena ubicación cerca del colegio y del centro comercial. Excelente iluminación natural y área verde.',
  tipo: 'casa',
  operacion: 'venta',
  ubicacion: 'Caracas, Miranda',
}

export default function DiagnosticoPage({ params }: { params: { locale: string } }) {
  const { locale } = params
  const t = useTranslations('diagnostico')
  const { user, loading } = useAuth()

  const [r2, setR2] = useState<R2Report | null>(null)
  const [r2Status, setR2Status] = useState<number | null>(null)
  const [ai, setAi] = useState<{ ok: boolean; words?: number; error?: string } | null>(null)
  const [testing, setTesting] = useState<{ r2: boolean; ai: boolean }>({ r2: false, ai: false })

  const probarFotos = useCallback(async () => {
    setTesting((s) => ({ ...s, r2: true }))
    setR2(null)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/r2-upload', { headers })
      setR2Status(res.status)
      const data = await res.json().catch(() => ({}))
      setR2(data)
    } catch (err: any) {
      setR2Status(null)
      setR2({ error: err?.message || 'Error de red' })
    } finally {
      setTesting((s) => ({ ...s, r2: false }))
    }
  }, [])

  const probarIA = useCallback(async () => {
    setTesting((s) => ({ ...s, ai: true }))
    setAi(null)
    try {
      const headers = await getSupabaseAuthHeaders()
      const res = await fetch('/api/ai/mejorar-descripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(AI_SAMPLE),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAi({ ok: false, error: `${res.status}: ${data.error || 'sin detalle'}` })
        return
      }
      const words = String(data.descripcion || '').trim().split(/\s+/).filter(Boolean).length
      setAi({ ok: true, words })
    } catch (err: any) {
      setAi({ ok: false, error: err?.message || 'Error de red' })
    } finally {
      setTesting((s) => ({ ...s, ai: false }))
    }
  }, [])

  // Al entrar (con sesión) se ejecutan ambas pruebas solas
  useEffect(() => {
    if (user) {
      probarFotos()
      probarIA()
    }
  }, [user, probarFotos, probarIA])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t('title')}</h1>
        <p className="text-gray-600 mb-6">{t('loginRequired')}</p>
        <LocalLink
          href={`/${locale}/iniciar-sesion`}
          className="inline-block bg-brand-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-primary/90"
        >
          {t('loginLink')}
        </LocalLink>
      </div>
    )
  }

  const envRow = (label: string, ok?: boolean) => (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <code className="text-xs text-gray-600">{label}</code>
      <span className={`text-xs font-bold ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
        {ok ? '✓' : '✗'}
      </span>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('subtitle')}</p>

      <div className="space-y-6">
        {/* ============ FOTOS / R2 ============ */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Camera size={20} className="text-brand-primary" />
              <h2 className="text-lg font-semibold text-gray-900">{t('photosTitle')}</h2>
            </div>
            <button
              type="button"
              onClick={probarFotos}
              disabled={testing.r2}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {testing.r2 ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t('reRun')}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 mb-4">{t('photosDesc')}</p>

          {testing.r2 && <p className="text-sm text-gray-500">{t('running')}</p>}

          {!testing.r2 && r2 && (
            <div className="space-y-3">
              {r2.ok ? (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <CheckCircle2 size={16} /> {t('photosOk')}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <XCircle size={16} /> {r2.error || t('photosFail')}
                  {r2Status !== null && <span className="text-xs opacity-70">(HTTP {r2Status})</span>}
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-gray-700 uppercase mb-1">{t('envVars')}</p>
                {envRow('R2_ENDPOINT', r2.endpoint)}
                {envRow('R2_ACCESS_KEY_ID', r2.accessKey)}
                {envRow('R2_SECRET_ACCESS_KEY', r2.secretKey)}
                {envRow('R2_BUCKET', Boolean(r2.bucket))}
                {envRow('R2_PUBLIC_URL', Boolean(r2.publicUrl))}
              </div>

              {r2.writeTest && (
                <div className="text-sm">
                  <span className="font-semibold text-gray-700">{t('writeTestLabel')}: </span>
                  <code className={`text-xs ${r2.writeTest === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {r2.writeTest}
                  </code>
                </div>
              )}
              {r2.probeUrl && (
                <a
                  href={r2.probeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                >
                  {t('probeUrlLabel')} <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </section>

        {/* ============ IA / GEMINI ============ */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-brand-accent" />
              <h2 className="text-lg font-semibold text-gray-900">{t('aiTitle')}</h2>
            </div>
            <button
              type="button"
              onClick={probarIA}
              disabled={testing.ai}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {testing.ai ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t('reRun')}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 mb-4">{t('aiDesc')}</p>

          {testing.ai && <p className="text-sm text-gray-500">{t('running')}</p>}

          {!testing.ai && ai && (
            <div className="space-y-2">
              {ai.ok ? (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <CheckCircle2 size={16} /> {t('aiOk', { words: ai.words ?? 0 })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium">
                  <XCircle size={16} /> {t('aiFail')} {ai.error}
                </div>
              )}
            </div>
          )}
        </section>

        <p className="text-xs text-gray-500">{t('hint')}</p>
      </div>
    </div>
  )
}
