/**
 * Rate limiter distribuido usando Supabase como storage.
 * Funciona correctamente en Vercel serverless (cada invocación comparte la DB).
 *
 * Protección por userId Y por IP address.
 */
import { createClient } from '@supabase/supabase-js'

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  'pagos:crear': { max: 10, windowMs: 60 * 60 * 1000 },
  // Publicaciones: 20 por hora (nuevos usuarios subiendo inventario)
  'producto:create': { max: 20, windowMs: 60 * 60 * 1000 },
  // Mensajes: 200 por hora (conversaciones activas entre usuarios)
  'mensaje:create': { max: 200, windowMs: 60 * 60 * 1000 },
  // Denuncias: 10 por hora
  'denuncia:create': { max: 10, windowMs: 60 * 60 * 1000 },
  // Login: 5 por 15 min por IP (anti brute force)
  'auth:login': { max: 5, windowMs: 15 * 60 * 1000 },
  // Comprar créditos: SIN límite práctico (no bloquear ventas)
  'creditos:comprar': { max: 999, windowMs: 60 * 60 * 1000 },
  // Registro de usuarios: 3 por hora por IP
  'auth:register': { max: 3, windowMs: 60 * 60 * 1000 },
  // Reset password: 5 por hora por IP
  'auth:reset': { max: 5, windowMs: 60 * 60 * 1000 },
  // Contacto: 10 por hora por IP
  'contacto:send': { max: 10, windowMs: 60 * 60 * 1000 },
  // Conversaciones: 20 por hora por usuario
  'conversacion:create': { max: 20, windowMs: 60 * 60 * 1000 },
  // Favoritos: 100 por hora por usuario
  'favorito:toggle': { max: 100, windowMs: 60 * 60 * 1000 },
  // Notificaciones push a terceros: 60 por hora por usuario
  'push:send': { max: 60, windowMs: 60 * 60 * 1000 },
  // Alertas de moderación: 10 por hora por usuario
  'moderacion:alerta': { max: 10, windowMs: 60 * 60 * 1000 },
  // Avisos de verificación: 3 por hora por usuario
  'verificacion:alerta': { max: 3, windowMs: 60 * 60 * 1000 },
  // Correo de subida de nivel: 1 por hora por usuario
  'email:level-up': { max: 1, windowMs: 60 * 60 * 1000 },
  // Foto perfil: 10 por hora por usuario
  'foto-perfil:update': { max: 10, windowMs: 60 * 60 * 1000 },
  // Subida R2: 50 por hora por usuario
  'r2-upload': { max: 50, windowMs: 60 * 60 * 1000 },
  // Consultar tasa BCV: 60 por hora por IP
  'tasa-bcv': { max: 60, windowMs: 60 * 60 * 1000 },
  // Webhook Telegram: 120 por hora
  'telegram:webhook': { max: 120, windowMs: 60 * 60 * 1000 },
  // Mejora de descripciones con IA (Gemini gratuito): 20 por hora por usuario
  'ai-descripcion': { max: 20, windowMs: 60 * 60 * 1000 },
  // Eventos de analítica (pageviews): 300 por hora por IP
  'track:evento': { max: 300, windowMs: 60 * 60 * 1000 },
  // Visita a ficha de inmueble: 60 por hora por IP
  'inmueble:visita': { max: 60, windowMs: 60 * 60 * 1000 },
  // Recordatorio periódico de órdenes provisionales/en revisión: máx 1 cada 6 h
  'cron:alerta-provisionales': { max: 1, windowMs: 6 * 60 * 60 * 1000 },
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Política ante fallo de la base de datos (F07).
 * Las operaciones costosas o sensibles fallan cerrado; las de bajo coste
 * (analítica, visitas, favoritos) siguen fallando abierto para no degradar la
 * navegación por un problema del limitador.
 */
const FAIL_CLOSED = new Set([
  'auth:login', 'auth:register', 'auth:reset', 'pagos:crear', 'creditos:comprar',
  'ai-descripcion', 'contacto:send', 'r2-upload', 'producto:create', 'mensaje:create',
  'push:send', 'denuncia:create', 'conversacion:create', 'foto-perfil:update',
])

export function failClosed(key: string): boolean {
  return FAIL_CLOSED.has(key)
}

export async function checkRateLimit(
  key: string,
  identifier: string, // userId o IP
  extraData?: { ip?: string }
): Promise<{ ok: boolean; remaining: number; resetIn: number; limit: number }> {
  const limit = LIMITS[key]
  if (!limit) return { ok: true, remaining: 999, resetIn: 0, limit: 0 }

  const fallo = failClosed(key)
    ? { ok: false, remaining: 0, resetIn: limit.windowMs, limit: limit.max }
    : { ok: true, remaining: 999, resetIn: 0, limit: limit.max }

  // La reserva es atómica en la base (migración 015). El tiempo máximo evita
  // colgar la petición si la base no responde.
  return await Promise.race([
    checkRateLimitInner(key, identifier, extraData),
    new Promise<typeof fallo>((resolve) => setTimeout(() => resolve(fallo), 2500)),
  ])
}

async function checkRateLimitInner(
  key: string,
  identifier: string,
  extraData?: { ip?: string }
): Promise<{ ok: boolean; remaining: number; resetIn: number; limit: number }> {
  const limit = LIMITS[key]
  if (!limit) return { ok: true, remaining: 999, resetIn: 0, limit: 0 }

  const fallo = failClosed(key)
    ? { ok: false, remaining: 0, resetIn: limit.windowMs, limit: limit.max }
    : { ok: true, remaining: 999, resetIn: 0, limit: limit.max }

  try {
    // Una sola llamada: cuenta y reserva en la misma transacción.
    const { data, error } = await getSupabaseClient().rpc('reservar_rate_limit', {
      p_key: key,
      p_identifier: identifier,
      p_ip: extraData?.ip || null,
      p_max: limit.max,
      p_ventana_segundos: Math.ceil(limit.windowMs / 1000),
    })

    if (error) {
      console.error('Rate limit RPC error:', error)
      return fallo
    }

    const fila = Array.isArray(data) ? data[0] : data
    if (!fila) return fallo

    return {
      ok: fila.permitido !== false,
      remaining: Number(fila.restantes ?? 0),
      resetIn: Number(fila.reinicia_en ?? 0) * 1000,
      limit: limit.max,
    }
  } catch (err) {
    console.error('Rate limit check error:', err)
    return fallo
  }
}

// Limpiar registros antiguos (más de 24 horas)
export async function cleanOldRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sb = getSupabaseClient()

  const { count, error } = await sb
    .from('rate_limit')
    .delete()
    .lt('created_at', cutoff)

  if (error) {
    console.error('Rate limit cleanup error:', error)
    return 0
  }

  return count || 0
}
