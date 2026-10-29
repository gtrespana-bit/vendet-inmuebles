import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  const requestedIds = Array.from(new Set((req.nextUrl.searchParams.get('ids') || '')
    .split(',')
    .filter(isValidUUID)))
    .slice(0, 100)
  if (requestedIds.length === 0) return NextResponse.json({ profiles: [] })

  const { data: conversations, error: conversationError } = await auth.supabaseAdmin
    .from('conversaciones')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${auth.user.id},user2_id.eq.${auth.user.id}`)
  if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 })

  const allowed = new Set<string>()
  for (const conversation of conversations || []) {
    if (conversation.user1_id === auth.user.id) allowed.add(conversation.user2_id)
    if (conversation.user2_id === auth.user.id) allowed.add(conversation.user1_id)
  }
  const ids = requestedIds.filter(id => allowed.has(id))
  if (ids.length === 0) return NextResponse.json({ profiles: [] })

  const { data, error } = await auth.supabaseAdmin
    .from('perfiles')
    .select('id, nombre, foto_perfil_url')
    .in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profiles: data || [] })
}
