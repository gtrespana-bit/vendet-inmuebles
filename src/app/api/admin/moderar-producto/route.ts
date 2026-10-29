import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { productId, action } = body
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    if (!['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const updateData = action === 'aprobar'
      ? { estado_moderacion: 'aprobado', motivo_moderacion: null, activo: true }
      : { estado_moderacion: 'rechazado', motivo_moderacion: 'Bloqueado por administración', activo: false }

    const { error } = await auth.supabaseAdmin
      .from('inmuebles')
      .update(updateData)
      .eq('id', productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/')
    revalidatePath('/catalogo')
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
