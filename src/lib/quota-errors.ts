/**
 * Errores de cupo de plan (migración 012).
 *
 * Los triggers `exigir_cupo_inmueble` y `exigir_cupo_imagen` lanzan SQLSTATE
 * `23514` (check_violation) cuando la cuenta alcanza el máximo de anuncios
 * activos o de fotos por inmueble. PostgREST lo devuelve como
 * `{ code: '23514', message }` y el mensaje ya es legible en español
 * («Límite de publicaciones alcanzado para el plan gratuita»).
 *
 * Se mapea a 409 (conflicto con el estado de la cuenta) en vez de 500 para que
 * los paneles muestren el motivo real y para no confundirlo con un fallo de
 * servidor en los registros ni en las alertas.
 */

export const PLAN_QUOTA_SQLSTATE = '23514'
export const PLAN_QUOTA_CODE = 'cupo_excedido'

export type DbErrorLike = { code?: string | null; message?: string | null } | null | undefined

export function isPlanQuotaError(error: DbErrorLike): boolean {
  return error?.code === PLAN_QUOTA_SQLSTATE
}

/** Respuesta uniforme para el exceso de cupo, con o sin error de PostgreSQL. */
export function planQuotaResponse(message?: string | null): {
  status: 409
  body: { error: string; code: string }
} {
  return {
    status: 409,
    body: {
      error: message?.trim() || 'Límite del plan alcanzado',
      code: PLAN_QUOTA_CODE,
    },
  }
}
