import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

/** Actualiza el perfil del vendedor tras una verificación aprobada por un admin. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { userId, cedula_numero, pago_movil_telefono, pago_movil_cedula, pago_movil_banco } = body
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    const updateData: Record<string, any> = {
      verificado: true,
      verificado_desde: new Date().toISOString(),
    }
    for (const [field, value] of Object.entries({ cedula_numero, pago_movil_telefono, pago_movil_cedula, pago_movil_banco })) {
      if (typeof value === 'string' && value.trim()) updateData[field] = value.trim().slice(0, 100)
    }

    const { error } = await auth.supabaseAdmin
      .from('perfiles')
      .update(updateData)
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
