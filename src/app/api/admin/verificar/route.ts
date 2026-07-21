import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Actualizar perfil como verificado
    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({
        verificado: true,
        verificado_desde: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Push notification al usuario verificado
    await notifyUser(supabaseAdmin, userId, {
      title: '✅ Perfil verificado',
      body: 'Tu perfil ya está verificado en VendeT. Ahora tienes acceso a todas las funciones.',
      tag: 'verified',
      icon: '/icon-192.png',
      click_url: '/dashboard',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
