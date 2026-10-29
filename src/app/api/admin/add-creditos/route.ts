import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { userId, cantidad, motivo } = body
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    const creditos = Number(cantidad)
    if (!Number.isInteger(creditos) || creditos < 1 || creditos > 10000) {
      return NextResponse.json({ error: 'Cantidad inválida (debe ser entre 1 y 10.000)' }, { status: 400 })
    }

    const { data: perfil, error: perfilError } = await auth.supabaseAdmin
      .from('perfiles')
      .select('credito_balance, nombre')
      .eq('id', userId)
      .maybeSingle()
    if (perfilError) return NextResponse.json({ error: perfilError.message }, { status: 500 })
    if (!perfil) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const nuevoBalance = Number(perfil.credito_balance || 0) + creditos
    const { error: updateError } = await auth.supabaseAdmin
      .from('perfiles')
      .update({ credito_balance: nuevoBalance })
      .eq('id', userId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    const { error: txError } = await auth.supabaseAdmin.from('transacciones_creditos').insert({
      user_id: userId,
      tipo: 'admin_manual',
      monto: creditos,
      estado: 'aprobado',
      motivo_registro: typeof motivo === 'string' ? motivo.slice(0, 500) : 'Manual admin',
      aprobado_en: new Date().toISOString(),
      aprobado_por: auth.user.id,
    })
    if (txError) {
      // Roll back the balance if the audit transaction could not be written.
      await auth.supabaseAdmin.from('perfiles')
        .update({ credito_balance: Number(perfil.credito_balance || 0) })
        .eq('id', userId)
      return NextResponse.json({ error: txError.message }, { status: 500 })
    }

    await notifyUser(auth.supabaseAdmin, userId, {
      title: '💰 Créditos recibidos',
      body: `Recibiste ${creditos} ${creditos === 1 ? 'crédito' : 'créditos'} en tu cuenta VendeT. Nuevo balance: ${nuevoBalance}.`,
      tag: 'creditos',
      icon: '/icon-192.png',
      click_url: '/creditos',
    })

    return NextResponse.json({ ok: true, nuevoBalance })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
