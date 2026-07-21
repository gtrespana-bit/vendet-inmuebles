'use client'

import { useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'

function getLocaleFromPathname(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale
    }
  }
  return routing.defaultLocale
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

  // Build locale-aware redirect path
  const redirectPath = (path: string) => {
    if (locale === routing.defaultLocale) return path
    return `/${locale}${path === '/' ? '' : path}`
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // ✅ FIX: Use API route for login so server-side cookies are written.
      // This ensures the middleware and server components can read the auth session.
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos. Verifica tus datos.'
          : data.error)
        setLoading(false)
        return
      }

      // ✅ FIX: Sync the singleton client with the session from the API.
      // This fires onAuthStateChange → AuthProvider picks it up → session is set.
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        
        // Wait briefly to allow AuthProvider to process the session change
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Redirect with locale prefix
      router.push(redirectPath('/dashboard'))
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setLoading(false)
  }

  const handleResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResendLoading(true)
    setResendSuccess(false)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      setError(error.message === 'User not found'
        ? 'No existe una cuenta con este email'
        : error.message)
    } else {
      setResendSuccess(true)
    }
    setResendLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${redirectPath('/reset-password')}`,
    })

    if (error) {
      setResetError(error.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LocalLink href="/" className="text-brand-primary font-black text-3xl">
            Vende<span className="text-brand-accent">T</span><span className="text-sm ml-1 text-gray-500">-Venezuela</span>
          </LocalLink>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">{t('login.title')}</h1>
          <p className="text-gray-500 mt-1">{t('login.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent text-gray-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                required
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent text-gray-900 bg-white"
              />
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowReset(!showReset)}
                className="text-sm text-brand-primary hover:underline font-medium"
              >
                {t('login.forgot_password')}
              </button>
            </div>

            {showReset && !resetSent ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-fadeIn">
                <p className="text-sm text-yellow-800 mb-3 font-medium">{t('login.reset_title')}</p>
                {resetError && (
                  <p className="text-sm text-red-600 mb-3">{resetError}</p>
                )}
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white"
                  />
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-brand-primary text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50 text-sm"
                  >
                    {resetLoading ? t('login.sending') : t('login.reset_submit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    className="w-full text-sm text-gray-600 hover:text-gray-800"
                  >
                    {t('login.cancel')}
                  </button>
                </form>
              </div>
            ) : showReset && resetSent ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center animate-fadeIn">
                <p className="text-sm text-green-700 font-semibold mb-2">{t('login.link_sent')}</p>
                <p className="text-sm text-green-600">
                  {t('login.reset_sent')}
                </p>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setResetSent(false) }}
                  className="text-sm text-brand-primary font-semibold hover:underline mt-3"
                >
                  {t('login.reset_back')}
                </button>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50"
            >
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('login.no_account')}{' '}
            <LocalLink href="/register" className="text-brand-primary font-semibold hover:underline">
              {t('login.register')}
            </LocalLink>
          </p>

          {/* Botón para reenviar email de confirmación */}
          {!showResend ? (
            <p className="text-center text-sm text-gray-500 mt-3">
              {t('login.resend_prompt')}
              <button
                type="button"
                onClick={() => setShowResend(true)}
                className="text-brand-primary font-semibold hover:underline ml-1"
              >
                {t('login.resend')}
              </button>
            </p>
          ) : (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              {resendSuccess ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-green-700 font-semibold mb-2">
                    {t('login.resend_success')}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {t('login.resend_success_desc')}
                    <strong> {email}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowResend(false)}
                    className="text-brand-primary font-semibold hover:underline text-sm"
                  >
                    {t('login.reset_back')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResendConfirmation} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('login.email')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                      className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resendLoading}
                    className="w-full bg-brand-primary text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50 text-sm"
                  >
                    {resendLoading ? t('login.sending') : t('login.resend')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResend(false)}
                    className="w-full text-sm text-gray-600 hover:text-gray-800"
                  >
                    {t('login.cancel')}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
