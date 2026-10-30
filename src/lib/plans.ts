import { createServerClient } from './supabase-server'

// Plan definitions
export const PLANS = {
  gratuita: { maxAnuncios: 1, maxFotos: 8, creditosMes: 0 },
  profesional: { maxAnuncios: 5, maxFotos: 20, creditosMes: 5 },
  agencia: { maxAnuncios: 999999, maxFotos: 30, creditosMes: 20 },
}

export async function checkPlanLimits(userId: string) {
  const supabase = createServerClient()
  
  // Get active subscription and its plan
  const { data: susData, error: susError } = await supabase
    .from('suscripciones')
    .select('plan, estado, trial_ends_at')
    .eq('user_id', userId)
    .in('estado', ['activa', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Default to 'gratuita' if no active subscription
  let currentPlanName = 'gratuita'
  
  if (susData && (susData.estado === 'activa' || (susData.estado === 'trial' && new Date(susData.trial_ends_at) > new Date()))) {
    currentPlanName = susData.plan
  }

  const limits = PLANS[currentPlanName as keyof typeof PLANS] || PLANS.gratuita

  // Check current active properties
  const { count: activeCount, error: countError } = await supabase
    .from('inmuebles')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .eq('activo', true)
    
  if (countError) {
    throw new Error('No se pudo verificar el límite de publicaciones')
  }

  const canPublish = (activeCount || 0) < limits.maxAnuncios

  return {
    plan: currentPlanName,
    limits,
    activeCount: activeCount || 0,
    canPublish,
  }
}
