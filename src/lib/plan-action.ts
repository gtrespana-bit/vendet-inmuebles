export type PlanName = 'gratuita' | 'profesional' | 'agencia'
export type PlanAction = 'loading' | 'register' | 'current' | 'change' | 'error'

/** Never offer registration while session or plan status is being checked. */
export function getPlanAction(authLoading: boolean, userId: string | null, planOwner: string | null, plan: PlanName | null, failed: boolean, card: PlanName): PlanAction {
  if (authLoading) return 'loading'
  if (!userId) return 'register'
  if (userId !== planOwner) return 'loading'
  if (failed || !plan) return 'error'
  return plan === card ? 'current' : 'change'
}
