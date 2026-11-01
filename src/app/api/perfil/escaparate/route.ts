import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase-server'
import { checkPlanLimits } from '@/lib/plans'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  canPlanUseCustomStorefront,
  validateStorefrontSlug,
} from '@/lib/storefront-slug'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const supabase = createServerClient()
    const [{ data: perfil, error: perfilError }, planData] = await Promise.all([
      supabase
        .from('perfiles')
        .select('slug, empresa_nombre, descripcion_agente, tipo_cuenta')
        .eq('id', auth.user.id)
        .maybeSingle(),
      checkPlanLimits(auth.user.id),
    ])

    if (perfilError) {
      return NextResponse.json({ error: 'No se pudo cargar la configuración del escaparate' }, { status: 500 })
    }

    return NextResponse.json({
      slug: perfil?.slug || null,
      empresa_nombre: perfil?.empresa_nombre || '',
      descripcion_agente: perfil?.descripcion_agente || '',
      tipo_cuenta: perfil?.tipo_cuenta || 'particular',
      plan: planData.plan,
      canCustomizeSlug: canPlanUseCustomStorefront(planData.plan),
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el escaparate' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const rl = await checkRateLimit('perfil:escaparate', auth.user.id)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiados cambios seguidos. Intenta de nuevo en unos minutos.' },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const rawSlug = typeof body?.slug === 'string' ? body.slug.trim() : ''
    const rawEmpresa = typeof body?.empresa_nombre === 'string' ? body.empresa_nombre.trim().slice(0, 80) : null
    const rawDescripcion =
      typeof body?.descripcion_agente === 'string' ? body.descripcion_agente.trim().slice(0, 400) : null

    const planData = await checkPlanLimits(auth.user.id)
    const canCustomize = canPlanUseCustomStorefront(planData.plan)

    let nextSlug: string | null = null
    if (rawSlug !== '') {
      if (!canCustomize) {
        return NextResponse.json(
          { error: 'La URL personalizada está disponible en los planes Profesional e Inmobiliaria.' },
          { status: 403 }
        )
      }
      const checked = validateStorefrontSlug(rawSlug)
      if (!checked.valid) {
        const messageByReason: Record<string, string> = {
          length: 'El enlace debe tener entre 3 y 50 caracteres.',
          reserved: 'Ese nombre de enlace está reservado por el portal.',
          uuid: 'Elige un nombre legible en lugar de un identificador.',
          format: 'Usa solo letras minúsculas, números y guiones simples.',
          empty: 'Indica un enlace válido.',
        }
        return NextResponse.json(
          { error: messageByReason[checked.reason || 'format'] },
          { status: 400 }
        )
      }
      nextSlug = checked.normalized
    }

    const supabase = createServerClient()

    if (nextSlug) {
      const { data: existing } = await supabase
        .from('perfiles')
        .select('id')
        .ilike('slug', nextSlug)
        .neq('id', auth.user.id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'Ese enlace personalizado ya está en uso por otra cuenta.' },
          { status: 409 }
        )
      }
    }

    const updates: Record<string, string | null> = {}
    if (canCustomize || rawSlug === '') {
      updates.slug = nextSlug
    }
    if (rawEmpresa !== null) {
      updates.empresa_nombre = rawEmpresa || null
    }
    if (rawDescripcion !== null) {
      updates.descripcion_agente = rawDescripcion || null
    }

    const { error: updateError } = await supabase
      .from('perfiles')
      .update(updates)
      .eq('id', auth.user.id)

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'Ese enlace personalizado ya está en uso por otra cuenta.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'No se pudo guardar el escaparate público.' },
        { status: 500 }
      )
    }

    // Sincronizar con `public.agencias` si el usuario es titular de una agencia
    if (rawEmpresa !== null || rawDescripcion !== null) {
      const agencySync: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
      if (rawEmpresa && rawEmpresa.trim().length >= 2) agencySync.nombre = rawEmpresa.trim()
      if (rawDescripcion !== null) agencySync.descripcion = rawDescripcion || null
      await supabase.from('agencias').update(agencySync).eq('owner_id', auth.user.id)
    }

    return NextResponse.json({
      ok: true,
      slug: nextSlug,
      empresa_nombre: rawEmpresa ?? undefined,
      descripcion_agente: rawDescripcion ?? undefined,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno al actualizar el escaparate.' }, { status: 500 })
  }
}
