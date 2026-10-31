import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/** GET /api/admin/analytics/actividad — datos agregados de analítica interna (solo admin). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const sp = new URL(req.url).searchParams
  const limite = Math.min(200, Math.max(1, parseInt(sp.get('limite') || '50', 10) || 50))
  const value = limite
  const { data, error } = await auth.supabaseAdmin.rpc('admin_analytics_actividad', { p_limite: value })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}
