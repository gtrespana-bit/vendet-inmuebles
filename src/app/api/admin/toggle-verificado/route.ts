import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { userId, verificado } = body
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    if (typeof verificado !== 'boolean') {
      return NextResponse.json({ error: 'verificado debe ser boolean' }, { status: 400 })
    }

    const { error } = await auth.supabaseAdmin
      .from('perfiles')
      .update({
        verificado,
        verificado_desde: verificado ? new Date().toISOString() : null,
      })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await notifyUser(auth.supabaseAdmin, userId, {
      title: verificado ? '✅ Perfil verificado' : '❌ Verificación revocada',
      body: verificado ? 'Tu perfil ya está verificado en Venezuela Inmuebles.' : 'Tu perfil ya no está verificado en Venezuela Inmuebles.',
      tag: verificado ? 'verified' : 'verified-revoked',
      icon: '/icon-192.png',
      click_url: '/dashboard',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
