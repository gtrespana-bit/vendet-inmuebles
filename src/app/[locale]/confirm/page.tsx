'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, ArrowRight, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import AuthShell from '@/components/AuthShell'
import { supabase } from '@/lib/supabase'
import { routing } from '@/i18n/routing'
import { localizePath, safeInternalPath } from '@/lib/auth-redirect'
import { parseConfirmationCallback, type ConfirmOtpType } from '@/lib/auth-confirm'

// Captura inicial a nivel de módulo en navegador por si GoTrueClient limpia ?code= antes del useEffect
const INITIAL_BROWSER_SEARCH = typeof window !== 'undefined' ? window.location.search : ''
const INITIAL_BROWSER_HASH = typeof window !== 'undefined' ? window.location.hash : ''

// Evita doble consumo del mismo token_hash en React 18 Strict Mode
const inflightTokenVerifications = new Map<string, Promise<any>>()

function verifyTokenHashOnce(tokenHash: string, type: ConfirmOtpType) {
  const key = `${type}:${tokenHash}`
  const existing = inflightTokenVerifications.get(key)
  if (existing) return existing
  const promise = supabase.auth.verifyOtp({ token_hash: tokenHash, type }).finally(() => {
    setTimeout(() => inflightTokenVerifications.delete(key), 15_000)
  })
  inflightTokenVerifications.set(key, promise)
  return promise
}

