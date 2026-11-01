import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const ESTADOS_PENDIENTES = ['revision', 'provisional', 'bloqueada'] as const
const FILTROS_VALIDOS = ['pendientes', 'todas', 'creada', 'revision', 'provisional', 'bloqueada', 'confirmada', 'rechazada'] as const

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  const params = req.nextUrl.searchParams
  const firmarId = params.get('firmar')?.trim() || ''

  // Firma bajo demanda de un único intento privado (evita firmar cientos de comprobantes en cada carga — F15).
  if (firmarId) {
    if (!isValidUUID(firmarId)) {
      return NextResponse.json({ error: 'Identificador de intento inválido' }, { status: 400 })
    }
    const { data: intento, error: intentoError } = await auth.supabaseAdmin
      .from('intentos_pago')
      .select('id, ruta')
      .eq('id', firmarId)
      .maybeSingle()
    if (intentoError || !intento?.ruta) {
      return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })
    }
    const { data: signed, error: signError } = await auth.supabaseAdmin
      .storage
      .from('justificantes-pagos')
      .createSignedUrl(intento.ruta, 300)
    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo generar el enlace temporal' }, { status: 500 })
    }
    return NextResponse.json({ url: signed.signedUrl }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const estadoParam = params.get('estado')?.trim() || 'pendientes'
  const estado = (FILTROS_VALIDOS as readonly string[]).includes(estadoParam) ? estadoParam : 'pendientes'
  const q = (params.get('q') || '').trim().slice(0, 120)
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get('limit') || '25', 10) || 25))
  const offset = Math.max(0, Number.parseInt(params.get('offset') || '0', 10) || 0)

  let ordenesPorReferencia: string[] | null = null
  if (q && !isValidUUID(q)) {
    const cleanRef = q.replace(/[%_]/g, '')
    if (cleanRef.length >= 2) {
      const { data: intentosMatch, error: refError } = await auth.supabaseAdmin
        .from('intentos_pago')
        .select('orden_id')
        .ilike('referencia', `%${cleanRef}%`)
        .limit(200)
      if (refError) {
        return NextResponse.json({ error: 'No se pudo buscar por referencia' }, { status: 500 })
      }
      ordenesPorReferencia = Array.from(new Set((intentosMatch || []).map((r: any) => r.orden_id).filter(Boolean)))
      if (ordenesPorReferencia.length === 0) {
        return NextResponse.json({ orders: [], total: 0, offset, limit }, { headers: { 'Cache-Control': 'no-store' } })
      }
    }
  }

  let query = auth.supabaseAdmin
    .from('ordenes_pago')
    .select('*, intentos_pago(*)', { count: 'exact' })

  if (estado === 'pendientes') {
    query = query.in('estado', [...ESTADOS_PENDIENTES])
  } else if (estado !== 'todas') {
    query = query.eq('estado', estado)
  }

  if (q) {
    if (isValidUUID(q)) {
      query = query.or(`id.eq.${q},user_id.eq.${q}`)
    } else if (ordenesPorReferencia) {
      query = query.in('id', ordenesPorReferencia)
    }
  }

  // Las pendientes se priorizan por antigüedad (las más antiguas primero) para que
  // ningún pago quede oculto detrás de órdenes más recientes (F15).
  const oldestFirst = estado === 'pendientes' || estado === 'revision' || estado === 'provisional' || estado === 'bloqueada'
  query = query
    .order('creada_en', { ascending: oldestFirst })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: 'No se pudieron consultar los pagos' }, { status: 500 })
  }

  return NextResponse.json(
    { orders: data || [], total: count || 0, offset, limit },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response
  try {
    const body = await req.json()
    if (!isValidUUID(body.id) || typeof body.confirmar !== 'boolean' || typeof body.nota !== 'string') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    const { data, error } = await auth.supabaseAdmin.rpc('revisar_orden_pago', {
      p_id: body.id,
      p_admin: auth.user.id,
      p_confirmar: body.confirmar,
      p_nota: body.nota.slice(0, 1000),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ state: data })
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
  }
}
