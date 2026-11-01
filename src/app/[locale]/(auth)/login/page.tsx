'use client'

import { useEffect, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'
import AuthShell from '@/components/AuthShell'
import { localizePath, safeInternalPath } from '@/lib/auth-redirect'
import { buildEmailConfirmRedirectUrl } from '@/lib/auth-confirm'

function getLocaleFromPathname(pathname: string): string {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : routing.defaultLocale
}

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [returnPath, setReturnPath] = useState<string | null>(null)
  const [confirmedBanner, setConfirmedBanner] = useState(false)

  const redirectPath = (path: string) => localizePath(path, locale)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const redirect = safeInternalPath(params.get('redirect'))
    if (redirect) {
      const localized = localizePath(redirect, locale)
      setReturnPath(localized)
      localStorage.setItem('vi:after-auth-redirect', localized)
    }
    if (params.get('confirmed') === '1' || params.get('confirmed') === 'true') {
      setConfirmedBanner(true)
    }
  }, [locale])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Cada paso con su propio manejo de error para no enmascarar la causa real.
    let res: Response
    try {
      res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      setError(locale === 'en' ? 'Connection error. Please try again.' : 'Error de conexión. Intenta de nuevo.')
      setLoading(false)
      return
    }

    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      setError(data?.error === 'Invalid login credentials'
        ? (locale === 'en' ? 'The email or password is incorrect. Check your details and try again.' : 'Email o contraseña incorrectos. Verifica tus datos.')
        : (data?.error || (locale === 'en' ? `Server error (HTTP ${res.status}). Try again.` : `Error del servidor (HTTP ${res.status}). Intenta de nuevo.`)))
      setLoading(false)
      return
    }

    // setSession es best-effort: /api/login ya fijó la cookie de sesión en la
    // respuesta y el cliente del navegador (ssr) lee la sesión de esa cookie.
    // Si setSession falla no debe impedir el login.
    if (data?.session?.access_token && data?.session?.refresh_token) {
      try {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch {
        // continuar: la cookie del servidor ya está puesta
      }
    }

    try {
      const queryRedirect = safeInternalPath(new URLSearchParams(window.location.search).get('redirect'))
      const storedRedirect = safeInternalPath(localStorage.getItem('vi:after-auth-redirect'))
      const target = localizePath(queryRedirect || storedRedirect || '/dashboard', locale)
      localStorage.removeItem('vi:after-auth-redirect')
      router.push(target)
      router.refresh()
    } catch {
      setError(locale === 'en' ? 'Connection error. Please try again.' : 'Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResendLoading(true)
    setResendSuccess(false)

    try {
      const emailRedirectTo = buildEmailConfirmRedirectUrl(window.location.origin, locale)
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      })
      if (resendError) {
        setError(resendError.message === 'User not found'
          ? (locale === 'en' ? 'No account was found for this email.' : 'No existe una cuenta con este email.')
          : resendError.message)
      } else {
        setResendSuccess(true)
      }
    } catch {
      setError(locale === 'en' ? 'We could not resend the email. Try again.' : 'No pudimos reenviar el correo. Inténtalo de nuevo.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)

    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${redirectPath('/reset-password')}`,
      })
      if (requestError) setResetError(requestError.message)
      else setResetSent(true)
    } catch {
      setResetError(locale === 'en' ? 'We could not send the reset link. Try again.' : 'No pudimos enviar el enlace. Inténtalo de nuevo.')
    } finally {
      setResetLoading(false)
    }
  }

  const registerHref = returnPath
    ? `/register?redirect=${encodeURIComponent(returnPath)}`
    : '/register'

  return (
    <AuthShell heading={t('login.title')} subheading={t('login.subtitle')}>
      {confirmedBanner && (
        <div role="status" aria-live="polite" className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 mb-5 text-sm text-emerald-900">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="font-bold">{t('login.confirmed_banner_title')}</p>
            <p className="mt-0.5 text-xs text-emerald-800">{t('login.confirmed_banner_desc')}</p>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-5 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="login-email">{t('login.email')}</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            className="w-full border rounded-lg px-4 py-3 bg-white"
          />
        </div>

        <div>
          <label htmlFor="login-password">{t('login.password')}</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={locale === 'en' ? 'Your password' : 'Tu contraseña'}
            required
            className="w-full border rounded-lg px-4 py-3 bg-white"
          />
        </div>

        <div className="text-right">
          <button type="button" onClick={() => { setShowReset((open) => !open); setResetError('') }} className="text-sm font-semibold hover:underline">
            {t('login.forgot_password')}
          </button>
        </div>

        <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-bold transition disabled:opacity-50">
          {loading ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      {showReset && (
        <section className="auth-inline-panel" aria-live="polite">
          {!resetSent ? (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <p className="text-sm font-semibold">{t('login.reset_title')}</p>
              <div>
                <label htmlFor="reset-email">{t('login.email')}</label>
                <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required className="w-full border rounded-lg px-3 py-2.5 bg-white" />
              </div>
              {resetError && <p role="alert" className="text-sm text-red-700">{resetError}</p>}
              <button type="submit" disabled={resetLoading} className="w-full py-2.5 rounded-lg font-semibold disabled:opacity-50">
                {resetLoading ? t('login.sending') : t('login.reset_submit')}
              </button>
              <button type="button" onClick={() => setShowReset(false)} className="auth-inline-panel__cancel">{t('login.cancel')}</button>
            </form>
          ) : (
            <div className="text-center">
              <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-700" aria-hidden="true" />
              <p className="text-sm font-semibold">{t('login.link_sent')}</p>
              <p className="mt-1 text-xs text-gray-600">{t('login.reset_sent')}</p>
              <button type="button" onClick={() => { setShowReset(false); setResetSent(false) }} className="auth-inline-panel__cancel">{t('login.reset_back')}</button>
            </div>
          )}
        </section>
      )}

      <p className="text-center text-sm text-gray-500 mt-5">
        {t('login.no_account')}{' '}
        <LocalLink href={registerHref} className="font-semibold hover:underline">{t('login.register')}</LocalLink>
      </p>

      {!showResend ? (
        <p className="text-center text-xs text-gray-500 mt-3">
          {t('login.resend_prompt')}{' '}
          <button type="button" onClick={() => setShowResend(true)} className="font-semibold hover:underline">{t('login.resend')}</button>
        </p>
      ) : (
        <section className="auth-inline-panel" aria-live="polite">
          {resendSuccess ? (
            <div className="text-center">
              <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-700" aria-hidden="true" />
              <p className="text-sm font-semibold">{t('login.resend_success')}</p>
              <p className="mt-1 text-xs text-gray-600">{t('login.resend_success_desc')} <strong>{email}</strong></p>
              <button type="button" onClick={() => setShowResend(false)} className="auth-inline-panel__cancel">{t('login.reset_back')}</button>
            </div>
          ) : (
            <form onSubmit={handleResendConfirmation} className="space-y-3">
              <div>
                <label htmlFor="resend-email">{t('login.email')}</label>
                <input id="resend-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required className="w-full border rounded-lg px-3 py-2.5 bg-white" />
              </div>
              <button type="submit" disabled={resendLoading} className="w-full py-2.5 rounded-lg font-semibold disabled:opacity-50">
                {resendLoading ? t('login.sending') : t('login.resend')}
              </button>
              <button type="button" onClick={() => setShowResend(false)} className="auth-inline-panel__cancel">{t('login.cancel')}</button>
            </form>
          )}
        </section>
      )}
    </AuthShell>
  )
}
