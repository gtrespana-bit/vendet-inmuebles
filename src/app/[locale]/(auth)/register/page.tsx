'use client'

import { trackEvent } from '@/lib/analytics-client'
import { useEffect, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AlertCircle } from 'lucide-react'
import { ESTADOS, CIUDADES_POR_ESTADO } from '@/lib/ubicaciones'
import { useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'
import AuthShell from '@/components/AuthShell'
import { localizePath, safeInternalPath } from '@/lib/auth-redirect'

export default function RegisterPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : routing.defaultLocale
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [estado, setEstado] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ciudades = estado ? CIUDADES_POR_ESTADO[estado] || [] : []

  useEffect(() => {
    const redirect = safeInternalPath(new URLSearchParams(window.location.search).get('redirect'))
    if (redirect) localStorage.setItem('vi:after-auth-redirect', localizePath(redirect, locale))
    else localStorage.removeItem('vi:after-auth-redirect')
  }, [locale])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError(locale === 'en' ? 'Enter a valid email address.' : 'Ingresa un email válido.')
      return
    }
    if (!nombre.trim() || nombre.trim().length < 2) {
      setError(locale === 'en' ? 'Your name must contain at least 2 characters.' : 'El nombre debe tener al menos 2 caracteres.')
      return
    }
    if (password.length < 8) {
      setError(locale === 'en' ? 'Use at least 8 characters for your password.' : 'La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!/[A-Z]/.test(password)) {
      setError(locale === 'en' ? 'Add at least one uppercase letter.' : 'La contraseña debe tener al menos una mayúscula.')
      return
    }
    if (!/[0-9]/.test(password)) {
      setError(locale === 'en' ? 'Add at least one number.' : 'La contraseña debe tener al menos un número.')
      return
    }
    if (password !== repeatPassword) {
      setError(t('register.password_mismatch'))
      return
    }

    setLoading(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre, telefono, estado, ciudad },
        },
      })

      if (signUpError) {
        const message = signUpError.message.toLowerCase().includes('already registered')
          ? (locale === 'en' ? 'An account with this email already exists.' : 'Ya existe una cuenta con este email.')
          : signUpError.message
        setError(message)
        return
      }

      const redirect = safeInternalPath(new URLSearchParams(window.location.search).get('redirect'))
      if (redirect) localStorage.setItem('vi:after-auth-redirect', localizePath(redirect, locale))
      else localStorage.removeItem('vi:after-auth-redirect')

      trackEvent('registro', { ruta: window.location.pathname, meta: { estado, ciudad } })

      sessionStorage.setItem('tempEmail', email)
      const confirmPath = locale === routing.defaultLocale ? '/confirmacion' : `/${locale}/confirmacion`
      router.push(confirmPath)
    } catch {
      setError(locale === 'en' ? 'We could not connect. Please try again.' : 'No pudimos conectar. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell heading={t('register.title')} subheading={t('register.subtitle')}>
      {error && (
        <div role="alert" className="flex items-center gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-5 text-sm">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="register-name">{t('register.name')}</label>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={locale === 'en' ? 'Your name' : 'Tu nombre'}
            required
            className="w-full border rounded-lg px-4 py-3 bg-white"
          />
        </div>

        <div>
          <label htmlFor="register-email">{t('register.email')}</label>
          <input
            id="register-email"
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
          <label htmlFor="register-phone">{t('register.phone')}</label>
          <input
            id="register-phone"
            name="telephone"
            type="tel"
            autoComplete="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+58 412 1234567"
            className="w-full border rounded-lg px-4 py-3 bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="register-state">{t('register.state')}</label>
            <select
              id="register-state"
              name="state"
              autoComplete="address-level1"
              value={estado}
              onChange={(e) => { setEstado(e.target.value); setCiudad('') }}
              className="w-full border rounded-lg px-3 py-3 text-sm"
            >
              <option value="">{locale === 'en' ? 'Choose…' : 'Selecciona…'}</option>
              {ESTADOS.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="register-city">{t('register.city')}</label>
            <select
              id="register-city"
              name="city"
              autoComplete="address-level2"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              disabled={!estado}
              className="w-full border rounded-lg px-3 py-3 text-sm"
            >
              <option value="">{locale === 'en' ? 'Choose…' : 'Selecciona…'}</option>
              {ciudades.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="register-password">{t('register.password')}</label>
          <input
            id="register-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={locale === 'en' ? 'At least 8 characters' : 'Mínimo 8 caracteres'}
            required
            className="w-full border rounded-lg px-4 py-3 bg-white"
          />
          <p className="mt-2 text-xs leading-5 text-gray-500">{t('register.password_hint')}</p>
        </div>

        <div>
          <label htmlFor="register-repeat-password">{t('register.repeat_password')}</label>
          <input
            id="register-repeat-password"
            name="repeat-password"
            type="password"
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            placeholder={locale === 'en' ? 'Enter your password again' : 'Repite tu contraseña'}
            required
            className="w-full border rounded-lg px-4 py-3 bg-white"
          />
        </div>

        <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-bold transition disabled:opacity-50">
          {loading ? t('register.creating') : t('register.submit')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t('register.has_account')}{' '}
        <LocalLink href="/login" className="font-semibold hover:underline">{t('register.login')}</LocalLink>
      </p>
    </AuthShell>
  )
}
