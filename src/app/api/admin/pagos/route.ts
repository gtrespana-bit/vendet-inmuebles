import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response
  const { data, error } = await auth.supabaseAdmin.from('ordenes_pago').select('*, intentos_pago(*)').order('creada_en', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'No se pudieron consultar los pagos' }, { status: 500 })
  const orders = await Promise.all((data || []).map(async order => ({ ...order,
    intentos_pago: await Promise.all((order.intentos_pago || []).map(async (attempt: any) => {
      const { data: signed } = await auth.supabaseAdmin.storage.from('justificantes-pagos').createSignedUrl(attempt.ruta, 300)
      return { ...attempt, url: signed?.signedUrl }
    })),
  })))
  return NextResponse.json({ orders }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    if (!isValidUUID(body.id) || typeof body.confirmar !== 'boolean' || typeof body.nota !== 'string') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const { data, error } = await auth.supabaseAdmin.rpc('revisar_orden_pago', { p_id: body.id, p_admin: auth.user.id, p_confirmar: body.confirmar, p_nota: body.nota.slice(0,1000) })
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ state: data })
  } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }
}
