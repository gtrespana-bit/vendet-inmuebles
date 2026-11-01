'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/components/AuthProvider'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { getPlanAction, type PlanName } from '@/lib/plan-action'

type PlanState = { owner: string | null; plan: PlanName | null; failed: boolean }
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
        if (!cancelled) setState({ owner: userId, plan: data.plan, failed: false })
      } catch {
        if (!cancelled) setState({ owner: userId, plan: null, failed: true })
      }
    }
    loadPlan()
    return () => { cancelled = true }
  }, [userId, loading])

  return <PlanContext.Provider value={state}>{children}</PlanContext.Provider>
}

export function PlanActionButton({ plan, className }: { plan: PlanName; className: string }) {
  const { user, loading } = useAuth()
  const state = useContext(PlanContext)
  const t = useTranslations('planActions')
  const action = getPlanAction(loading, user?.id || null, state.owner, state.plan, state.failed, plan)
  if (action === 'loading') return <span className={`${className} opacity-60`} role="status">{t('loading')}</span>
  if (action === 'current') return <span className="block w-full text-center py-3 rounded-lg font-medium bg-gray-100 text-gray-700" aria-label={t('current')}>{t('current')}</span>
  if (action === 'error') return <div className="text-center"><p role="alert" className="text-sm text-red-700 mb-2">{t('error')}</p><LocalLink href="/dashboard" className={className}>{t('dashboard')}</LocalLink></div>
  if (action === 'register') {
    return <LocalLink href={`/register?plan=${plan}&redirect=${encodeURIComponent('/publicar-inmueble')}`} className={className}>{t('register')}</LocalLink>
  }
  return <div><LocalLink href="/contacto" className={className}>{t('contact')}</LocalLink><p className="text-xs text-gray-500 text-center mt-2">{t('contactHint')}</p></div>
}
