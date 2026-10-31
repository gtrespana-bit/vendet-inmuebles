import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'
import { notificarPropiedadBoost } from '@/lib/email-eventos'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    const { data: product, error: productError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('usuario_id, titulo, slug')
      .eq('id', body.productId)
      .maybeSingle()
    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })

    const { error } = await auth.supabaseAdmin
      .from('inmuebles')
      .update({ boosteado_en: new Date().toISOString() })
      .eq('id', body.productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await notificarPropiedadBoost(auth.supabaseAdmin, {
      usuarioId: product.usuario_id,
      titulo: product.titulo,
      slug: product.slug,
    })

    revalidatePath('/')
    revalidatePath('/catalogo')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
