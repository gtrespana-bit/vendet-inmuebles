import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') || '3f4c55e8-06c0-448e-9077-78046971b10f'

  const supabase = createServerClient()

  // Query 1: Simple (sin join)
  const simple = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .single()

  // Query 2: Con join a perfiles (la que usa la página)
  const withJoin = await supabase
    .from('productos')
    .select(`
      *,
      perfiles (
        id,
        nombre,
        telefono,
        verificado,
        nivel_confianza,
        foto_perfil_url
      )
    `)
    .eq('id', id)
    .single()

  // Query 3: Verificar si existe tabla perfiles
  const perfilesCheck = await supabase
    .from('perfiles')
    .select('id', { count: 'exact', head: true })

  return NextResponse.json({
    id,
    simple: {
      data: simple.data ? { id: simple.data.id, titulo: simple.data.titulo, activo: simple.data.activo } : null,
      error: simple.error?.message || null,
    },
    withJoin: {
      data: withJoin.data ? { id: withJoin.data.id, titulo: withJoin.data.titulo, activo: withJoin.data.activo, has_perfiles: !!withJoin.data.perfiles } : null,
      error: withJoin.error?.message || null,
    },
    perfilesTable: {
      exists: !perfilesCheck.error,
      count: perfilesCheck.count || 0,
      error: perfilesCheck.error?.message || null,
    },
  })
}
