import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'
import { PLANS } from '@/lib/plans'
import { accountTypeForPlan } from '@/lib/plan-catalog'

// Gestión de planes de suscripción por parte del administrador.
// RLS sobre `suscripciones` sólo permite SELECT, así que la escritura
// se hace aquí con el cliente service-role.

const PLANES_VALIDOS = ['gratuita', 'profesional', 'agencia'] as const
const MODOS_VALIDOS = ['activa', 'trial', 'cancelar'] as const

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { userId, plan, modo } = body
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    if (!PLANES_VALIDOS.includes(plan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }
    if (!MODOS_VALIDOS.includes(modo)) {
      return NextResponse.json({ error: 'Modo inválido (usa: activa, trial o cancelar)' }, { status: 400 })
    }

    const { data: perfil, error: perfilError } = await auth.supabaseAdmin
      .from('perfiles')
      .select('id, nombre, tipo_cuenta')
      .eq('id', userId)
      .maybeSingle()
    if (perfilError) return NextResponse.json({ error: perfilError.message }, { status: 500 })
    if (!perfil) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    // 1) Cancelar suscripciones vigentes (historial se conserva)
    const { error: cancelError } = await auth.supabaseAdmin
      .from('suscripciones')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('estado', ['activa', 'trial'])
    if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 })

    const tipoCuenta = accountTypeForPlan(plan)
    const creditosIncluidos = PLANS[plan as keyof typeof PLANS]?.creditosMes ?? 0

    // 2) Plan gratuito: basta con cancelar lo vigente (gratuita es el estado por defecto)
    if (plan === 'gratuita' || modo === 'cancelar') {
      const { error: tipoError } = await auth.supabaseAdmin
        .from('perfiles')
        .update({ tipo_cuenta: 'particular' })
        .eq('id', userId)
      if (tipoError) return NextResponse.json({ error: tipoError.message }, { status: 500 })
      return NextResponse.json({ ok: true, plan: 'gratuita', estado: 'cancelada' })
    }

    // 3) Crear la nueva suscripción (trial o activa)
    const ahora = new Date()
    const finPeriodo = new Date(ahora.getTime() + 30 * 24 * 3600 * 1000)
    const nueva = {
      user_id: userId,
      plan,
      estado: modo === 'trial' ? 'trial' : 'activa',
      inicio: ahora.toISOString(),
      fin: finPeriodo.toISOString(),
      trial_ends_at: modo === 'trial' ? finPeriodo.toISOString() : null,
      creditos_incluidos: creditosIncluidos,
      creditos_usados_mes: 0,
      proxima_renovacion_creditos: finPeriodo.toISOString(),
    }
    const { data: creada, error: insertError } = await auth.supabaseAdmin
      .from('suscripciones')
      .insert(nueva)
      .select('id, plan, estado, fin, trial_ends_at')
      .single()
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    // 4) Mantener el tipo de cuenta del perfil en sincronía
    const { error: tipoError } = await auth.supabaseAdmin
      .from('perfiles')
      .update({ tipo_cuenta: tipoCuenta })
      .eq('id', userId)
    if (tipoError) return NextResponse.json({ error: tipoError.message }, { status: 500 })

    return NextResponse.json({ ok: true, suscripcion: creada })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
