import { registrarEvento, rutaDesdeReferer } from '@/lib/analytics-server'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'

// POST /api/comprar-creditos
// Registra una compra pendiente. El comprobante se almacena en un bucket privado.
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  }

  const { data: authData, error: authError } = await sb.auth.getUser(token)
  const user = authData.user
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const { userId, creditos, precioUsd, metodoPago, comprobanteUrl } = body
  const creditosValidos = Number.isInteger(Number(creditos)) && Number(creditos) > 0
  const precioValido = Number.isFinite(Number(precioUsd)) && Number(precioUsd) >= 0
  const rutaComprobante = typeof comprobanteUrl === 'string' ? comprobanteUrl : ''

  if (userId && userId !== user.id) {
    return NextResponse.json({ ok: false, error: 'Usuario inválido' }, { status: 403 })
  }
  if (!creditosValidos || !precioValido || !metodoPago || !rutaComprobante) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }
  if (
    !rutaComprobante.startsWith(`${user.id}/`) ||
    rutaComprobante.includes('..') ||
    rutaComprobante.startsWith('/')
  ) {
    return NextResponse.json({ ok: false, error: 'Ruta de comprobante inválida' }, { status: 400 })
  }

  // Rate limiting: restringido por usuario autenticado.
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('creditos:comprar', user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: `Demasiados intentos. Espera ${Math.ceil(rl.resetIn / 60000)} min` }, { status: 429 })
  }

  const { data: tx, error: txErr } = await sb.from('transacciones_creditos').insert({
    user_id: user.id,
    tipo: 'compra',
    monto: Number(creditos),
    precio_usd: Number(precioUsd),
    metodo_pago: String(metodoPago).slice(0, 100),
    comprobante_url: rutaComprobante,
    estado: 'pendiente',
  }).select().single()

  if (txErr) {
    return NextResponse.json({ ok: false, error: txErr.message }, { status: 500 })
  }

  // Notificar a Telegram con botones de aprobación/rechazo.
  const BOT = process.env.TELEGRAM_BOT_TOKEN
  const CHAT = process.env.TELEGRAM_CHAT_ID

  if (BOT && CHAT) {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT,
        text: `🛒 Nueva compra de créditos\n\n📦 ${creditos} créditos — $${precioUsd}\n💳 ${metodoPago}\n👤 ${user.id}\n\nRevisa comprobante y aprueba:`,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Aprobar', callback_data: `aprobar:${tx.id}` },
            { text: '❌ Rechazar', callback_data: `rechazar:${tx.id}` },
          ]],
        },
      }),
    })
  }

  void registrarEvento('compra_creditos', {
    ruta: '/creditos',
    meta: {
      transaccion_id: tx.id,
      creditos: Number(creditos),
      precio_usd: Number(precioUsd),
      metodo_pago: String(metodoPago).slice(0, 100),
      estado: 'pendiente',
    },
    userId: user.id,
    req,
  })

  return NextResponse.json({ ok: true })
}
