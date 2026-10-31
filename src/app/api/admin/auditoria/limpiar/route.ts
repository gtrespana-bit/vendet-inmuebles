import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { limpiarAuditoriaAntigua } from '@/lib/auditoria'

export const dynamic = 'force-dynamic'

// Solo administradores: usa la service role key para ejecutar el RPC de limpieza.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const resultado = await limpiarAuditoriaAntigua()

    if (resultado.error) {
      return NextResponse.json(
        { error: resultado.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      eliminados: resultado.eliminados,
      mensaje: `Se eliminaron ${resultado.eliminados} registros antiguos`
    })
  } catch (e: any) {
    console.error('Error en limpiar auditoria:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
