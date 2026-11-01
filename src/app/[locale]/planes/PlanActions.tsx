'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/components/AuthProvider'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { getPlanAction, type PlanName } from '@/lib/plan-action'
import { trialDaysRemaining } from '@/lib/trial-status'

type PlanState = {
  owner: string | null; plan: PlanName | null; failed: boolean; estado?: string | null
  trialEndsAt?: string | null; fin?: string | null
  scheduled?: { plan: string; inicio: string } | null; freeAt?: string | null
}
const EMPTY: PlanState = { owner: null, plan: null, failed: false }
const PlanContext = createContext<PlanState & { refresh: () => void }>({ ...EMPTY, refresh: () => {} })
const names = { es: { gratuita: 'Gratuita', profesional: 'Profesional', agencia: 'Agencia' }, en: { gratuita: 'Free', profesional: 'Professional', agencia: 'Agency' } }

export function PlanActionsProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const en = useLocale() === 'en'
  const [state, setState] = useState<PlanState>(EMPTY)
  const [version, setVersion] = useState(0)
  const userId = user?.id || null
  // Recheck on focus and once a minute: an expired trial must not keep offering free changes.
  useEffect(() => {
    const refresh = () => setVersion(v => v+1)
    window.addEventListener('focus', refresh)
    const timer = setInterval(refresh, 60000)
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (loading || !userId) { setState(EMPTY); return }
    let cancelled = false
    async function loadPlan() {
      try {
        const response = await fetch('/api/user/plan', { headers: await getSupabaseAuthHeaders(), cache: 'no-store' })
        if (!response.ok) throw new Error('Could not load plan')
        const data = await response.json()
        if (!['gratuita', 'profesional', 'agencia'].includes(data.plan)) throw new Error('Unknown plan')
        if (!cancelled) setState({ owner: userId, plan: data.plan, failed: false, estado: data.estado, trialEndsAt: data.trialEndsAt, fin: data.fin, scheduled: data.scheduledPlan, freeAt: data.cambioGratuita ? data.fin : null })
      } catch {
        if (!cancelled) setState({ owner: userId, plan: null, failed: true })
      }
    }
    void loadPlan()
    return () => { cancelled = true }
  }, [userId, loading, version])
  const visible = state.owner === userId && userId ? state : EMPTY
  const days = trialDaysRemaining(visible.estado, visible.trialEndsAt)
  const date = (value: string) => new Date(value).toLocaleDateString(en ? 'en' : 'es')
  return <PlanContext.Provider value={{ ...visible, refresh: () => setVersion(v=>v+1) }}>
    {days > 0 && <div role="status" className="rounded-xl bg-blue-50 p-5 mb-8 text-blue-900 space-y-2">
      <p className="font-bold">{en ? `Free trial: ${days} day${days === 1 ? '' : 's'} remaining` : `Prueba gratuita: te queda${days === 1 ? '' : 'n'} ${days} día${days === 1 ? '' : 's'}`}</p>
      <p>{en ? `Ends on ${date(visible.trialEndsAt!)}. No payment is due now.` : `Termina el ${date(visible.trialEndsAt!)}. Ahora no tienes que pagar.`}</p>
      <p className="text-sm">{en ? 'You can try another plan for the remaining days. Switching does not restart or extend your trial. There are no automatic charges; without a paid plan, your account continues on Free when the trial ends.' : 'Puedes probar otro plan durante los días restantes. Cambiar no reinicia ni amplía la prueba. No hay cobros automáticos: al terminar, tu cuenta continúa en Gratuita si no contratas un plan de pago.'}</p>
    </div>}
    {(visible.scheduled || visible.freeAt) && <div role="status" className="rounded-lg bg-blue-50 p-4 mb-6 text-blue-900">
      {en ? 'Scheduled change: ' : 'Cambio programado: '}
      {visible.scheduled ? `${names[en ? 'en' : 'es'][visible.scheduled.plan as PlanName]} · ${date(visible.scheduled.inicio)}` : `${names[en ? 'en' : 'es'].gratuita} · ${date(visible.freeAt!)}`}
      <p className="text-sm">{en ? 'Your current plan stays active until that date.' : 'Hasta esa fecha conservas tu plan actual.'}</p>
    </div>}
    {children}
  </PlanContext.Provider>
}

/** Avoid promising a fresh 30-day trial on every card to existing accounts. */
export function PlanTrialBadge() {
  const { user, loading } = useAuth()
  const state = useContext(PlanContext)
  const en = useLocale() === 'en'
  if (loading) return null
  const days = trialDaysRemaining(state.estado, state.trialEndsAt)
  if (user && !days) return null
  return <p className="mb-4 inline-flex rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">{user
    ? (en ? `${days} trial day${days === 1 ? '' : 's'} remaining · no payment now` : `${days} día${days === 1 ? '' : 's'} de prueba restante${days === 1 ? '' : 's'} · sin pagar ahora`)
    : (en ? '30-day free trial when you sign up' : '30 días de prueba gratis al crear tu cuenta')}</p>
}

