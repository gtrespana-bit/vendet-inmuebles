import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Webhook: recibe clicks de botones inline en Telegram (APROBAR/RECHAZAR)
export async function POST(req: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!BOT_TOKEN || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const callback = body.callback_query
    if (!callback) return NextResponse.json({ ok: true })

    const data = callback.data as string
    const chatId = callback.message.chat.id as number
    const messageId = callback.message.message_id as number
    const callbackQueryId = callback.id as string

    // Formato: aprobar:<tx_id> o rechazar:<tx_id>
    const [accion, txId] = data.split(':')

    // Verificar que viene del chat correcto
    if (chatId.toString() !== process.env.TELEGRAM_CHAT_ID) {
      await tgFetch(BOT_TOKEN, '/answerCallbackQuery', { callback_query_id: callbackQueryId, text: 'No autorizado', show_alert: true })
      return NextResponse.json({ ok: false })
    }

    if (accion === 'aprobar' && txId) {
      const result = await procesarAprobacion(txId, supabaseUrl, supabaseKey)
      await tgFetch(BOT_TOKEN, '/answerCallbackQuery', { callback_query_id: callbackQueryId, text: result.alert, show_alert: false })
      await tgFetch(BOT_TOKEN, '/editMessageText', {
        chat_id: chatId, message_id: messageId, text: result.text, parse_mode: 'HTML',
      })
    } else if (accion === 'rechazar' && txId) {
      const result = await procesarRechazo(txId, supabaseUrl, supabaseKey)
      await tgFetch(BOT_TOKEN, '/answerCallbackQuery', { callback_query_id: callbackQueryId, text: result.alert, show_alert: false })
      await tgFetch(BOT_TOKEN, '/editMessageText', {
        chat_id: chatId, message_id: messageId, text: result.text, parse_mode: 'HTML',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// GET: info del webhook
export async function GET() {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) return NextResponse.json({ ok: false, error: 'No token' }, { status: 500 })
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
  return NextResponse.json(await res.json())
}

// ---- Helpers ----

function tgFetch(token: string, method: string, body: object) {
  return fetch(`https://api.telegram.org/bot${token}${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function procesarAprobacion(txId: string, url: string, key: string) {
  const sb = createClient(url, key)

  // Obtener transacción
  const { data: tx, error } = await sb.from('transacciones_creditos').select('id, user_id, tipo, monto, metodo_pago, estado, creado_en, precio_usd, comprobante_url').eq('id', txId).single()
  if (error || !tx) return { alert: '❌ No encontrada', text: '❌ Transacción no encontrada' }

  // Actualizar crédito del usuario
  const { data: perfil } = await sb.from('perfiles').select('credito_balance').eq('id', tx.user_id).single()
  const nuevoBalance = (perfil?.credito_balance || 0) + tx.monto

  const { error: updErr } = await sb.from('perfiles').update({ credito_balance: nuevoBalance }).eq('id', tx.user_id)
  const { error: txErr } = await sb.from('transacciones_creditos').update({ estado: 'aprobado' }).eq('id', txId)

  if (updErr || txErr) {
    return { alert: '❌ Error', text: `❌ Error al aprobar: ${updErr?.message || txErr?.message}` }
  }

  return {
    alert: `✅ +${tx.monto} créditos aprobados`,
    text: `✅ <b>APROBADO</b>\n+${tx.monto} créditos\nUsuario: ${tx.user_id}\nMétodo: ${tx.metodo_pago || 'N/A'}\n\n<i>Procesado desde Telegram</i>`,
  }
}

async function procesarRechazo(txId: string, url: string, key: string) {
  const sb = createClient(url, key)
  await sb.from('transacciones_creditos').update({ estado: 'rechazado' }).eq('id', txId)
  return {
    alert: '❌ Rechazada',
    text: `❌ <b>RECHAZADA</b>\nTransacción: ${txId}\nCréditos NO añadidos\n\n<i>Procesado desde Telegram</i>`,
  }
}
