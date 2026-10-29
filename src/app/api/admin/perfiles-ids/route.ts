import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'

/** Obtiene perfiles para la vista de verificación; sólo accesible al administrador. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const userIds = body.userIds
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 100 || userIds.some((id: unknown) => typeof id !== 'string' || !isValidUUID(id))) {
      return NextResponse.json({ error: 'userIds inválido (máximo 100 UUIDs)' }, { status: 400 })
    }

    const { data: perfiles, error } = await auth.supabaseAdmin
      .from('perfiles')
      .select('id, nombre, telefono, cedula_numero, pago_movil_telefono, pago_movil_cedula, pago_movil_banco')
      .in('id', userIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, perfiles })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
