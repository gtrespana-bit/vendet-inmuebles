import { NextRequest, NextResponse } from 'next/server'
import { verificarContenido, formatearAlertaModeracion } from '@/lib/moderacion'
import { notifyUser } from '@/lib/push-notify'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { ADMIN_EMAILS } from '@/lib/admin-config'
import { isValidUUID, sanitizeString } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 503 })
  }

  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    if (!isValidUUID(body.userId) || body.userId !== auth.user.id) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
    }

    const titulo = sanitizeString(body.titulo, 160)
    const descripcion = sanitizeString(body.descripcion || '', 5000)
    if (!titulo) return NextResponse.json({ ok: false, error: 'Título requerido' }, { status: 400 })

    const moderacion = verificarContenido(`${titulo} ${descripcion}`)
    if (moderacion.nivel === 'limpio') {
      return NextResponse.json({ ok: false, error: 'No se detectó contenido que requiera revisión' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await checkRateLimit('moderacion:alerta', auth.user.id, { ip })
    if (!rateLimit.ok) return NextResponse.json({ ok: false, error: 'Demasiadas alertas de moderación' }, { status: 429 })

    const text = formatearAlertaModeracion(
      moderacion.nivel,
      titulo,
      moderacion.palabras,
      auth.user.id,
      auth.user.email || 'Usuario',
    )
    const [telegramResponse] = await Promise.all([
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      }),
      (async () => {
        // Notificar por push a todos los administradores
        const { data: adminProfiles } = await auth.supabaseAdmin
          .from('perfiles')
          .select('id')
          .in('email', ADMIN_EMAILS)
        if (adminProfiles && adminProfiles.length) {
          await Promise.all(adminProfiles.map((profile: { id: string }) =>
            notifyUser(auth.supabaseAdmin, profile.id, {
              title: '🚨 Alerta de moderación',
              body: `${moderacion.nivel.toUpperCase()}: ${titulo} — ${auth.user.email || 'Usuario'}`,
              tag: `mod-${moderacion.nivel}`,
              icon: '/icon-192.png',
              click_url: '/admin',
            })
          ))
        }
      })(),
    ])

    const telegram = await telegramResponse.json()
    return NextResponse.json({ ok: telegram.ok === true, telegram })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
