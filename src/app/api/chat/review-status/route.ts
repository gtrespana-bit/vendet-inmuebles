import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { verificarElegibilidadResena } from '@/lib/reviews-server'

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
      .select('id, user1_id, user2_id, producto_id, agente_asignado_id')
      .eq('id', convId)
      .maybeSingle()
    if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 })
    if (!conversation || ![conversation.user1_id, conversation.user2_id].includes(auth.user.id)) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }
    if (!conversation.producto_id) {
      return NextResponse.json({ productoOwnerId: null, puedeResenar: false, yaDejoResena: false })
    }

    const otherUserId =
      conversation.user1_id === auth.user.id ? conversation.user2_id : conversation.user1_id

    const { data: inmueble, error: inmuebleError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id, agente_asignado_id, activo, vendido')
      .eq('id', conversation.producto_id)
      .maybeSingle()
    if (inmuebleError) return NextResponse.json({ error: inmuebleError.message }, { status: 500 })
    if (!inmueble) return NextResponse.json({ productoOwnerId: null, puedeResenar: false, yaDejoResena: false })

    const esVendedor =
      auth.user.id === inmueble.usuario_id || auth.user.id === inmueble.agente_asignado_id
    if (esVendedor) {
      return NextResponse.json({
        productoOwnerId: auth.user.id,
        puedeResenar: false,
        yaDejoResena: false,
        esVendedor: true,
      })
    }

    const check = await verificarElegibilidadResena(auth.supabaseAdmin, {
      propertyId: inmueble.id,
      buyerId: auth.user.id,
      preferredSellerId: otherUserId,
    })

    return NextResponse.json({
      productoOwnerId: check.targetSellerId || otherUserId,
      productoId: inmueble.id,
      productoVendido: Boolean(inmueble.vendido || !inmueble.activo),
      tipoInteraccion: check.interactionType,
      puedeResenar: check.eligible,
      yaDejoResena: check.alreadyReviewed,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
