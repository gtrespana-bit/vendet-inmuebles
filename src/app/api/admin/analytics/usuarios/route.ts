import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/** GET /api/admin/analytics/usuarios — datos agregados de analítica interna (solo admin). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const sp = new URL(req.url).searchParams
  const dias = Math.min(365, Math.max(1, parseInt(sp.get('dias') || '30', 10) || 30))
  const value = dias
  const { data, error } = await auth.supabaseAdmin.rpc('admin_analytics_usuarios', { p_dias: value })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
