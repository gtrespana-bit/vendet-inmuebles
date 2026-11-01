import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isPlanName } from '@/lib/plan-catalog'
export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    if (body.modo === 'prueba') {
      if (!isPlanName(body.plan)) return NextResponse.json({error:'Plan inválido'},{status:400})
      const {data,error} = await auth.supabaseAdmin.rpc('cambiar_plan_prueba',{p_user:auth.user.id,p_plan:body.plan})
      if (error) return NextResponse.json({error:error.message},{status:409})
      return NextResponse.json({fecha:data,plan:body.plan})
    }
    if (body.plan !== 'gratuita' || typeof body.cancelar !== 'boolean') return NextResponse.json({ error: 'Cambio inválido' }, { status: 400 })
    const { data, error } = await auth.supabaseAdmin.rpc('programar_plan_gratuito', { p_user: auth.user.id, p_cancelar: body.cancelar })
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ fecha: data })
  } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }
}
