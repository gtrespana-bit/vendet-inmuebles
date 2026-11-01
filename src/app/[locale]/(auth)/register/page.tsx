'use client'

import { useEffect, useMemo, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Check, Clock, Loader2, Star, User, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { routing } from '@/i18n/routing'
import AuthShell from '@/components/AuthShell'
import { localizePath, safeInternalPath } from '@/lib/auth-redirect'
import { trackEvent } from '@/lib/analytics-client'
import { ESTADOS, CIUDADES_POR_ESTADO } from '@/lib/ubicaciones'
import {
  ACCOUNT_TYPES,
  PLAN_LIMITS,
  TRIAL_DAYS,
  accountTypeForPlan,
  formatListingLimit,
  isPlanName,
  isUnlimited,
  planForAccountType,
  type AccountType,
  type PlanName,
} from '@/lib/plan-catalog'
import {
  EMPTY_DRAFT,
  applyAccountType,
  buildSignupMetadata,
  displayName,
  offersLicense,
  requiresCompany,
  usesSurname,
  validateDetailsStep,
  type RegistrationDraft,
  type RegistrationErrorKey,
} from '@/lib/registration'

type Step = 1 | 2 | 3

const TYPE_ICONS = { particular: User, profesional: Star, agencia: Building2 } as const

function formatDate(value: Date, locale: string) {
  return value.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function RegisterPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : routing.defaultLocale

  const [step, setStep] = useState<Step>(1)
  const [tipo, setTipo] = useState<AccountType | null>(null)
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_DRAFT)
  const [errorKey, setErrorKey] = useState<RegistrationErrorKey | 'accountExists' | 'connection' | 'generic' | null>(null)
  const [loading, setLoading] = useState(false)

  const ciudades = draft.estado ? CIUDADES_POR_ESTADO[draft.estado] || [] : []
  const planLimits = PLAN_LIMITS[draft.plan]
  const trialEnd = useMemo(() => formatDate(new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000), locale), [locale])

  const patch = (values: Partial<RegistrationDraft>) => setDraft((current) => ({ ...current, ...values }))

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const redirect = safeInternalPath(params.get('redirect'))
    if (redirect) localStorage.setItem('vi:after-auth-redirect', localizePath(redirect, locale))
    else localStorage.removeItem('vi:after-auth-redirect')

    // La página de planes puede enviar aquí el plan elegido, y así se deduce el tipo de cuenta.
    const requested = params.get('plan')
    const isInvite = params.get('invitacion') === '1'
    const invitedEmail = params.get('email')?.trim() || ''

    if (isInvite) {
      setTipo('particular')
      setDraft((current) => ({
        ...applyAccountType({ ...current, plan: 'gratuita' }, 'particular'),
        ...(invitedEmail ? { email: invitedEmail } : {}),
      }))
      setStep(3)
    } else if (isPlanName(requested)) {
      const tipoSugerido = accountTypeForPlan(requested)
      setTipo(tipoSugerido)
      // Se sincroniza también el tipo de cuenta para que el paso de datos pida
      // los campos correctos (una agencia no pide apellidos).
      setDraft((current) => applyAccountType({ ...current, plan: requested }, tipoSugerido))
    }
  }, [locale])

  const selectType = (value: AccountType) => {
    setErrorKey(null)
    setTipo(value)
    setDraft((current) => applyAccountType({ ...current, tipoCuenta: value }, value))
  }

  const goToPlan = () => {
    if (!tipo) {
      setErrorKey('type')
      return
    }
    setErrorKey(null)
    setStep(2)
  }

  const goToDetails = () => {
    setErrorKey(null)
    setStep(3)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!tipo) {
      setErrorKey('type')
      setStep(1)
      return
    }

    const invalid = validateDetailsStep({ ...draft, tipoCuenta: tipo })
    if (invalid) {
      setErrorKey(invalid)
      return
    }

    setErrorKey(null)
    setLoading(true)
    try {
      const metadata = buildSignupMetadata({ ...draft, tipoCuenta: tipo })
      const { error: signUpError } = await supabase.auth.signUp({
        email: draft.email.trim(),
        password: draft.password,
        options: { data: metadata },
      })

      if (signUpError) {
        console.error('Error de registro:', signUpError.message)
        setErrorKey(signUpError.message.toLowerCase().includes('already registered') ? 'accountExists' : 'generic')
        return
      }

      trackEvent('registro', {
        ruta: window.location.pathname,
        meta: { tipo_cuenta: tipo, plan: draft.plan, estado: draft.estado, ciudad: draft.ciudad },
      })

      sessionStorage.setItem('tempEmail', draft.email.trim())
      sessionStorage.setItem('vi:signup-summary', JSON.stringify({
        nombre: displayName({ ...draft, tipoCuenta: tipo }),
        tipoCuenta: tipo,
        plan: draft.plan,
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      }))

      router.push(locale === routing.defaultLocale ? '/confirmacion' : `/${locale}/confirmacion`)
    } catch {
      setErrorKey('connection')
    } finally {
      setLoading(false)
    }
  }

  const errorMessage = errorKey ? t(`register.errors.${errorKey}`) : ''
  const summaryType = tipo ? t(`register.types.${tipo}.name`) : ''
  const summaryPlan = t(`register.planNames.${draft.plan}`)

  return (
    <AuthShell heading={t('register.title')} subheading={t('register.subtitle')}>
      <ol className="reg-steps" aria-label={t('register.stepsLabel')}>
        {([1, 2, 3] as Step[]).map((value) => {
          const label = value === 1 ? t('register.steps.type') : value === 2 ? t('register.steps.plan') : t('register.steps.details')
          const done = value < step
          return (
            <li key={value}>
              <button
                type="button"
                className={`reg-step${done ? ' reg-step--done' : ''}`}
                aria-current={value === step ? 'step' : undefined}
                onClick={() => { if (done) { setErrorKey(null); setStep(value as Step) } }}
                disabled={!done}
              >
                <span className="reg-step__num">{done ? <Check size={12} aria-hidden="true" /> : value}</span>
                <span>{label}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {errorMessage && (
        <div role="alert" className="flex items-center gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-5 text-sm">
          <AlertCircle size={18} aria-hidden="true" />
          {errorMessage}
        </div>
      )}

      {step === 1 && (
        <section aria-labelledby="reg-type-title">
          <h2 id="reg-type-title" className="reg-heading">{t('register.stepTypeTitle')}</h2>
          <p className="reg-lead">{t('register.stepTypeLead')}</p>

          <div className="reg-options" role="radiogroup" aria-labelledby="reg-type-title">
            {ACCOUNT_TYPES.map((value) => {
              const Icon = TYPE_ICONS[value]
              const limits = PLAN_LIMITS[planForAccountType(value)]
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={tipo === value}
                  className="reg-option"
                  onClick={() => selectType(value)}
                >
                  <span className="reg-option__icon"><Icon size={17} aria-hidden="true" /></span>
                  <span className="reg-option__body">
                    <span className="reg-option__title">{t(`register.types.${value}.name`)}</span>
                    <span className="reg-option__desc">{t(`register.types.${value}.description`)}</span>
                    <span className="reg-option__meta">
                      <span className="reg-chip reg-chip--soft">{isUnlimited(limits.maxAnuncios) ? t('register.listingsUnlimited') : t('register.listingsChip', { max: formatListingLimit(limits.maxAnuncios) })}</span>
                      <span className="reg-chip reg-chip--gold"><Clock size={11} aria-hidden="true" />{t('register.trialBadge')}</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <p className="reg-lead reg-lead--muted">{t('register.typeHint')}</p>

          <div className="reg-actions">
            <button type="button" className="reg-btn reg-btn--primary" onClick={goToPlan}>
              {t('register.continue')}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="reg-plan-title">
          <h2 id="reg-plan-title" className="reg-heading">{t('register.stepPlanTitle')}</h2>
          <p className="reg-lead">{t('register.stepPlanLead')}</p>

          <div className="reg-trial-banner">
            <Clock size={16} aria-hidden="true" />
            <span>{t('register.trialBanner', { days: TRIAL_DAYS, date: trialEnd })}</span>
          </div>

          <div className="reg-options" role="radiogroup" aria-labelledby="reg-plan-title">
            {(['gratuita', 'profesional', 'agencia'] as PlanName[]).map((value) => {
              const limits = PLAN_LIMITS[value]
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.plan === value}
                  className="reg-option"
                  onClick={() => { setErrorKey(null); patch({ plan: value }) }}
                >
                  <span className="reg-option__body">
                    <span className="reg-option__title">
                      {t(`register.planNames.${value}`)}
                      {planForAccountType(tipo || 'particular') === value && (
                        <span className="reg-chip reg-chip--soft">{t('register.recommended')}</span>
                      )}
                    </span>
                    <span className="reg-option__desc">{t(`register.planDescriptions.${value}`, { max: formatListingLimit(limits.maxAnuncios) })}</span>
                    <span className="reg-option__meta">
                      <span className="reg-chip reg-chip--soft">{isUnlimited(limits.maxAnuncios) ? t('register.listingsUnlimited') : t('register.listingsChip', { max: formatListingLimit(limits.maxAnuncios) })}</span>
                      <span className="reg-chip reg-chip--soft">{t('register.photosChip', { max: String(limits.maxFotos) })}</span>
                      <span className="reg-chip reg-chip--gold"><Clock size={11} aria-hidden="true" />{t('register.trialBadge')}</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <p className="reg-lead reg-lead--muted">{t('register.planHint')}</p>

          <div className="reg-actions">
            <button type="button" className="reg-btn reg-btn--ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={16} aria-hidden="true" />
              {t('register.back')}
            </button>
            <button type="button" className="reg-btn reg-btn--primary" onClick={goToDetails}>
              {t('register.continue')}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="reg-details-title">
          <h2 id="reg-details-title" className="reg-heading">{t('register.stepDetailsTitle')}</h2>
          <p className="reg-lead">{t('register.stepDetailsLead')}</p>

          <div className="reg-summary">
            <span className="reg-chip reg-chip--soft">{summaryType}</span>
            <span className="reg-chip reg-chip--soft">{t('register.summaryPlan', { plan: summaryPlan })}</span>
            <span className="reg-chip reg-chip--gold"><Clock size={11} aria-hidden="true" />{t('register.summaryTrial', { days: TRIAL_DAYS })}</span>
          </div>

          {requiresCompany(draft.tipoCuenta) && (
            <div>
              <label htmlFor="register-company">{t('register.fields.empresa')}</label>
              <input
                id="register-company"
                name="organization"
                type="text"
                autoComplete="organization"
                value={draft.empresa}
                onChange={(e) => patch({ empresa: e.target.value })}
                placeholder={t('register.placeholders.empresa')}
                required
                className="w-full border rounded-lg px-4 py-3 bg-white"
              />
            </div>
          )}

          <div className={usesSurname(draft.tipoCuenta) ? 'grid grid-cols-2 gap-3' : ''}>
            <div>
              <label htmlFor="register-name">
                {usesSurname(draft.tipoCuenta) ? t('register.fields.name') : t('register.fields.responsable')}
              </label>
              <input
                id="register-name"
                name="given-name"
                type="text"
                autoComplete="given-name"
                value={draft.nombre}
                onChange={(e) => patch({ nombre: e.target.value })}
                placeholder={t('register.placeholders.name')}
                required
                className="w-full border rounded-lg px-4 py-3 bg-white"
              />
            </div>
            {usesSurname(draft.tipoCuenta) && (
              <div>
                <label htmlFor="register-surname">{t('register.fields.surname')}</label>
                <input
                  id="register-surname"
                  name="family-name"
                  type="text"
                  autoComplete="family-name"
                  value={draft.apellido}
                  onChange={(e) => patch({ apellido: e.target.value })}
                  placeholder={t('register.placeholders.surname')}
                  required
                  className="w-full border rounded-lg px-4 py-3 bg-white"
                />
              </div>
            )}
          </div>

          {offersLicense(draft.tipoCuenta) && (
            <div>
              <label htmlFor="register-license">
                {t('register.fields.licencia')} <span className="font-normal text-gray-500">({t('register.optional')})</span>
              </label>
              <input
                id="register-license"
                name="license"
                type="text"
                value={draft.licencia}
                onChange={(e) => patch({ licencia: e.target.value })}
                placeholder={t('register.placeholders.licencia')}
                className="w-full border rounded-lg px-4 py-3 bg-white"
              />
            </div>
          )}

          <div>
            <label htmlFor="register-email">{t('register.fields.email')}</label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) => patch({ email: e.target.value })}
              placeholder="tu@email.com"
              required
              className="w-full border rounded-lg px-4 py-3 bg-white"
            />
          </div>

          <div>
            <label htmlFor="register-phone">
              {t('register.fields.phone')} <span className="font-normal text-gray-500">({t('register.optional')})</span>
            </label>
            <input
              id="register-phone"
              name="tel"
              type="tel"
              autoComplete="tel"
              value={draft.telefono}
              onChange={(e) => patch({ telefono: e.target.value })}
              placeholder="+58 412 1234567"
              className="w-full border rounded-lg px-4 py-3 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="register-state">
                {t('register.fields.state')} <span className="font-normal text-gray-500">({t('register.optional')})</span>
              </label>
              <select
                id="register-state"
                name="address-level1"
                autoComplete="address-level1"
                value={draft.estado}
                onChange={(e) => patch({ estado: e.target.value, ciudad: '' })}
                className="w-full border rounded-lg px-3 py-3 text-sm"
              >
                <option value="">{t('register.choose')}</option>
                {ESTADOS.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="register-city">
                {t('register.fields.city')} <span className="font-normal text-gray-500">({t('register.optional')})</span>
              </label>
              <select
                id="register-city"
                name="address-level2"
                autoComplete="address-level2"
                value={draft.ciudad}
                onChange={(e) => patch({ ciudad: e.target.value })}
                disabled={!draft.estado}
                className="w-full border rounded-lg px-3 py-3 text-sm"
              >
                <option value="">{t('register.choose')}</option>
                {ciudades.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="register-password">{t('register.fields.password')}</label>
            <input
              id="register-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={draft.password}
              onChange={(e) => patch({ password: e.target.value })}
              placeholder={t('register.placeholders.password')}
              required
              className="w-full border rounded-lg px-4 py-3 bg-white"
            />
            <ul className="reg-rules">
              {[
                { ok: draft.password.length >= 8, label: t('register.rules.length') },
                { ok: /[A-Z]/.test(draft.password), label: t('register.rules.upper') },
                { ok: /[0-9]/.test(draft.password), label: t('register.rules.number') },
              ].map((rule) => (
                <li key={rule.label} className={rule.ok ? 'is-ok' : ''}>
                  {rule.ok ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="register-repeat-password">{t('register.fields.repeatPassword')}</label>
            <input
              id="register-repeat-password"
              name="repeat-password"
              type="password"
              autoComplete="new-password"
              value={draft.repeatPassword}
              onChange={(e) => patch({ repeatPassword: e.target.value })}
              placeholder={t('register.placeholders.repeatPassword')}
              required
              className="w-full border rounded-lg px-4 py-3 bg-white"
            />
          </div>

          <div className="reg-actions">
            <button type="button" className="reg-btn reg-btn--ghost" onClick={() => { setErrorKey(null); setStep(2) }} disabled={loading}>
              <ArrowLeft size={16} aria-hidden="true" />
              {t('register.back')}
            </button>
            <button type="submit" className="reg-btn reg-btn--primary" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {loading ? t('register.creating') : t('register.submit')}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-gray-500 mt-6">
        {t('register.has_account')}{' '}
        <LocalLink href="/login" className="font-semibold hover:underline">{t('register.login')}</LocalLink>
      </p>
    </AuthShell>
  )
}
