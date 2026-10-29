import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { convId, userId } = body
    if (!isValidUUID(convId) || userId !== auth.user.id) {
      return NextResponse.json({ error: 'Datos inválidos o no autorizados' }, { status: 400 })
    }

    const { data: conversation, error: conversationError } = await auth.supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id, producto_id')
      .eq('id', convId)
      .maybeSingle()
    if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 })
    if (!conversation || ![conversation.user1_id, conversation.user2_id].includes(auth.user.id)) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }
    if (!conversation.producto_id) {
      return NextResponse.json({ productoOwnerId: null, puedeResenar: false, yaDejoResena: false })
    }

    const { data: inmueble, error: inmuebleError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id, activo, vendido')
      .eq('id', conversation.producto_id)
      .maybeSingle()
    if (inmuebleError) return NextResponse.json({ error: inmuebleError.message }, { status: 500 })
    if (!inmueble) return NextResponse.json({ productoOwnerId: null, puedeResenar: false, yaDejoResena: false })

    const productoOwnerId = inmueble.usuario_id
    const esVendedor = auth.user.id === productoOwnerId
    if (esVendedor) {
      return NextResponse.json({ productoOwnerId, puedeResenar: false, yaDejoResena: false, esVendedor: true })
    }

    const { count, error: reviewError } = await auth.supabaseAdmin
      .from('resenas')
      .select('id', { count: 'exact', head: true })
      .eq('comprador_id', auth.user.id)
      .eq('vendedor_id', productoOwnerId)
      .eq('producto_id', inmueble.id)
    if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 })

    const yaDejoResena = (count || 0) > 0
    const productoVendido = inmueble.vendido || !inmueble.activo
    return NextResponse.json({
      productoOwnerId,
      productoId: inmueble.id,
      productoVendido,
      puedeResenar: productoVendido && !yaDejoResena,
      yaDejoResena,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