export default function ConfirmEmailPage() {
  const t = useTranslations('confirmEmail')
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : routing.defaultLocale

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [hasSession, setHasSession] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [nextAfterAuth, setNextAfterAuth] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const storedRedirect = safeInternalPath(localStorage.getItem('vi:after-auth-redirect'))
    if (storedRedirect) {
      setNextAfterAuth(localizePath(storedRedirect, locale))
    }

    const currentSearch = window.location.search || INITIAL_BROWSER_SEARCH
    const currentHash = window.location.hash || INITIAL_BROWSER_HASH
    const parsed = parseConfirmationCallback(currentSearch, currentHash)

    const markConfirmedUrl = () => {
      try {
        const cleanPath = window.location.pathname
        window.history.replaceState(window.history.state, '', `${cleanPath}?confirmed=1`)
      } catch {
        // Ignorar en entornos restringidos
      }
      try {
        sessionStorage.removeItem('tempEmail')
        sessionStorage.removeItem('vi:signup-summary')
      } catch {
        // Ignorar si sessionStorage no está disponible
      }
    }

    async function runVerification() {
      try {
        if (parsed.kind === 'error') {
          const { data } = await supabase.auth.getSession()
          if (cancelled) return
          if (data?.session?.user?.email_confirmed_at) {
            setHasSession(true)
            setStatus('success')
            markConfirmedUrl()
            return
          }
          setErrorMsg(parsed.isExpiredOrUsed ? t('expiredDesc') : parsed.errorDescription || t('confirmError'))
          setStatus('error')
          return
        }

        if (parsed.kind === 'token_hash') {
          const { data, error } = await verifyTokenHashOnce(parsed.tokenHash, parsed.type)
          if (cancelled) return

          if (!error) {
            if (parsed.type === 'recovery') {
              router.replace(localizePath('/reset-password', locale))
              return
            }
            setHasSession(Boolean(data?.session))
            setStatus('success')
            markConfirmedUrl()
            return
          }

          // Si falló (p. ej. enlace abierto dos veces), comprobar si ya existe sesión confirmada
          const { data: sessionData } = await supabase.auth.getSession()
          if (cancelled) return
          if (sessionData?.session?.user?.email_confirmed_at) {
            setHasSession(true)
            setStatus('success')
            markConfirmedUrl()
            return
          }

          setErrorMsg(t('expiredDesc'))
          setStatus('error')
          return
        }

        if (parsed.kind === 'implicit') {
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          })
          if (cancelled) return

          if (parsed.type === 'recovery') {
            router.replace(localizePath('/reset-password', locale))
            return
          }

          if (!error && data?.session) {
            setHasSession(true)
            setStatus('success')
            markConfirmedUrl()
            return
          }

          // Incluso si setSession fallara, el correo ya fue verificado en /auth/v1/verify
          setHasSession(false)
          setStatus('success')
          markConfirmedUrl()
          return
        }

        if (parsed.kind === 'pkce') {
          // GoTrueClient (_initialize) intercambia ?code= automáticamente cuando existe code_verifier en este navegador.
          const { data } = await supabase.auth.getSession()
          if (cancelled) return

          if (parsed.type === 'recovery') {
            router.replace(localizePath('/reset-password', locale))
            return
          }

          // Si no hay sesión (por ejemplo, el usuario se registró en PC y abrió el correo en su móvil),
          // el endpoint /auth/v1/verify de Supabase YA confirmó email_confirmed_at antes de redirigir con ?code=.
          setHasSession(Boolean(data?.session?.user))
          setStatus('success')
          markConfirmedUrl()
          return
        }

        if (parsed.kind === 'confirmed_flag') {
          const { data } = await supabase.auth.getSession()
          if (cancelled) return
          setHasSession(Boolean(data?.session?.user))
          setStatus('success')
          return
        }

        // Sin parámetros explícitos: comprobar si la sesión ya quedó activa y confirmada
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (data?.session?.user?.email_confirmed_at) {
          setHasSession(true)
          setStatus('success')
          markConfirmedUrl()
        } else {
          setErrorMsg(t('noToken'))
          setStatus('error')
        }
      } catch {
        if (!cancelled) {
          setErrorMsg(t('confirmError'))
          setStatus('error')
        }
      }
    }

    void runVerification()

    return () => {
      cancelled = true
    }
  }, [locale, router, t])

  const handleContinueDashboard = () => {
    if (nextAfterAuth) {
      localStorage.removeItem('vi:after-auth-redirect')
      router.push(nextAfterAuth)
      router.refresh()
      return
    }
    router.push(localizePath('/dashboard?confirmed=1', locale))
    router.refresh()
  }

  return (
    <AuthShell heading={t('heading')} subheading={t('subheading')}>
      {status === 'loading' && (
        <div className="py-6 text-center" role="status" aria-live="polite">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f1e9]">
            <Loader2 className="animate-spin text-[#16294B]" size={34} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-[#16294B]">{t('loading')}</h2>
          <p className="mt-2 text-sm text-slate-600">{t('loadingDesc')}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="py-2 text-center" role="status" aria-live="polite">
          <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <Sparkles size={13} aria-hidden="true" />
            {t('badgeVerified')}
          </div>

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="text-emerald-700" size={38} aria-hidden="true" />
          </div>

          <h2 className="text-2xl font-bold text-[#16294B]">{t('success')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {hasSession ? t('successDescSession') : t('successDescLogin')}
          </p>

          <div className="mt-7 space-y-3">
            {hasSession ? (
              <>
                <button
                  type="button"
                  onClick={handleContinueDashboard}
                  className="reg-btn reg-btn--primary w-full justify-center py-3.5 text-base"
                >
                  {t('goDashboard')}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
                <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-sm">
                  <LocalLink href="/publicar-inmueble" className="font-semibold text-[#16294B] hover:underline">
                    {t('publishNow')}
                  </LocalLink>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <LocalLink href="/catalogo" className="font-medium text-slate-600 hover:underline">
                    {t('exploreCatalog')}
                  </LocalLink>
                </div>
              </>
            ) : (
              <>
                <LocalLink
                  href="/login?confirmed=1"
                  className="reg-btn reg-btn--primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
                >
                  {t('goLogin')}
                  <ArrowRight size={17} aria-hidden="true" />
                </LocalLink>
                <div className="pt-1 text-sm">
                  <LocalLink href="/catalogo" className="font-medium text-slate-600 hover:underline">
                    {t('exploreCatalog')}
                  </LocalLink>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="py-2 text-center" role="alert">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <XCircle className="text-red-600" size={38} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-[#16294B]">{t('error')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {errorMsg || t('errorDefault')}
          </p>
          <div className="mt-7 space-y-3">
            <LocalLink
              href="/login"
              className="reg-btn reg-btn--primary flex w-full items-center justify-center gap-2 py-3.5 text-base"
            >
              {t('resendLogin')}
              <ArrowRight size={17} aria-hidden="true" />
            </LocalLink>
          </div>
        </div>
      )}
    </AuthShell>
  )
}
