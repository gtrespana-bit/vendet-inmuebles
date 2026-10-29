import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { userId } = body
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    const { error } = await auth.supabaseAdmin
      .from('perfiles')
      .update({ verificado: true, verificado_desde: new Date().toISOString() })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await notifyUser(auth.supabaseAdmin, userId, {
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
