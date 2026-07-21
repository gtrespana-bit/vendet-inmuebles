import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { notifyUser } from '@/lib/push-notify'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, cantidad, motivo } = body

    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    if (!cantidad || parseInt(cantidad) < 1) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: perfilData } = await supabaseAdmin
      .from('perfiles')
      .select('credito_balance')
      .eq('id', userId)
      .single()

    const nuevoBalance = (perfilData?.credito_balance || 0) + parseInt(cantidad)

    const { error: err1 } = await supabaseAdmin
      .from('perfiles')
      .update({ credito_balance: nuevoBalance })
      .eq('id', userId)
    if (err1) throw err1

    const { error: err2 } = await supabaseAdmin
      .from('transacciones_creditos')
      .insert({
        user_id: userId,
        tipo: 'admin_manual',
        monto: parseInt(cantidad),
        estado: 'aprobado',
        motivo_registro: motivo || 'Manual admin',
      })
    if (err2) throw err2

    // Push notification: créditos recibidos
    await notifyUser(supabaseAdmin, userId, {
      title: '💰 Créditos recibidos',
      body: `Recibiste ${cantidad} ${parseInt(cantidad) === 1 ? 'crédito' : 'créditos'} en tu cuenta VendeT. Nuevo balance: ${nuevoBalance}.`,
      tag: 'creditos',
      icon: '/icon-192.png',
      click_url: '/creditos',
    })

    return NextResponse.json({ ok: true, nuevoBalance })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
