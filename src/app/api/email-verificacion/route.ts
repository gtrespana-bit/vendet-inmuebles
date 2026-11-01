import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { notificarVerificacion } from '@/lib/email-eventos'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const { userId } = await req.json()
    if (!isValidUUID(userId)) {
      return NextResponse.json({ ok: false, error: 'userId inválido' }, { status: 400 })
    }

    await notificarVerificacion(auth.supabaseAdmin, userId, true)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
