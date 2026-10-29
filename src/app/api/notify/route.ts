import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID, sanitizeString } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 503 })

  try {
    const body = await req.json()
    const mensaje = sanitizeString(typeof body.mensaje === 'string' ? body.mensaje : '', 3500)
    if (!mensaje) return NextResponse.json({ ok: false, error: 'No message' }, { status: 400 })

    const payload: Record<string, any> = { chat_id: chatId, text: mensaje }
    if (body.inlineKeyboard !== undefined) {
      if (!isValidUUID(body.txId) || !Array.isArray(body.inlineKeyboard) || body.inlineKeyboard.length > 3) {
        return NextResponse.json({ ok: false, error: 'Inline keyboard inválido' }, { status: 400 })
      }
      payload.reply_markup = {
        inline_keyboard: body.inlineKeyboard.slice(0, 3).map((row: any) =>
          Array.isArray(row) ? row.slice(0, 3).map((button: any) => ({
            text: sanitizeString(String(button?.text || ''), 40),
            callback_data: `${['aprobar', 'rechazar'].includes(button?.callback_data) ? button.callback_data : 'ver'}:${body.txId}`,
          })) : []
        ),
      }
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const telegram = await response.json()
    return NextResponse.json({ ok: telegram.ok === true, telegram }, { status: response.ok ? 200 : 502 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
