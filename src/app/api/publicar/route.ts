import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'
import { validateProductData, sanitizeObject } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, moderacionAlerta, ...productoData } = body
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Validar datos del producto
    const validation = validateProductData({ userId, ...productoData })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Sanitizar strings para prevenir XSS
    const sanitizedData = sanitizeObject(productoData)

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rl = await checkRateLimit('producto:create', userId, { ip })
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Demasiadas publicaciones. Espera ${Math.ceil(rl.resetIn / 60000)} min`, resetIn: rl.resetIn },
        { status: 429 }
      )
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await sb.from('productos').insert({ ...sanitizedData, user_id: userId }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Revalidate ISR cache — product appears immediately on home/catalogo
    revalidatePath('/')
    revalidatePath('/catalogo')

    // Telegram alert if moderation needed
    if (moderacionAlerta && moderacionAlerta.nivel) {
      const BOT = process.env.TELEGRAM_BOT_TOKEN
      const CHAT = process.env.TELEGRAM_CHAT_ID
      if (BOT && CHAT) {
        fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT,
            text: `⚠️ <b>ALERTA MODERACIÓN — ${moderacionAlerta.nivel.toUpperCase()}</b>\n\n📝 "${moderacionAlerta.titulo}"\n👤 ${moderacionAlerta.userName}\n🚫 Palabras: ${moderacionAlerta.palabras?.join(', ') || 'N/A'}`,
            parse_mode: 'HTML',
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
