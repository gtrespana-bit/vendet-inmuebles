import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { cleanOldRateLimits } from '@/lib/rate-limit'
import { limpiarNotificacionesEmailAntiguas, procesarNotificacionesEmailPendientes } from '@/lib/notificaciones-email'
import { alertarPagosPendientesRevision } from '@/lib/pagos-alertas'
import { procesarAlertasBusquedasGuardadas } from '@/lib/search-alerts-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Envía los avisos de correo programados (mensajes de chat sin leer) y ejecuta
 * tareas periódicas de retención (cola de correo, rate_limit >24 h y analítica).
 *
 * Debe invocarse periódicamente por un cron externo:
 *   - Vercel Cron (ver vercel.json)
 *   - Supabase pg_cron + pg_net (ver supabase/cron/notificaciones_email_pg_cron.sql)
 *
 * Autenticación: exclusivamente cabecera `Authorization: Bearer $CRON_SECRET`
 * (sin `?secret=` en query para no exponer el secreto en logs de acceso).
 */
function isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8')
  const received = Buffer.from(authHeader, 'utf8')
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

async function procesar(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET no configurado' },
      { status: 503 },
    )
  }
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const resultado = await procesarNotificacionesEmailPendientes(supabase)
    const limpiadas = await limpiarNotificacionesEmailAntiguas(supabase)
    // Retención de rate_limit (>24 h) — best effort (F07)
    const rateLimitsLimpiados = await cleanOldRateLimits().catch(() => 0)
    // Retención de eventos de analítica (>180 días) — best effort
    let eventosLimpiados = 0
    try {
      const { data: ev } = await supabase.rpc('limpiar_eventos_antiguos')
      eventosLimpiados = Number(ev || 0)
    } catch { /* la tabla puede no existir aún si falta la migración 007 */ }
    // Supervisión de órdenes provisionales/en revisión sin atender (>6 h) — F14
    const pagosPendientesAntiguos = await alertarPagosPendientesRevision(supabase).catch(() => ({
      provisionalesAntiguos: 0,
      revisionAntiguos: 0,
      alertaEnviada: false,
    }))
    // Alertas automáticas de búsquedas guardadas (Etapa B) — best effort
    const alertasBusquedas = await procesarAlertasBusquedasGuardadas(supabase).catch(() => ({
      evaluadas: 0,
      enviadas: 0,
      omitidasCooldown: 0,
      omitidasPreferencia: 0,
      errores: 0,
    }))
    return NextResponse.json({
      ok: true,
      ...resultado,
      limpiadas,
      rateLimitsLimpiados,
      eventosLimpiados,
      pagosPendientesAntiguos,
      alertasBusquedas,
    })
  } catch (error: any) {
    console.error('Cron notificaciones-email:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return procesar(request)
}

export async function POST(request: NextRequest) {
  return procesar(request)
}
