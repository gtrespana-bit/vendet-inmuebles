import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServerClient()

  // Listar TODOS los productos (sin filtro de ID)
  const { data: allProducts, error: allError, count } = await supabase
    .from('productos')
    .select('id, titulo, activo, slug, operacion_tipo, ubicacion_ciudad', { count: 'exact' })
    .limit(20)

  // Verificar columnas de la tabla
  const { data: firstRow, error: firstError } = await supabase
    .from('productos')
    .select('*')
    .limit(1)

  const columns = firstRow && firstRow.length > 0 ? Object.keys(firstRow[0]) : []

  // Test con el primer ID real (si existe)
  let singleTest: any = { data: null, error: null }
  if (allProducts && allProducts.length > 0) {
    const testId = allProducts[0].id
    const { data, error } = await supabase
      .from('productos')
      .select('*, perfiles ( id, nombre, telefono, verificado, nivel_confianza, foto_perfil_url )')
      .eq('id', testId)
      .single()
    singleTest = {
      testId,
      data: data ? { id: data.id, titulo: data.titulo, activo: data.activo, has_perfiles: !!(data as any).perfiles } : null,
      error: error?.message || null,
    }
  }

  return NextResponse.json({
    totalProducts: count,
    allError: allError?.message || null,
    products: allProducts,
    columns,
    firstRowSample: firstRow?.[0] ? { ...firstRow[0], descripcion: firstRow[0].descripcion?.substring(0, 50) } : null,
    singleTest,
  })
}
