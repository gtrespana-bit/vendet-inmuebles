import { NextRequest, NextResponse } from 'next/server'
import { obtenerResumenAuditoria } from '@/lib/auditoria'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dias = parseInt(searchParams.get('dias') || '7')

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
