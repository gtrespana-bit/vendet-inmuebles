import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { conversacion_id, destinatario_id } = await req.json()
  if (!conversacion_id || !destinatario_id) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Contar primero
  const { count } = await sb
    .from('mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('conversacion_id', conversacion_id)
    .eq('destinatario_id', destinatario_id)
    .eq('leido', false)

  // Marcar como leidos
  const { error } = await sb
    .from('mensajes')
    .update({ leido: true })
    .eq('conversacion_id', conversacion_id)
    .eq('destinatario_id', destinatario_id)
    .eq('leido', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ affected: count })
}
