import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { conversacion_id, destinatario_id } = body
    if (!isValidUUID(conversacion_id) || destinatario_id !== auth.user.id) {
      return NextResponse.json({ error: 'Datos inválidos o no autorizados' }, { status: 400 })
    }

    const { data: conversation, error: conversationError } = await auth.supabaseAdmin
      .from('conversaciones')
      .select('user1_id, user2_id')
      .eq('id', conversacion_id)
      .maybeSingle()
    if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 })
    if (!conversation || ![conversation.user1_id, conversation.user2_id].includes(auth.user.id)) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    const { count, error: countError } = await auth.supabaseAdmin
      .from('mensajes')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', conversacion_id)
      .eq('destinatario_id', auth.user.id)
      .eq('leido', false)
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

    const { error } = await auth.supabaseAdmin
      .from('mensajes')
      .update({ leido: true })
      .eq('conversacion_id', conversacion_id)
      .eq('destinatario_id', auth.user.id)
      .eq('leido', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ affected: count || 0 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
