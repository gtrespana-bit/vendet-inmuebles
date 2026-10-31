import { registrarEvento, rutaDesdeReferer } from '@/lib/analytics-server'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { vendedorId, productoId } = body
    if (!isValidUUID(vendedorId) || !isValidUUID(productoId)) {
      return NextResponse.json({ error: 'Vendedor o inmueble inválido' }, { status: 400 })
    }
    if (vendedorId === auth.user.id) {
      return NextResponse.json({ error: 'No puedes iniciar una conversación contigo mismo' }, { status: 400 })
    }

    const rateLimit = await checkRateLimit('conversacion:create', auth.user.id, {
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    })
    if (!rateLimit.ok) return NextResponse.json({ error: 'Demasiadas conversaciones nuevas' }, { status: 429 })

    const { data: property, error: propertyError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id, activo, vendido, estado_moderacion')
      .eq('id', productoId)
      .maybeSingle()
    if (propertyError) return NextResponse.json({ error: propertyError.message }, { status: 500 })
    if (!property || property.usuario_id !== vendedorId || !property.activo || property.vendido || property.estado_moderacion !== 'aprobado') {
      return NextResponse.json({ error: 'Inmueble no disponible' }, { status: 404 })
    }

    const user1Id = auth.user.id < vendedorId ? auth.user.id : vendedorId
    const user2Id = auth.user.id < vendedorId ? vendedorId : auth.user.id
    const { data: existing, error: existingError } = await auth.supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id, producto_id')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .eq('producto_id', productoId)
      .maybeSingle()
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if (existing) return NextResponse.json(existing)

    const { data: conversation, error } = await auth.supabaseAdmin
      .from('conversaciones')
      .insert({ user1_id: user1Id, user2_id: user2Id, producto_id: productoId })
      .select('id, user1_id, user2_id, producto_id')
      .single()
    if (error?.code === '23505') {
      const { data: duplicate } = await auth.supabaseAdmin
        .from('conversaciones')
        .select('id, user1_id, user2_id, producto_id')
        .eq('user1_id', user1Id)
        .eq('user2_id', user2Id)
        .eq('producto_id', productoId)
        .maybeSingle()
      if (duplicate) return NextResponse.json(duplicate)
    }
    if (error || !conversation) return NextResponse.json({ error: error?.message || 'No se pudo crear la conversación' }, { status: 500 })
    void registrarEvento('inicio_chat', {
      ruta: '/chat',
      meta: { conversacion_id: conversation.id, producto_id: productoId },
      userId: auth.user.id,
      req,
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
