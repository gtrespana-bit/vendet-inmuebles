import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { getUserAgencyContext } from '@/lib/agency-server'
import { isValidUUID } from '@/lib/validation'

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const { agency, activeMemberIds } = await getUserAgencyContext(supabaseAdmin, user.id)
    if (!agency || !agency.isAdmin) {
      return NextResponse.json({ error: 'Solo el titular o administrador de la agencia puede reasignar inmuebles' }, { status: 403 })
    }

    const body = await req.json()
    const inmuebleId = typeof body.inmuebleId === 'string' ? body.inmuebleId : ''
    const agenteAsignadoId = typeof body.agenteAsignadoId === 'string' ? body.agenteAsignadoId : ''

    if (!isValidUUID(inmuebleId) || !isValidUUID(agenteAsignadoId)) {
      return NextResponse.json({ error: 'Inmueble o agente inválido' }, { status: 400 })
    }

    if (!activeMemberIds.has(agenteAsignadoId)) {
      return NextResponse.json({ error: 'El agente seleccionado no pertenece activamente a tu agencia' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('inmuebles')
      .select('id, slug, agencia_id, usuario_id')
      .eq('id', inmuebleId)
      .maybeSingle()

    if (!existing || (existing.agencia_id !== agency.id && existing.usuario_id !== agency.owner_id)) {
      return NextResponse.json({ error: 'Inmueble no encontrado en la cartera de tu agencia' }, { status: 404 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('inmuebles')
      .update({
        agencia_id: agency.id,
        agente_asignado_id: agenteAsignadoId,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', inmuebleId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('conversaciones')
      .update({
        agencia_id: agency.id,
        agente_asignado_id: agenteAsignadoId,
        actualizado_en: new Date().toISOString(),
      })
      .eq('producto_id', inmuebleId)

    revalidatePath(`/inmueble/${existing.slug || existing.id}`)
    revalidatePath(`/inmueble/${existing.id}`)

    return NextResponse.json({ ok: true, inmuebleId, agenteAsignadoId })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al reasignar inmueble' }, { status: 500 })
  }
}
