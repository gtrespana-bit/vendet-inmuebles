import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    if (body.plan !== 'gratuita' || typeof body.cancelar !== 'boolean') return NextResponse.json({ error: 'Cambio inválido' }, { status: 400 })
    const { data, error } = await auth.supabaseAdmin.rpc('programar_plan_gratuito', { p_user: auth.user.id, p_cancelar: body.cancelar })
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ fecha: data })
  } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }
}
