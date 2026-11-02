import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'
import { notifyUser } from '@/lib/push-notify'
import { notificarCambioPlanAdmin } from '@/lib/email-eventos'

// Gestión atómica de planes de suscripción y tiempo extra manual desde Admin.
// Soporta:
//  - `operacion: 'extender'` -> añade +N días sobre la vigencia actual (sin perder días restantes).
//  - `operacion: 'asignar'`  -> activa o cambia de plan desde hoy por N días (por defecto 30).
//  - `operacion: 'cancelar'` -> pasa al Plan Gratuito cancelando suscripciones vigentes.

const PLANES_VALIDOS = ['gratuita', 'profesional', 'profesional_plus', 'agencia'] as const
const MODOS_VALIDOS = ['activa', 'trial', 'cancelar'] as const
const OPERACIONES_VALIDAS = ['extender', 'asignar', 'cancelar'] as const

const PLAN_NOMBRE: Record<string, string> = {
  agencia: 'Agencia',
  profesional_plus: 'Profesional Plus',
  profesional: 'Profesional',
  gratuita: 'Gratuito',
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const {
      userId,
      plan,
      modo,
      operacion: rawOperacion,
      dias: rawDias,
      creditosIncluidos: rawCreditos,
      motivo: rawMotivo,
      notificarEmail = true,
    } = body

    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    const operacion: (typeof OPERACIONES_VALIDAS)[number] = rawOperacion
      ? rawOperacion
      : plan === 'gratuita' || modo === 'cancelar'
        ? 'cancelar'
        : 'asignar'

    if (!OPERACIONES_VALIDAS.includes(operacion)) {
      return NextResponse.json({ error: 'Operación inválida (usa: extender, asignar o cancelar)' }, { status: 400 })
    }

    if (plan !== undefined && plan !== null && plan !== '' && !PLANES_VALIDOS.includes(plan)) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    if (modo !== undefined && modo !== null && modo !== '' && !MODOS_VALIDOS.includes(modo)) {
      return NextResponse.json({ error: 'Modo inválido (usa: activa, trial o cancelar)' }, { status: 400 })
    }

    if (operacion === 'asignar') {
      if (!plan || plan === 'gratuita') {
        return NextResponse.json({ error: 'Selecciona el plan a activar (profesional, profesional_plus o agencia)' }, { status: 400 })
      }
      if (!modo || modo === 'cancelar') {
        return NextResponse.json({ error: 'Selecciona el modo del plan (activa o trial)' }, { status: 400 })
      }
    }

    let dias = 30
    if (operacion !== 'cancelar' && rawDias !== undefined && rawDias !== null && rawDias !== '') {
      dias = Number(rawDias)
      if (!Number.isInteger(dias) || dias < 1 || dias > 730) {
        return NextResponse.json({ error: 'La cantidad de días debe ser un entero entre 1 y 730' }, { status: 400 })
      }
    }

    let creditosIncluidos: number | null = null
    if (rawCreditos !== undefined && rawCreditos !== null && rawCreditos !== '') {
      creditosIncluidos = Number(rawCreditos)
      if (!Number.isInteger(creditosIncluidos) || creditosIncluidos < 0 || creditosIncluidos > 1000) {
        return NextResponse.json({ error: 'Los créditos mensuales incluidos deben estar entre 0 y 1000' }, { status: 400 })
      }
    }

    const motivo = typeof rawMotivo === 'string' && rawMotivo.trim()
      ? rawMotivo.trim().slice(0, 500)
      : null

    const { data, error } = await auth.supabaseAdmin.rpc('admin_gestionar_plan', {
      p_user_id: userId,
      p_admin_id: auth.user.id,
      p_operacion: operacion,
      p_plan: plan || null,
      p_modo: modo || null,
      p_dias: dias,
      p_creditos_incluidos: creditosIncluidos,
      p_motivo: motivo,
    })

    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    const resultado = (data || {}) as Record<string, any>
    const sub = (resultado.suscripcion || {}) as Record<string, any>
    const planFinal = (sub.plan || resultado.plan || plan || 'gratuita') as 'agencia' | 'profesional_plus' | 'profesional' | 'gratuita'
    const estadoFinal = (sub.estado || resultado.estado || 'cancelada') as 'activa' | 'trial' | 'cancelada'
    const fechaFin = (sub.fin || sub.trial_ends_at || null) as string | null
    const creditosFinales = typeof sub.creditos_incluidos === 'number' ? sub.creditos_incluidos : creditosIncluidos

    if (notificarEmail !== false) {
      const planEtiqueta = PLAN_NOMBRE[planFinal] || planFinal
      if (operacion === 'extender' && planFinal !== 'gratuita') {
        await notifyUser(auth.supabaseAdmin, userId, {
          title: `🎁 +${dias} ${dias === 1 ? 'día extra' : 'días extra'} en tu Plan ${planEtiqueta}`,
          body: `Añadimos tiempo adicional de cortesía a tu Plan ${planEtiqueta} en Venezuela Inmuebles.`,
          tag: 'plan-tiempo-extra',
          icon: '/icon-192.png',
          click_url: planFinal === 'agencia' ? '/dashboard?tab=agencia' : '/dashboard',
        })
      } else if (operacion === 'asignar' && planFinal !== 'gratuita') {
        await notifyUser(auth.supabaseAdmin, userId, {
          title: `✨ Plan ${planEtiqueta} activado`,
          body: `Tu Plan ${planEtiqueta} está activo por ${dias} ${dias === 1 ? 'día' : 'días'} en Venezuela Inmuebles.`,
          tag: 'plan-activado',
          icon: '/icon-192.png',
          click_url: planFinal === 'agencia' ? '/dashboard?tab=agencia' : '/dashboard',
        })
      }

      await notificarCambioPlanAdmin(auth.supabaseAdmin, {
        userId,
        operacion,
        plan: planFinal,
        estado: estadoFinal,
        dias,
        fechaVencimiento: fechaFin,
        creditosIncluidos: creditosFinales,
        motivo,
      })
    }

    return NextResponse.json(resultado)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
