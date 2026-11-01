import { createServerClient } from './supabase-server'
import { PLAN_LIMITS, TRIAL_DAYS } from './plan-catalog'
import { getUserAgencyContext } from './agency-server'

// Límites por plan (fuente única en `plan-catalog.ts`).
export const PLANS = PLAN_LIMITS
export { TRIAL_DAYS }

export async function checkPlanLimits(userId: string) {
  const supabase = createServerClient()

  // Get active subscription and its plan
  const { data: susData, error: susError } = await supabase
    .from('suscripciones')
    .select('plan, estado, trial_ends_at, fin, creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos, cambio_gratuita')
    .eq('user_id', userId)
    .in('estado', ['activa', 'trial'])
    .lte('inicio', new Date().toISOString())
    .or(`fin.is.null,fin.gt.${new Date().toISOString()}`)
    // Mismo desempate que `plan_efectivo_publicacion` (012): la última
    // suscripción creada decide el plan efectivo también en la aplicación.
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (susError) throw new Error('No se pudo consultar el plan de la cuenta')

  // Default to 'gratuita' if no active subscription
  let currentPlanName = 'gratuita'
  let estado: string | null = null
  let trialEndsAt: string | null = null
  let fin: string | null = null
  let creditosIncluidos = 0
  let creditosUsadosMes = 0

  if (susData && (susData.estado === 'activa' || (susData.estado === 'trial' && new Date(susData.trial_ends_at) > new Date()))) {
    currentPlanName = susData.plan
    estado = susData.estado
    trialEndsAt = susData.trial_ends_at || null
    fin = susData.fin || null
    creditosIncluidos = susData.creditos_incluidos ?? 0
    const renovacionVencida = susData.proxima_renovacion_creditos && new Date(susData.proxima_renovacion_creditos) <= new Date()
    creditosUsadosMes = renovacionVencida ? 0 : (susData.creditos_usados_mes ?? 0)
  }
  const creditosRestantesPlan = Math.max(0, creditosIncluidos - creditosUsadosMes)

  const [{ data: scheduled, error: scheduledError }, { agency, activeMemberIds }] = await Promise.all([
    supabase
      .from('suscripciones')
      .select('plan, inicio')
      .eq('user_id', userId)
      .in('estado', ['activa', 'trial'])
      .gt('inicio', new Date().toISOString())
      .order('inicio')
      .limit(1)
      .maybeSingle(),
    getUserAgencyContext(supabase, userId),
  ])
  if (scheduledError) throw new Error('No se pudo consultar el cambio programado')

  // Si pertenece a una agencia con plan Agencia vigente, hereda límites de publicación y fotos
  // bajo la cartera de la agencia, pero los créditos mensuales del plan permanecen bajo control del dueño.
  const effectivePublishingPlan =
    agency && agency.agenciaPlanActivo ? 'agencia' : currentPlanName
  const limits = PLANS[effectivePublishingPlan as keyof typeof PLANS] || PLANS.gratuita

  const countFilterColumn =
    agency && agency.agenciaPlanActivo && !agency.isOwner ? 'agente_asignado_id' : 'usuario_id'

  const { count: activeCount, error: countError } = await supabase
    .from('inmuebles')
    .select('id', { count: 'exact', head: true })
    .eq(countFilterColumn, userId)
    .eq('activo', true)

  if (countError) {
    throw new Error('No se pudo verificar el límite de publicaciones')
  }

  const canPublish = (activeCount || 0) < limits.maxAnuncios

  return {
    plan: currentPlanName,
    effectivePublishingPlan,
    estado,
    trialEndsAt,
    fin,
    creditosIncluidos,
    creditosUsadosMes,
    creditosRestantesPlan,
    limits,
    activeCount: activeCount || 0,
    canPublish,
    scheduledPlan: scheduled,
    cambioGratuita: susData?.cambio_gratuita || false,
    agencia: agency
      ? {
          id: agency.id,
          nombre: agency.nombre,
          logo_url: agency.logo_url,
          owner_id: agency.owner_id,
          rol: agency.rol,
          esDueno: agency.isOwner,
          esAdmin: agency.isAdmin,
          planAgenciaActivo: agency.agenciaPlanActivo,
          totalMiembros: activeMemberIds.size,
        }
      : null,
  }
}
