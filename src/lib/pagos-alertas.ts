import type { SupabaseClient } from '@supabase/supabase-js'
import { checkRateLimit } from './rate-limit.ts'

export type ResultadoAlertaProvisionales = {
  provisionalesAntiguos: number
  revisionAntiguos: number
  alertaEnviada: boolean
}

/**
 * Supervisa órdenes en estado `provisional` o `revision` que llevan más de
 * `horasUmbral` (por defecto 6 h) sin confirmación administrativa definitiva.
 *
 * No incluye datos personales ni texto OCR en logs ni alertas (F14, F28).
 */
export async function alertarPagosPendientesRevision(
  supabase: SupabaseClient,
  opciones: { horasUmbral?: number; ahoraMs?: number } = {}
): Promise<ResultadoAlertaProvisionales> {
  const horas = Math.max(1, opciones.horasUmbral ?? 6)
  const ahora = opciones.ahoraMs ?? Date.now()
  const corteIso = new Date(ahora - horas * 3600_000).toISOString()

  const [{ count: provCount, error: provErr }, { count: revCount, error: revErr }] = await Promise.all([
    supabase
      .from('ordenes_pago')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'provisional')
      .lte('creada_en', corteIso),
    supabase
      .from('ordenes_pago')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['revision', 'bloqueada'])
      .lte('creada_en', corteIso),
  ])

  if (provErr || revErr) {
    console.warn('[pagos-alertas] Error consultando cola de órdenes:', (provErr || revErr)?.message)
    return { provisionalesAntiguos: 0, revisionAntiguos: 0, alertaEnviada: false }
  }

  const provisionalesAntiguos = provCount ?? 0
  const revisionAntiguos = revCount ?? 0
  const totalPendientes = provisionalesAntiguos + revisionAntiguos

  if (totalPendientes === 0) {
    return { provisionalesAntiguos: 0, revisionAntiguos: 0, alertaEnviada: false }
  }

  const bot = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_CHAT_ID
  if (!bot || !chat) {
    return { provisionalesAntiguos, revisionAntiguos, alertaEnviada: false }
  }

  const rate = await checkRateLimit('cron:alerta-provisionales', 'sistema').catch(() => ({ ok: false }))
  if (!rate.ok) {
    return { provisionalesAntiguos, revisionAntiguos, alertaEnviada: false }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        chat_id: chat,
        text:
          `⏰ Recordatorio de conciliación de pagos (> ${horas}h):\n` +
          `• Provisionales sin confirmar: ${provisionalesAntiguos}\n` +
          `• En revisión / bloqueadas: ${revisionAntiguos}\n` +
          `Revisa Administración → Pagos (pestaña Cola).`,
      }),
    })
    return { provisionalesAntiguos, revisionAntiguos, alertaEnviada: res.ok }
  } catch {
    return { provisionalesAntiguos, revisionAntiguos, alertaEnviada: false }
  }
}
