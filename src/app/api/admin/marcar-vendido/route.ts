import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { notificarPropiedadVendida } from '@/lib/email-eventos'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { productoId, userId, vendidoEn, compradorId } = body
    if (!isValidUUID(productoId)) return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
    if (userId !== auth.user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (compradorId && (!isValidUUID(compradorId) || compradorId === auth.user.id)) {
      return NextResponse.json({ error: 'compradorId inválido' }, { status: 400 })
    }

    const fuenteVenta = ['plataforma', 'otra_pagina', 'no_especificado'].includes(vendidoEn)
      ? vendidoEn
      : 'no_especificado'

    const { data: inmueble, error: fetchError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id, vendido, titulo')
      .eq('id', productoId)
      .maybeSingle()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!inmueble || inmueble.usuario_id !== auth.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (inmueble.vendido) return NextResponse.json({ error: 'El inmueble ya está marcado como vendido' }, { status: 400 })

    const updateData: Record<string, any> = {
      activo: false,
      vendido: true,
      vendido_en: fuenteVenta,
      comprador_id: compradorId || null,
    }
    const { error: updateError } = await auth.supabaseAdmin
      .from('inmuebles')
      .update(updateData)
      .eq('id', productoId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    await notificarPropiedadVendida(auth.supabaseAdmin, {
      usuarioId: inmueble.usuario_id,
      titulo: inmueble.titulo || 'tu inmueble',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('productoId')
    const userId = searchParams.get('userId')
    if (!productoId || !isValidUUID(productoId) || userId !== auth.user.id) {
      return NextResponse.json({ error: 'Datos incompletos o no autorizados' }, { status: 400 })
    }

    const { data: inmueble, error: inmuebleError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id')
      .eq('id', productoId)
      .maybeSingle()
    if (inmuebleError) return NextResponse.json({ error: inmuebleError.message }, { status: 500 })
    if (!inmueble || inmueble.usuario_id !== auth.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { data: conversaciones, error: conversacionesError } = await auth.supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id')
      .eq('producto_id', productoId)
    if (conversacionesError) return NextResponse.json({ error: conversacionesError.message }, { status: 500 })

    const compradorIds = new Set<string>()
    for (const conv of conversaciones || []) {
      if (conv.user1_id === auth.user.id && conv.user2_id !== auth.user.id) compradorIds.add(conv.user2_id)
      if (conv.user2_id === auth.user.id && conv.user1_id !== auth.user.id) compradorIds.add(conv.user1_id)
    }
    if (compradorIds.size === 0) return NextResponse.json({ ok: true, interesados: [] })

    const ids = Array.from(compradorIds)
    const [{ data: perfiles, error: perfilesError }, { data: mensajes, error: mensajesError }] = await Promise.all([
      auth.supabaseAdmin.from('perfiles').select('id, nombre').in('id', ids),
      auth.supabaseAdmin.from('mensajes')
        .select('remitente_id, contenido, creado_en')
        .in('remitente_id', ids)
        .order('creado_en', { ascending: false }),
    ])
    if (perfilesError) return NextResponse.json({ error: perfilesError.message }, { status: 500 })
    if (mensajesError) return NextResponse.json({ error: mensajesError.message }, { status: 500 })

    const ultimoMensaje = new Map<string, string>()
    for (const mensaje of mensajes || []) {
      if (!ultimoMensaje.has(mensaje.remitente_id)) {
        ultimoMensaje.set(mensaje.remitente_id, (mensaje.contenido || '').slice(0, 60))
      }
    }

    const interesados = (perfiles || []).map(perfil => ({
      userId: perfil.id,
      nombre: perfil.nombre || 'Usuario',
      ultimoMensaje: ultimoMensaje.get(perfil.id) || '',
    }))
    return NextResponse.json({ ok: true, interesados })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
