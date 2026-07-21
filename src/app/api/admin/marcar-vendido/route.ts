import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productoId, userId, vendidoEn, compradorId } = body

    // Validar UUIDs
    const uuidCheck = requireUUIDs(body, ['productoId', 'userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    // compradorId es opcional pero si existe debe ser válido
    if (compradorId && !requireUUIDs({ compradorId }, ['compradorId']).valid) {
      return NextResponse.json({ error: 'compradorId inválido' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )


    const { data: producto } = await supabaseAdmin.from('productos').select('user_id, activo, vendido').eq('id', productoId).single() as any


    if (!producto || producto.user_id !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }


    if (producto.vendido) {
      return NextResponse.json({ error: 'El producto ya estÃ¡ marcado como vendido' }, { status: 400 })
    }

    const updateData: Record<string, string | boolean | null> = {
      activo: false,
      vendido: true,
      vendido_en: vendidoEn || 'no_especificado',
    }
    if (compradorId) {
      updateData.comprador_id = compradorId
    }

    const { error } = await supabaseAdmin
      .from('productos')
      .update(updateData)
      .eq('id', productoId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('productoId')
    const userId = searchParams.get('userId')

    if (!productoId || !userId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )


    const { data: producto } = await supabaseAdmin.from('productos').select('user_id').eq('id', productoId).single() as any

    if (!producto || producto.user_id !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Buscar conversaciones de este producto

    const { data: conversacionesList }: { data: any[] | null } = await supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id')
      .eq('producto_id', productoId)

    if (!conversacionesList || conversacionesList.length === 0) {
      return NextResponse.json({ ok: true, interesados: [] })
    }

    const compradorIds = new Set<string>()

    for (const conv of conversacionesList as any[]) {
      const u1: string | null = conv.user1_id || null
      const u2: string | null = conv.user2_id || null
      if (u1 === userId && u2 && u2 !== userId) {
        compradorIds.add(u2)
      } else if (u2 === userId && u1 && u1 !== userId) {
        compradorIds.add(u1)
      }
    }

    if (compradorIds.size === 0) {
      return NextResponse.json({ ok: true, interesados: [] })
    }

    const idsArray = Array.from(compradorIds)


    const { data: perfiles } = await supabaseAdmin.from('perfiles').select('id, nombre').in('id', idsArray) as { data: { id: string; nombre: string | null }[] | null }

    const { data: ultimosMensajes } = await supabaseAdmin.from('mensajes').select('remitente_id, contenido').in('remitente_id', idsArray).order('creado_en', { ascending: false }) as { data: { remitente_id: string; contenido: string | null }[] | null }


    const ultimoMsgMap = new Map<string, string>()
    if (ultimosMensajes) {

      for (const m of ultimosMensajes as any[]) {
        if (!ultimoMsgMap.has(m.remitente_id)) {
          ultimoMsgMap.set(m.remitente_id, m.contenido ? m.contenido.substring(0, 60) : '')
        }
      }
    }


    const interesados = (perfiles || []).map((p: any) => ({
      userId: p.id,
      nombre: p.nombre || 'Usuario',
      ultimoMensaje: ultimoMsgMap.get(p.id) || '',
    }))

    return NextResponse.json({ ok: true, interesados })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
