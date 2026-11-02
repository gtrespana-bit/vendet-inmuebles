import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { notificarResena } from '@/lib/email-eventos'
import { verificarElegibilidadResena } from '@/lib/reviews-server'

/**
 * Envía una reseña verificada entre las partes de una interacción inmobiliaria real
 * (visita confirmada, conversación bidireccional o cierre de operación).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { producto_id, evaluador_id, evaluado_id, puntuacion, comentario } = body
    if (![producto_id, evaluador_id, evaluado_id].every(isValidUUID)) {
      return NextResponse.json({ error: 'Identificadores inválidos' }, { status: 400 })
    }
    if (evaluador_id !== auth.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const rating = Number(puntuacion)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'La puntuación debe estar entre 1 y 5' }, { status: 400 })
    }
    if (comentario !== undefined && comentario !== null && typeof comentario !== 'string') {
      return NextResponse.json({ error: 'Comentario inválido' }, { status: 400 })
    }

    const { data: inmueble, error: inmuebleError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id, agente_asignado_id, vendido')
      .eq('id', producto_id)
      .maybeSingle()
    if (inmuebleError) return NextResponse.json({ error: inmuebleError.message }, { status: 500 })
    if (!inmueble) return NextResponse.json({ error: 'Inmueble no encontrado' }, { status: 404 })

    const isSellerCaller =
      auth.user.id === inmueble.usuario_id || auth.user.id === inmueble.agente_asignado_id

    let vendedorId = evaluado_id
    let compradorId = auth.user.id
    let tipoInteraccion: 'visita_confirmada' | 'conversacion' | 'cierre_operacion' = 'conversacion'
    let visitId: string | null = null

    if (isSellerCaller) {
      // Flujo desde "Marcar como vendido" en TabProductos
      vendedorId = auth.user.id
      compradorId = evaluado_id
      if (compradorId === vendedorId) {
        return NextResponse.json({ error: 'No puedes evaluarte a ti mismo' }, { status: 400 })
      }
      const [u1, u2] = [auth.user.id, compradorId].sort()
      const { data: conversation } = await auth.supabaseAdmin
        .from('conversaciones')
        .select('id')
        .eq('producto_id', producto_id)
        .eq('user1_id', u1)
        .eq('user2_id', u2)
        .maybeSingle()

      if (!conversation) {
        return NextResponse.json(
          { error: 'Sólo puedes reseñar a quien conversó contigo sobre este inmueble' },
          { status: 403 },
        )
      }
      tipoInteraccion = inmueble.vendido ? 'cierre_operacion' : 'conversacion'
    } else {
      const check = await verificarElegibilidadResena(auth.supabaseAdmin, {
        propertyId: producto_id,
        buyerId: auth.user.id,
        preferredSellerId: evaluado_id,
      })
      if (check.alreadyReviewed) {
        return NextResponse.json({ error: 'Ya existe una reseña para esta operación' }, { status: 409 })
      }
      if (!check.eligible || !check.targetSellerId || !check.interactionType) {
        return NextResponse.json(
          { error: check.reason || 'Interacción verificada requerida para reseñar' },
          { status: 403 },
        )
      }
      vendedorId = check.targetSellerId
      compradorId = auth.user.id
      tipoInteraccion = check.interactionType
      visitId = check.visitId
    }

    const cleanComment =
      typeof comentario === 'string' ? comentario.trim().slice(0, 2000) || null : null

    const { error } = await auth.supabaseAdmin.from('resenas').insert({
      producto_id,
      vendedor_id: vendedorId,
      comprador_id: compradorId,
      puntuacion: rating,
      comentario: cleanComment,
      tipo_interaccion: tipoInteraccion,
      solicitud_visita_id: visitId,
    })
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe una reseña para esta operación' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const notifyTarget = isSellerCaller ? compradorId : vendedorId
    await notifyUser(auth.supabaseAdmin, notifyTarget, {
      title: '⭐ Recibiste una reseña verificada',
      body: `Tienes una nueva calificación (${rating}/5) en Venezuela Inmuebles.`,
      tag: 'resena',
      icon: '/icon-192.png',
      click_url: '/dashboard?tab=reputacion',
    })
    await notificarResena(auth.supabaseAdmin, {
      evaluadoId: notifyTarget,
      autorId: auth.user.id,
      puntuacion: rating,
      comentario: cleanComment,
      productoId: producto_id,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
