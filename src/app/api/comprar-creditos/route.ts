import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

// POST /api/comprar-creditos
// Todo pasa a revisión manual + Telegram con botones approve/reject
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })
  }

  const sb = createClient(supabaseUrl, serviceKey)

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const { userId, creditos, precioUsd, metodoPago, comprobanteUrl } = body

  if (!userId || !creditos || !metodoPago || !comprobanteUrl) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }

  // Rate limiting: max 5 compras por hora por usuario
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('creditos:comprar', userId, { ip })
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: `Demasiados intentos. Espera ${Math.ceil(rl.resetIn / 60000)} min` }, { status: 429 })
  }

  // Guardar como pendiente
  const { data: tx, error: txErr } = await sb.from('transacciones_creditos').insert({
    user_id: userId,
    tipo: 'compra',
    monto: creditos,
    metodo_pago: metodoPago,
    comprobante_url: comprobanteUrl,
    estado: 'pendiente',
  }).select().single()

  if (txErr) {
    return NextResponse.json({ ok: false, error: txErr.message }, { status: 500 })
  }

  // Notificar a Telegram con botones
  const BOT = process.env.TELEGRAM_BOT_TOKEN
  const CHAT = process.env.TELEGRAM_CHAT_ID

  if (BOT && CHAT) {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT,
        text: `🛒 Nueva compra de créditos\n\n📦 ${creditos} créditos — $${precioUsd}\n💳 ${metodoPago}\n👤 ${userId}\n\nRevisa comprobante y aprueba:`,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Aprobar', callback_data: `aprobar:${tx.id}` },
            { text: '❌ Rechazar', callback_data: `rechazar:${tx.id}` },
          ]],
        },
      }),
    })
  }

  return NextResponse.json({ ok: true })
}
