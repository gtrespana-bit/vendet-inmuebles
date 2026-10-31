import { NextResponse } from 'next/server'

// Datos de Pago Móvil PUBLICABLES (teléfono, cédula y banco del receptor).
// Se configuran por variables de entorno del servidor (nunca en el código fuente
// ni en variables NEXT_PUBLIC_ del bundle del cliente).
export const dynamic = 'force-dynamic'

export async function GET() {
  const pagoMovil = {
    telefono: process.env.PAGO_MOVIL_TELEFONO?.trim() || '',
    cedula: process.env.PAGO_MOVIL_CEDULA?.trim() || '',
    banco: process.env.PAGO_MOVIL_BANCO?.trim() || '',
  }

  if (!pagoMovil.telefono || !pagoMovil.cedula || !pagoMovil.banco) {
    return NextResponse.json(
      { error: 'Datos de pago no configurados' },
      { status: 503 }
    )
  }

  return NextResponse.json({ pagoMovil })
}
