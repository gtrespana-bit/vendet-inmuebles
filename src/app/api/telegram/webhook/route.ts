import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'

export const runtime = 'nodejs'

function matchesSecret(expected: string, provided: string | null): boolean {
  if (!provided) return false
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character)
}

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const telegramChatId = process.env.TELEGRAM_CHAT_ID
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!botToken || !webhookSecret || !telegramChatId || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'Webhook no configurado' }, { status: 503 })
  }

  if (!matchesSecret(webhookSecret, request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
  const limit = await checkRateLimit('telegram:webhook', ip, { ip })
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: 'Límite de solicitudes alcanzado' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const callback = body?.callback_query
    if (!callback) return NextResponse.json({ ok: true })

    const callbackId = typeof callback.id === 'string' ? callback.id : ''
    const chatId = callback.message?.chat?.id
    const messageId = callback.message?.message_id
    const data = typeof callback.data === 'string' ? callback.data : ''

    if (!callbackId || !Number.isSafeInteger(messageId) || !Number.isFinite(Number(chatId))) {
      return NextResponse.json({ ok: true })
    }

    const answer = (text: string, showAlert = true) => tgFetch(botToken, '/answerCallbackQuery', {
      callback_query_id: callbackId,
      text,
      show_alert: showAlert,
    })

    if (String(chatId) !== telegramChatId) {
      await answer('No autorizado')
      return NextResponse.json({ ok: false })
    }

    const match = /^(aprobar|rechazar):(.+)$/i.exec(data)
    const accion = match?.[1]?.toLowerCase()
    const txId = match?.[2]
    if (!accion || !txId || !isValidUUID(txId)) {
      await answer('Solicitud inválida')
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const result = accion === 'aprobar'
      ? await procesarAprobacion(supabase, txId)
      : await procesarRechazo(supabase, txId)

    await answer(result.alert, false)
    await tgFetch(botToken, '/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: result.text,
      parse_mode: 'HTML',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: false, error: 'Error procesando webhook' }, { status: 500 })
  }
}

function tgFetch(token: string, method: string, body: object) {
  return fetch(`https://api.telegram.org/bot${token}${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function procesarAprobacion(supabase: any, txId: string) {
  const { data: tx, error: readError } = await supabase
    .from('transacciones_creditos')
    .select('id, user_id, tipo, monto, metodo_pago, estado')
    .eq('id', txId)
    .maybeSingle()

  if (readError || !tx) {
    return { alert: 'Transacción no encontrada', text: '❌ Transacción no encontrada' }
  }
  if (tx.estado !== 'pendiente') {
    return { alert: 'La transacción ya fue procesada', text: '⚠️ La transacción ya fue procesada' }
  }

  // El RPC bloquea la fila y actualiza saldo + transacción dentro de una sola operación.
  const { error } = await supabase.rpc('aprobar_transaccion', {
    p_transaccion_id: txId,
    p_admin_id: null,
  })
  if (error) {
    const alreadyProcessed = /ya fue procesada/i.test(error.message || '')
    return alreadyProcessed
      ? { alert: 'La transacción ya fue procesada', text: '⚠️ La transacción ya fue procesada' }
      : { alert: 'No se pudo aprobar', text: '❌ No se pudo aprobar la transacción' }
  }

  return {
    alert: `✅ +${tx.monto} créditos aprobados`,
    text: `✅ <b>APROBADO</b>\n+${tx.monto} créditos\nUsuario: ${escapeHtml(tx.user_id)}\nMétodo: ${escapeHtml(tx.metodo_pago || 'N/A')}\n\n<i>Procesado desde Telegram</i>`,
  }
}

async function procesarRechazo(supabase: any, txId: string) {
  const { data, error } = await supabase
    .from('transacciones_creditos')
    .update({ estado: 'rechazado', actualizado_en: new Date().toISOString() })
    .eq('id', txId)
    .eq('estado', 'pendiente')
    .select('id')
    .maybeSingle()

  if (error) {
    return { alert: 'No se pudo rechazar', text: '❌ No se pudo rechazar la transacción' }
  }
  if (!data) {
    return { alert: 'La transacción ya fue procesada', text: '⚠️ La transacción ya fue procesada' }
  }

  return {
    alert: '❌ Transacción rechazada',
    text: `❌ <b>RECHAZADA</b>\nTransacción: ${escapeHtml(txId)}\nCréditos no añadidos\n\n<i>Procesado desde Telegram</i>`,
  }
}
