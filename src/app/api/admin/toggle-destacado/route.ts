import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { notifyUser } from '@/lib/push-notify'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { productId, destacado } = body
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    if (typeof destacado !== 'boolean') {
      return NextResponse.json({ error: 'destacado debe ser boolean' }, { status: 400 })
    }

    const { data: product, error: productError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('usuario_id, titulo')
      .eq('id', productId)
      .maybeSingle()
    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })

    const update = {
      destacado,
      destacado_hasta: destacado ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null,
    }
    const { error } = await auth.supabaseAdmin
      .from('inmuebles')
      .update(update)
      .eq('id', productId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/')
    revalidatePath('/catalogo')

    if (destacado) {
      await notifyUser(auth.supabaseAdmin, product.usuario_id, {
        title: '⭐ Inmueble destacado',
        body: `"${product.titulo}" ahora está destacado y llegará a más compradores.`,
        tag: 'destacado',
        icon: '/icon-192.png',
        click_url: `/inmueble/${productId}`,
      })
    }

    return NextResponse.json({ ok: true, update })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
