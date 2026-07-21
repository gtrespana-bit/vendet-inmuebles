import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUUIDs } from '@/lib/validation'

/**
 * Enviar reseña desde el vendedor al comprador.
 * Server-side para bypass RLS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { producto_id, evaluador_id, evaluado_id, puntuacion, comentario } = body

    // Validar UUIDs
    const uuidCheck = requireUUIDs(body, ['producto_id', 'evaluador_id', 'evaluado_id'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Invertimos: el evaluador (vendedor que vendió) reseña al evaluado (comprador)
    // Guardamos como reseña normal pero con campos invertidos
    const { error } = await supabaseAdmin.from('resenas').insert({
      producto_id,
      vendedor_id: evaluado_id,
      comprador_id: evaluador_id,
      puntuacion,
      comentario: comentario || null,
    })

    if (error) {
      if (error.code === '42P01' || error.code === '42703') {
        return NextResponse.json({ error: 'Falta columna en DB. Ejecuta: ALTER TABLE productos ADD COLUMN IF NOT EXISTS vendido BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS vendido_en TEXT, ADD COLUMN IF NOT EXISTS comprador_id UUID;', details: error.message }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notificar al comprador que el vendedor le dio reseña + invitar a que también deje la suya
    try {
      const { data: vendedor } = await supabaseAdmin
        .from('perfiles')
        .select('nombre')
        .eq('id', evaluador_id)
        .single()

      await supabaseAdmin.from('notificaciones_push').insert({
        target_user_id: evaluado_id,
        tipo: 'resena_recibida',
        titulo: `${vendedor?.nombre || 'Tu vendedor'} te dejó una reseña ⭐`,
        cuerpo: puntuacion >= 4
          ? `¡Reseña positiva! Toca aquí para ver detalles o dejar tu reseña también.`
          : `Toca aquí para ver la reseña y dejar la tuya también.`,
        click_url: `/dashboard?tab=resenas`,
      })
    } catch {
      // fail silently
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
