import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

// Gestión atómica de planes de suscripción por parte del administrador (F09).
// La cancelación de suscripciones previas, el alta de la nueva y la actualización
// de `perfiles.tipo_cuenta` ocurren en una única transacción en `admin_cambiar_plan`.

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

    const { data, error } = await auth.supabaseAdmin.rpc('admin_cambiar_plan', {
      p_user_id: userId,
      p_admin_id: auth.user.id,
      p_plan: plan,
      p_modo: modo,
    })

    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
