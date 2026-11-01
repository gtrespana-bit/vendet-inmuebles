import type { Instrumentation } from 'next'

export async function register() {
  // Monitor interno activo en PostgreSQL (sin servicios externos como Sentry).
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { capturarErrorServidor } = await import('@/lib/error-monitor-server')
      const headers = request.headers as Record<string, string | string[] | undefined> | undefined
      const rawCountry = headers?.['x-vercel-ip-country']
      const pais = Array.isArray(rawCountry) ? rawCountry[0] : rawCountry || null

      await capturarErrorServidor(err, {
        path: request.path,
        method: request.method,
        routeType: context.routeType,
        pais,
      })
    } catch {
      // Nunca interrumpir el ciclo de respuesta por un fallo de telemetría interna
    }
  }
}
