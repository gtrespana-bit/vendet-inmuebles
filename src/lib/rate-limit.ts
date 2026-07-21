/**
 * Rate limiter distribuido usando Supabase como storage.
 * Funciona correctamente en Vercel serverless (cada invocación comparte la DB).
 *
 * Protección por userId Y por IP address.
 */
import { createClient } from '@supabase/supabase-js'

const LIMITS: Record<string, { max: number; windowMs: number }> = {
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
  // Foto perfil: 10 por hora por usuario
  'foto-perfil:update': { max: 10, windowMs: 60 * 60 * 1000 },
  // Subida R2: 50 por hora por usuario
  'r2-upload': { max: 50, windowMs: 60 * 60 * 1000 },
  // Consultar tasa BCV: 60 por hora por IP
  'tasa-bcv': { max: 60, windowMs: 60 * 60 * 1000 },
  // Webhook Telegram: 120 por hora
  'telegram:webhook': { max: 120, windowMs: 60 * 60 * 1000 },
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function checkRateLimit(
  key: string,
  identifier: string, // userId o IP
  extraData?: { ip?: string }
): Promise<{ ok: boolean; remaining: number; resetIn: number; limit: number }> {
  const limit = LIMITS[key]
  if (!limit) return { ok: true, remaining: 999, resetIn: 0, limit: 0 }

  const now = Date.now()
  const windowStart = new Date(now - limit.windowMs).toISOString()

  const sb = getSupabaseClient()

  try {
    // Contar intentos en la ventana actual
    const { count, error: countError } = await sb
      .from('rate_limit')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .eq('identifier', identifier)
      .gte('created_at', windowStart)

    if (countError) {
      console.error('Rate limit count error:', countError)
      // Si falla la DB, permitir por defecto (fail-open)
      return { ok: true, remaining: 999, resetIn: 0, limit: limit.max }
    }

    const currentCount = count || 0
    const remaining = Math.max(0, limit.max - currentCount)

    if (currentCount >= limit.max) {
      // Calcular reset: encontrar el registro más antiguo en la ventana
      const { data: oldest } = await sb
        .from('rate_limit')
        .select('created_at')
        .eq('key', key)
        .eq('identifier', identifier)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      const resetIn = oldest
        ? new Date(oldest.created_at).getTime() + limit.windowMs - now
        : limit.windowMs

      return { ok: false, remaining: 0, resetIn: Math.max(0, resetIn), limit: limit.max }
    }

    // Registrar este intento (async, no bloquear)
    sb.from('rate_limit').insert({
      key,
      identifier,
      ip: extraData?.ip || null,
    }).then(({ error }) => {
      if (error) console.error('Rate limit insert error:', error)
    })

    return { ok: true, remaining: remaining - 1, resetIn: limit.windowMs, limit: limit.max }
  } catch (err) {
    console.error('Rate limit check error:', err)
    return { ok: true, remaining: 999, resetIn: 0, limit: limit.max }
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
