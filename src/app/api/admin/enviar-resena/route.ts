import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { notificarResena } from '@/lib/email-eventos'

/** Envía una reseña únicamente entre participantes de una conversación del inmueble. */
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
      .select('usuario_id')
      .eq('id', producto_id)
      .maybeSingle()
    if (inmuebleError) return NextResponse.json({ error: inmuebleError.message }, { status: 500 })
    if (!inmueble) return NextResponse.json({ error: 'Inmueble no encontrado' }, { status: 404 })

    const vendedorId = inmueble.usuario_id
    const compradorId = vendedorId === auth.user.id ? evaluado_id : auth.user.id
    const otraParteId = vendedorId === auth.user.id ? evaluado_id : vendedorId
    if (otraParteId === auth.user.id || (vendedorId !== auth.user.id && evaluado_id !== vendedorId)) {
      return NextResponse.json({ error: 'La reseña no corresponde a las partes de este inmueble' }, { status: 400 })
    }

    const [user1Id, user2Id] = [auth.user.id, otraParteId].sort()
    const { data: conversation, error: conversationError } = await auth.supabaseAdmin
      .from('conversaciones')
      .select('id')
      .eq('producto_id', producto_id)
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .maybeSingle()
    if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 })
    if (!conversation) return NextResponse.json({ error: 'Sólo puedes reseñar a quien conversó contigo sobre este inmueble' }, { status: 403 })

    const { error } = await auth.supabaseAdmin.from('resenas').insert({
      producto_id,
      vendedor_id: vendedorId,
      comprador_id: compradorId,
      puntuacion: rating,
      comentario: typeof comentario === 'string' ? comentario.trim().slice(0, 2000) || null : null,
    })
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe una reseña para esta operación' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await notifyUser(auth.supabaseAdmin, evaluado_id, {
      title: '⭐ Recibiste una reseña',
      body: `Tienes una nueva reseña sobre "${inmueble.usuario_id === auth.user.id ? 'tu comprador' : 'tu vendedor'}".`,
      tag: 'resena',
      icon: '/icon-192.png',
      click_url: '/dashboard?tab=resenas',
    })
    await notificarResena(auth.supabaseAdmin, {
      evaluadoId: evaluado_id,
      autorId: auth.user.id,
      puntuacion: rating,
      comentario: typeof comentario === 'string' ? comentario.trim() || null : null,
      productoId: producto_id,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