export function PlanActionButton({ plan, className }: { plan: PlanName; className: string }) {
  const { user, loading } = useAuth()
  const state = useContext(PlanContext)
  const t = useTranslations('planActions')
  const en = useLocale() === 'en'
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const days = trialDaysRemaining(state.estado, state.trialEndsAt)
  async function change(cancelar = false) {
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/user/plan/cambio', { method: 'POST', headers: { ...await getSupabaseAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(days ? { plan, modo: 'prueba' } : { plan: 'gratuita', cancelar }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setNotice(days ? (en ? 'Trial plan changed without payment. Your trial end date is unchanged.' : 'Plan de prueba cambiado sin pagar. Se mantiene la fecha de fin de tu prueba.') : cancelar ? (en ? 'Scheduled downgrade cancelled.' : 'Bajada programada cancelada.') : `${en ? 'Free plan scheduled for' : 'Plan gratuito programado para'} ${new Date(data.fecha).toLocaleDateString(en ? 'en' : 'es')}`)
      state.refresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Error'); state.refresh() } finally { setBusy(false) }
  }
  const action = getPlanAction(loading, user?.id || null, state.owner, state.plan, state.failed, plan)
  const feedback = notice && <p role="status" className="text-sm mt-2">{notice}</p>
  if (action === 'loading') return <span className={`${className} opacity-60`} role="status">{t('loading')}</span>
  if (action === 'error') return <div className="text-center"><p role="alert" className="text-sm text-red-700 mb-2">{t('error')}</p><button onClick={state.refresh} className={className}>{en ? 'Try again' : 'Volver a intentar'}</button></div>
  if (action === 'register') return <LocalLink href={`/register?plan=${plan}&redirect=${encodeURIComponent('/publicar-inmueble')}`} className={className}>{t('register')}</LocalLink>
  if (action === 'current') return <div><span className="block w-full text-center py-3 rounded-lg font-medium bg-gray-100 text-gray-700">{days ? (en ? 'Your trial plan' : 'Tu plan de prueba actual') : t('current')}</span>{feedback}</div>
  if (days) return <div><button disabled={busy || !!state.scheduled} onClick={() => change()} className={className}>{busy ? (en ? 'Changing…' : 'Cambiando…') : (en ? 'Try this plan for free' : 'Probar este plan sin pagar')}</button><p className="text-xs text-gray-500 text-center mt-2">{en ? `For your ${days} remaining trial days. Same end date.` : `Durante tus ${days} días restantes de prueba. Misma fecha de fin.`}</p>{feedback}</div>
  // A previously paid future subscription should not send the user to another checkout.
  if (state.scheduled) return <div><span className="block text-center py-3 rounded-lg bg-gray-100">{en ? 'You already have a scheduled change' : 'Ya tienes un cambio programado'}</span><LocalLink href="/pagos" className="block text-center text-sm underline mt-2">{en ? 'View my payments' : 'Ver mis pagos'}</LocalLink></div>
  if (plan === 'gratuita') return <div className="space-y-2">
    {state.freeAt ? <><p className="text-sm">{en ? 'Free plan is already scheduled.' : 'El cambio a Gratuita ya está programado.'}</p><button disabled={busy} onClick={() => change(true)} className={className}>{en ? 'Keep my current plan until expiry' : 'Cancelar bajada programada'}</button></>
      : <button disabled={busy} onClick={() => change()} className={className}>{en ? 'Switch at end of period' : 'Cambiar al finalizar el período'}</button>}
    {feedback}
  </div>
  const upgrade = state.plan === 'gratuita' || (state.plan === 'profesional' && plan === 'agencia')
  return <div><LocalLink href={`/pagos?plan=${plan}`} className={className}>{upgrade ? (en ? 'Upgrade and pay' : 'Subir de plan y pagar') : (en ? 'Schedule lower plan' : 'Programar bajada de plan')}</LocalLink><p className="text-xs text-gray-500 text-center mt-2">{upgrade
    ? (en ? 'Starts when your payment is validated.' : 'Se activa cuando se valida tu pago.')
    : (en ? `Starts after your current period${state.fin ? ` (${new Date(state.fin).toLocaleDateString('en')})` : ''}. You will see the payment amount before confirming.` : `Empieza al terminar tu período actual${state.fin ? ` (${new Date(state.fin).toLocaleDateString('es')})` : ''}. Verás el importe antes de pagar.`)}</p></div>
}
