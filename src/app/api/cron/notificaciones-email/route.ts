import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { limpiarNotificacionesEmailAntiguas, procesarNotificacionesEmailPendientes } from '@/lib/notificaciones-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Envía los avisos de correo programados (mensajes de chat sin leer).
 *
 * Debe invocarse periódicamente por un cron externo:
 *   - Vercel Cron (ver vercel.json)
 *   - Supabase pg_cron + pg_net (ver SUPABASE_SETUP.md)
 *
 * Autenticación: `Authorization: Bearer $CRON_SECRET` o `?secret=$CRON_SECRET`.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get('authorization') || ''
  if (header === `Bearer ${secret}`) return true

  const fromQuery = request.nextUrl.searchParams.get('secret')
  return fromQuery === secret
}

async function procesar(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET no configurado' },
      { status: 503 },
    )
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const resultado = await procesarNotificacionesEmailPendientes(supabase)
    const limpiadas = await limpiarNotificacionesEmailAntiguas(supabase)
    // Retención de eventos de analítica (>180 días) — best effort
    let eventosLimpiados = 0
    try {
      const { data: ev } = await supabase.rpc('limpiar_eventos_antiguos')
      eventosLimpiados = Number(ev || 0)
    } catch { /* la tabla puede no existir aún si falta la migración 007 */ }
    return NextResponse.json({ ok: true, ...resultado, limpiadas, eventosLimpiados })
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
