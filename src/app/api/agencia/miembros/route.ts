import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { getUserAgencyContext } from '@/lib/agency-server'
import { canTransferAgencyCredits, isValidAgencyRole } from '@/lib/agency'
import { isValidUUID } from '@/lib/validation'

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const body = await req.json()
    const action = body.action

    const { agency } = await getUserAgencyContext(supabaseAdmin, user.id)
    if (!agency) {
      return NextResponse.json({ error: 'No perteneces a ninguna agencia' }, { status: 403 })
    }

    if (action === 'transfer_credits') {
      if (!canTransferAgencyCredits(user.id, agency.owner_id)) {
        return NextResponse.json({ error: 'Solo el titular principal de la agencia puede asignar créditos' }, { status: 403 })
      }
      const agenteId = typeof body.agenteId === 'string' ? body.agenteId : ''
      const cantidad = Number.parseInt(String(body.cantidad), 10)
      if (!isValidUUID(agenteId) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
        return NextResponse.json({ error: 'Agente o cantidad de créditos inválida' }, { status: 400 })
      }

      const { data: result, error } = await supabaseAdmin.rpc('transferir_creditos_agencia', {
        p_actor_id: user.id,
        p_agente_id: agenteId,
        p_cantidad: cantidad,
      })

      if (error || !result?.ok) {
        return NextResponse.json(
          { error: result?.error || error?.message || 'No se pudieron asignar los créditos' },
          { status: 400 }
        )
      }

      return NextResponse.json(result)
    }

    if (action === 'change_role') {
      if (!agency.isOwner) {
        return NextResponse.json({ error: 'Solo el titular principal de la agencia puede cambiar roles' }, { status: 403 })
      }
      const miembroUserId = typeof body.userId === 'string' ? body.userId : ''
      const rol = body.rol
      if (!isValidUUID(miembroUserId) || !isValidAgencyRole(rol)) {
        return NextResponse.json({ error: 'Datos de rol inválidos' }, { status: 400 })
      }
      if (miembroUserId === agency.owner_id) {
        return NextResponse.json({ error: 'No puedes cambiar el rol del titular principal' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('agencia_miembros')
        .update({ rol })
        .eq('agencia_id', agency.id)
        .eq('user_id', miembroUserId)
        .eq('estado', 'activo')

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, rol })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error gestionando miembro' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const body = await req.json().catch(() => ({}))
    const miembroUserId = typeof body.userId === 'string' ? body.userId : new URL(req.url).searchParams.get('userId') || ''
    const reasignarA = typeof body.reasignarA === 'string' && body.reasignarA ? body.reasignarA : null

    if (!isValidUUID(miembroUserId) || (reasignarA && !isValidUUID(reasignarA))) {
      return NextResponse.json({ error: 'Identificador de usuario inválido' }, { status: 400 })
    }

    const { data: result, error } = await supabaseAdmin.rpc('desvincular_miembro_agencia', {
      p_actor_id: user.id,
      p_miembro_user_id: miembroUserId,
      p_reasignar_a: reasignarA,
    })

    if (error || !result?.ok) {
      return NextResponse.json(
        { error: result?.error || error?.message || 'No se pudo desvincular al miembro' },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al desvincular miembro' }, { status: 500 })
  }
}
