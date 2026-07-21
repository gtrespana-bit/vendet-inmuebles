import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { validateConversationData } from '@/lib/validation'

export async function POST(req: Request) {
  try {
    // Verify user is authenticated via cookie
    const cookieStore = await cookies()
    const authCookie = cookieStore.getAll().find(c => c.name.includes('auth-token'))
    if (!authCookie?.value) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(authCookie.value)
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const uid = parsed.user?.id
    if (!uid) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 })
    }

    const body = await req.json()
    const { vendedorId, productoId } = body

    // Validar datos de la conversación
    const validation = validateConversationData({ vendedorId, productoId })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // No permitir conversaciones consigo mismo
    if (vendedorId === uid) {
      return NextResponse.json({ error: 'No puedes iniciar conversación contigo mismo' }, { status: 400 })
    }

    // Create admin client inside function (avoids build-time env errors)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if conversation already exists
    const { data: existing } = await supabaseAdmin
      .from('conversaciones')
      .select('id')
      .or(`and(user1_id.eq.${uid},user2_id.eq.${vendedorId}),and(user1_id.eq.${vendedorId},user2_id.eq.${uid})`)
      .eq('producto_id', productoId)
      .single()

    if (existing) {
      return NextResponse.json({ id: existing.id })
    }

    // Create conversation (bypass RLS with service_role key)
    const u1 = uid < vendedorId ? uid : vendedorId
    const u2 = uid < vendedorId ? vendedorId : uid

    const { data: newConv, error } = await supabaseAdmin
      .from('conversaciones')
      .insert({ user1_id: u1, user2_id: u2, producto_id: productoId })
      .select()
      .single()

    if (error) {
      console.error('Error creando conversación:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(newConv)
  } catch (e: any) {
    console.error('Error en crear-conversacion:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
