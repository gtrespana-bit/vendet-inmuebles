// API: GET /api/tasa-bcv
// Devuelve la tasa USD→Bs. con cache de 1 hora.
import { NextResponse } from 'next/server'
import { getTasaBCV } from '@/lib/tasaBCV'

export const revalidate = 3600

export async function GET() {
  const tasa = await getTasaBCV()
  return NextResponse.json(tasa)
}
