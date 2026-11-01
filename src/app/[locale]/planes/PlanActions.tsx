'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/components/AuthProvider'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { getPlanAction, type PlanName } from '@/lib/plan-action'

type PlanState = { owner: string | null; plan: PlanName | null; failed: boolean; scheduled?: { plan: string; inicio: string } | null; freeAt?: string | null }
const PlanContext = createContext<PlanState>({ owner: null, plan: null, failed: false })

export function PlanActionsProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [state, setState] = useState<PlanState>({ owner: null, plan: null, failed: false })
  const userId = user?.id || null

  useEffect(() => {
    if (loading || !userId) return
    let cancelled = false
    setState({ owner: null, plan: null, failed: false })
    async function loadPlan() {
      try {
        const response = await fetch('/api/user/plan', { headers: await getSupabaseAuthHeaders(), cache: 'no-store' })
        if (!response.ok) throw new Error('Could not load plan')
        const data = await response.json()
        if (!['gratuita', 'profesional', 'agencia'].includes(data.plan)) throw new Error('Unknown plan')
        if (!cancelled) setState({ owner: userId, plan: data.plan, failed: false, scheduled: data.scheduledPlan, freeAt: data.cambioGratuita ? data.fin : null })
      } catch {
        if (!cancelled) setState({ owner: userId, plan: null, failed: true })
      }
    }
    loadPlan()
    return () => { cancelled = true }
  }, [userId, loading])

  return <PlanContext.Provider value={state}>
    {(state.scheduled || state.freeAt) && <div role="status" className="rounded-lg bg-blue-50 p-4 mb-6 text-blue-900">
      {state.scheduled ? `${state.scheduled.plan} · ${new Date(state.scheduled.inicio).toLocaleDateString()}` : `Gratuita · ${new Date(state.freeAt!).toLocaleDateString()}`}
    </div>}
    {children}
  </PlanContext.Provider>
}

export function PlanActionButton({ plan, className }: { plan: PlanName; className: string }) {
  const { user, loading } = useAuth()
  const state = useContext(PlanContext)
  const t = useTranslations('planActions')
  const en = useLocale() === 'en'
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  async function freePlan(cancelar: boolean) {
    setBusy(true)
    try {
      const response = await fetch('/api/user/plan/cambio', { method: 'POST', headers: { ...await getSupabaseAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'gratuita', cancelar }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setNotice(cancelar ? (en ? 'Scheduled downgrade cancelled.' : 'Bajada programada cancelada.') : `${en ? 'Free plan scheduled for' : 'Plan gratuito programado para'} ${new Date(data.fecha).toLocaleString(en ? 'en' : 'es')}`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Error') } finally { setBusy(false) }
  }
  const action = getPlanAction(loading, user?.id || null, state.owner, state.plan, state.failed, plan)
  if (action === 'loading') return <span className={`${className} opacity-60`} role="status">{t('loading')}</span>
  if (action === 'current') return <span className="block w-full text-center py-3 rounded-lg font-medium bg-gray-100 text-gray-700" aria-label={t('current')}>{t('current')}</span>
  if (action === 'error') return <div className="text-center"><p role="alert" className="text-sm text-red-700 mb-2">{t('error')}</p><LocalLink href="/dashboard" className={className}>{t('dashboard')}</LocalLink></div>
  if (action === 'register') {
    return <LocalLink href={`/register?plan=${plan}&redirect=${encodeURIComponent('/publicar-inmueble')}`} className={className}>{t('register')}</LocalLink>
  }
  if (plan === 'gratuita') return <div className="space-y-2">
    <button disabled={busy} onClick={() => freePlan(false)} className={className}>{en ? 'Switch at end of period' : 'Cambiar al finalizar el período'}</button>
    <button disabled={busy} onClick={() => freePlan(true)} className="text-sm underline block w-full">{en ? 'Cancel scheduled downgrade' : 'Cancelar bajada programada'}</button>
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </div>
  return <div><LocalLink href={`/pagos?plan=${plan}`} className={className}>{en ? 'Change plan and pay' : 'Cambiar plan y pagar'}</LocalLink><p className="text-xs text-gray-500 text-center mt-2">{en ? 'Upgrades on activation. Downgrades at the end of your current period.' : 'Subidas al activarse el pago. Bajadas al finalizar tu período actual.'}</p></div>
}
