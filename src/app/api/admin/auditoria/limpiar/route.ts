import { NextResponse } from 'next/server'
import { limpiarAuditoriaAntigua } from '@/lib/auditoria'

export async function POST() {
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
