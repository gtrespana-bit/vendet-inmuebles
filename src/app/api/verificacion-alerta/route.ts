import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 503 })

  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit('verificacion:alerta', auth.user.id, {
    ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
  })
  if (!rateLimit.ok) return NextResponse.json({ ok: false, error: 'Demasiadas solicitudes' }, { status: 429 })

  try {
    const { data: solicitud, error } = await auth.supabaseAdmin
      .from('solicitudes_verificacion')
      .select('pago_movil_telefono, pago_movil_cedula, pago_movil_banco, creada_en')
      .eq('user_id', auth.user.id)
      .eq('estado', 'pendiente')
      .order('creada_en', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!solicitud) return NextResponse.json({ ok: false, error: 'No hay una solicitud pendiente' }, { status: 404 })

    const { data: profile } = await auth.supabaseAdmin
      .from('perfiles')
      .select('nombre')
      .eq('id', auth.user.id)
      .maybeSingle()

    const text = `<b>🛡️ NUEVA SOLICITUD DE VERIFICACIÓN</b>\n\n` +
      `👤 <b>Nombre:</b> ${escapeHtml(profile?.nombre || auth.user.email || auth.user.id)}\n` +
      `🆔 <b>Cédula:</b> ${escapeHtml(solicitud.pago_movil_cedula || 'No disponible')}\n` +
      `📱 <b>Teléfono:</b> ${escapeHtml(solicitud.pago_movil_telefono || 'No disponible')}\n` +
      `🏦 <b>Banco:</b> ${escapeHtml(solicitud.pago_movil_banco || 'No disponible')}\n\n` +
      'Revisar en: Admin Panel → Verificación'

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await response.json()
    return NextResponse.json({ ok: data.ok === true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
