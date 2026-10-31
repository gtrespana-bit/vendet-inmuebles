import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { obtenerResumenAuditoria } from '@/lib/auditoria'

export const dynamic = 'force-dynamic'

// Solo administradores: el resumen se calcula con la service role key (bypassa RLS).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const diasParam = parseInt(searchParams.get('dias') || '7')
    const dias = Number.isFinite(diasParam) ? Math.min(Math.max(diasParam, 1), 365) : 7

    const resumen = await obtenerResumenAuditoria(dias)

    return NextResponse.json({
      ok: true,
      ...resumen
    })
  } catch (e: any) {
    console.error('Error en resumen auditoria:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
