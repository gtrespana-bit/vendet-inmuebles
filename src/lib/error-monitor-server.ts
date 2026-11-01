import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { construirReporteErrorSanitizado, type EntradaReporteError } from './error-monitor'

let adminClient: SupabaseClient | null = null

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return adminClient
}

/**
 * Registra un error sanitizado en `public.errores_sistema` con timeout estricto (2,5 s).
 * Nunca lanza excepciones para no afectar ninguna solicitud en curso.
 */
export async function registrarErrorEnBase(
  entrada: EntradaReporteError,
): Promise<{ ok: boolean; codigoRef?: string }> {
  try {
    const reporte = construirReporteErrorSanitizado(entrada)
    if (!reporte) return { ok: false }

    const sb = getAdminClient()
    if (!sb) return { ok: false, codigoRef: reporte.codigoRef }

    const rpcPromise = sb.rpc('registrar_error_sistema', {
      p_huella: reporte.huella,
      p_codigo_ref: reporte.codigoRef,
      p_origen: reporte.origen,
      p_severidad: reporte.severidad,
      p_nombre: reporte.nombre,
      p_mensaje: reporte.mensaje,
      p_codigo_error: reporte.codigoError,
      p_ruta: reporte.ruta,
      p_endpoint: reporte.endpoint,
      p_accion_previa: reporte.accionPrevia,
      p_stack: reporte.stack,
      p_user_id: reporte.userId,
      p_dispositivo: reporte.dispositivo,
      p_navegador: reporte.navegador,
      p_pais: reporte.pais,
      p_muestra: reporte.muestra,
    })

    const resultado: any = await Promise.race([
      rpcPromise,
      new Promise(resolve => setTimeout(() => resolve({ error: 'timeout' }), 2500)),
    ])

    if (resultado?.error) {
      return { ok: false, codigoRef: reporte.codigoRef }
    }

    return {
      ok: true,
      codigoRef: resultado?.data?.codigo_ref || reporte.codigoRef,
    }
  } catch {
    return { ok: false }
  }
}

/**
 * Captura excepciones no controladas del servidor Next.js (`onRequestError` o rutas API).
 */
export async function capturarErrorServidor(
  err: unknown,
  contexto?: {
    path?: string
    method?: string
    routeType?: string
    userId?: string | null
    pais?: string | null
  },
): Promise<void> {
  try {
    const e = err as Record<string, any> | null
    const nombre = typeof e?.name === 'string' ? e.name : 'ServerError'
    const mensaje = typeof e?.message === 'string' ? e.message : String(err ?? 'Error de servidor')
    const digest = typeof e?.digest === 'string' ? e.digest : null

    // Ignorar redirecciones y 404 controlados internos de Next.js App Router
    if (digest && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|DYNAMIC_SERVER_USAGE)/.test(digest)) {
      return
    }

    const codigoRaw = e?.code || e?.status || (digest ? `DIGEST:${digest}` : null)
    const path = contexto?.path || '/'
    const method = contexto?.method || 'GET'
    const esApi = path.startsWith('/api/')

    // Evitar bucles si el propio endpoint de errores fallase
    if (path.startsWith('/api/errores') || path.startsWith('/api/admin/errores')) {
      return
    }

    await registrarErrorEnBase({
      origen: esApi ? 'api' : 'servidor',
      severidad: 'critico',
      nombre,
      mensaje,
      codigoError: codigoRaw ? String(codigoRaw) : '500',
      ruta: path,
      endpoint: `${method.toUpperCase()} ${path}`,
      accionPrevia: contexto?.routeType ? `Render/ejecución servidor (${contexto.routeType})` : null,
      stack: typeof e?.stack === 'string' ? e.stack : null,
      userId: contexto?.userId || null,
      dispositivo: 'servidor',
      navegador: 'Node.js',
      pais: contexto?.pais || null,
      statusHttp: typeof e?.status === 'number' ? e.status : 500,
    })
  } catch {
    // Silencio intencional
  }
}
