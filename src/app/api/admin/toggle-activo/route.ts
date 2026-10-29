import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    if (typeof body.activo !== 'boolean') {
      return NextResponse.json({ error: 'activo debe ser boolean' }, { status: 400 })
    }

    const { error } = await auth.supabaseAdmin
      .from('inmuebles')
      .update({ activo: body.activo })
      .eq('id', body.productId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/')
    revalidatePath('/catalogo')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
