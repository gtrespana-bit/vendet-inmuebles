import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const tabla = searchParams.get('tabla')
    const usuario = searchParams.get('usuario')
    const operacion = searchParams.get('operacion')
    const limite = Math.min(500, Math.max(1, Number.parseInt(searchParams.get('limite') || '50', 10) || 50))
    const dias = Math.min(365, Math.max(1, Number.parseInt(searchParams.get('dias') || '30', 10) || 30))

    let query = auth.supabaseAdmin
      .from('auditoria')
      .select('*')
      .gte('fecha_registro', new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString())
      .order('fecha_registro', { ascending: false })
      .limit(limite)

    if (tabla) query = query.eq('tabla_afectada', tabla)
    if (usuario) query = query.eq('usuario_id', usuario)
    if (operacion) query = query.eq('operacion', operacion)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, data, total: data?.length || 0, filtros: { tabla, usuario, operacion, dias } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
