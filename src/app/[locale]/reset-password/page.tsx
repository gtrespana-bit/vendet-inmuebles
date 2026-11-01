'use client'

import { useState, useEffect } from 'react'
import LocalLink from '@/components/LocalLink'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function ResetPasswordPage() {
  const t = useTranslations('resetPassword')
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmedPassword, setConfirmedPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const query = new URLSearchParams(window.location.search)
      const tokenHash = query.get('token_hash')
      const type = query.get('type')

      if (tokenHash && (!type || type === 'recovery')) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        })
        try {
          window.history.replaceState(window.history.state, '', window.location.pathname)
        } catch {
          // Ignorar
        }
        if (!verifyError) {
          setCheckingSession(false)
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, nextSession: unknown) => {
          if (nextSession) {
            subscription.unsubscribe()
            setCheckingSession(false)
          }
        })

        setTimeout(() => {
          setCheckingSession(false)
          subscription.unsubscribe()
        }, 5000)
      } else {
        setCheckingSession(false)
      }
    }

    void checkSession()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError(t('pwMinError'))
      return
    }

    if (password !== confirmedPassword) {
      setError(t('pwMismatchError'))
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    }

    setLoading(false)
  }

  if (checkingSession) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">{t('checking')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LocalLink href="/" className="text-brand-primary font-black text-2xl">
            Venezuela Inmuebles
          </LocalLink>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">
            {success ? t('titleSuccess') : t('title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {success
              ? 'Serás redirigido al login en unos segundos...'
              : 'Crea una nueva contraseña para tu cuenta'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-green-700 font-semibold text-lg">{t('successText')}</p>
              <LocalLink
                href="/login"
                className="inline-block mt-6 bg-brand-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-brand-dark transition"
              >
                Ir al login
              </LocalLink>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('newPw')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('newPwPlaceholder')}
                  required
                  minLength={8}
                  className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('repeatPw')}</label>
                <input
                  type="password"
                  value={confirmedPassword}
                  onChange={(e) => setConfirmedPassword(e.target.value)}
                  placeholder={t('repeatPwPlaceholder')}
                  required
                  minLength={8}
                  className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-accent text-gray-900 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50"
              >
                {loading ? t('saving') : t('submit')}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                <LocalLink href="/login" className="text-brand-primary font-semibold hover:underline">
                  Volver al login
                </LocalLink>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
