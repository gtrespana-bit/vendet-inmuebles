import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServerClient()

  // Listar productos SIN slug (esa columna no existe)
  const { data: allProducts, error: allError, count } = await supabase
    .from('productos')
    .select('id, titulo, activo, operacion_tipo, ubicacion_ciudad', { count: 'exact' })
    .limit(20)

  // Test con ID real (el primero que devolvió la BD antes)
  const testId = '369f1165-344c-4b4b-954f-18c6cca67b3c'
  
  // Query simple
  const simple = await supabase
    .from('productos')
    .select('*')
    .eq('id', testId)
    .single()

  // Query con join a perfiles
  const withJoin = await supabase
    .from('productos')
    .select('*, perfiles ( id, nombre, telefono, verificado, nivel_confianza, foto_perfil_url )')
    .eq('id', testId)
    .single()

  // Verificar perfiles
  const perfilesCheck = await supabase
    .from('perfiles')
    .select('id, nombre', { count: 'exact' })

  return NextResponse.json({
    totalProducts: count,
    allError: allError?.message || null,
    products: allProducts,
    testId,
    simple: {
      data: simple.data ? { id: simple.data.id, titulo: simple.data.titulo, activo: simple.data.activo, user_id: simple.data.user_id } : null,
      error: simple.error?.message || null,
    },
    withJoin: {
      data: withJoin.data ? { id: withJoin.data.id, titulo: withJoin.data.titulo, activo: withJoin.data.activo, perfiles: (withJoin.data as any).perfiles } : null,
      error: withJoin.error?.message || null,
    },
    perfilesTable: {
      exists: !perfilesCheck.error,
      count: perfilesCheck.count || 0,
      sample: perfilesCheck.data?.[0] || null,
      error: perfilesCheck.error?.message || null,
    },
  })
}
