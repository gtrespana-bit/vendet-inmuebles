import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'
import { notificarCreditosAgregados } from '@/lib/email-eventos'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { userId, cantidad, motivo, idempotencyKey } = body
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    const creditos = Number(cantidad)
    if (!Number.isInteger(creditos) || creditos < 1 || creditos > 10000) {
      return NextResponse.json({ error: 'Cantidad inválida (debe ser entre 1 y 10.000)' }, { status: 400 })
    }

    const referencia = typeof idempotencyKey === 'string' && idempotencyKey.trim()
      ? `admin:${idempotencyKey.trim().slice(0, 120)}`
      : null

    const { data, error } = await auth.supabaseAdmin.rpc('admin_agregar_creditos', {
      p_user_id: userId,
      p_admin_id: auth.user.id,
      p_cantidad: creditos,
      p_motivo: typeof motivo === 'string' ? motivo.slice(0, 500) : 'Manual admin',
      p_referencia: referencia,
    })

    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    const fila = Array.isArray(data) ? data[0] : data
    const nuevoBalance = Number(fila?.nuevo_balance ?? 0)
    const yaAplicado = Boolean(fila?.ya_aplicado)

    if (!yaAplicado) {
      await notifyUser(auth.supabaseAdmin, userId, {
        title: '💰 Créditos recibidos',
        body: `Recibiste ${creditos} ${creditos === 1 ? 'crédito' : 'créditos'} en tu cuenta Venezuela Inmuebles. Nuevo balance: ${nuevoBalance}.`,
        tag: 'creditos',
        icon: '/icon-192.png',
        click_url: '/creditos',
      })
      await notificarCreditosAgregados(auth.supabaseAdmin, userId, creditos)
    }

    return NextResponse.json({ ok: true, nuevoBalance, idempotent: yaAplicado })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
