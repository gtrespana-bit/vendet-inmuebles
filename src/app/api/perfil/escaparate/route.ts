import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase-server'
import { checkPlanLimits } from '@/lib/plans'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  canPlanUseCustomStorefront,
  validateStorefrontSlug,
} from '@/lib/storefront-slug'

const ALLOWED_LANGUAGES = new Set(['es', 'en', 'pt', 'it', 'zh', 'fr', 'de'])

function sanitizeSocialUrl(raw: unknown, prefixBase?: string): string | null {
  if (typeof raw !== 'string') return null
  const val = raw.trim().slice(0, 180)
  if (!val) return null
  if (val.startsWith('https://') || val.startsWith('http://')) {
    try {
      const u = new URL(val)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
      return u.toString()
    } catch {
      return null
    }
  }
  if (prefixBase) {
    const cleanHandle = val.replace(/^@+/, '').replace(/[^a-zA-Z0-9._-]/g, '')
    return cleanHandle ? `${prefixBase}${cleanHandle}` : null
  }
  return null
}

function sanitizeRedesSociales(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const src = raw as Record<string, unknown>
  const out: Record<string, string> = {}

  const ig = sanitizeSocialUrl(src.instagram, 'https://instagram.com/')
  if (ig) out.instagram = ig

  const li = sanitizeSocialUrl(src.linkedin)
  if (li) out.linkedin = li

  const tk = sanitizeSocialUrl(src.tiktok, 'https://www.tiktok.com/@')
  if (tk) out.tiktok = tk

  const web = sanitizeSocialUrl(src.web)
  if (web) out.web = web

  return out
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const supabase = createServerClient()
    const [{ data: perfil, error: perfilError }, planData] = await Promise.all([
      supabase
        .from('perfiles')
        .select(
          'slug, empresa_nombre, descripcion_agente, tipo_cuenta, licencia_corredor, horario_atencion, idiomas, zonas_especialidad, anos_experiencia, redes_sociales',
        )
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
      licencia_corredor: perfil?.licencia_corredor || '',
      horario_atencion: perfil?.horario_atencion || '',
      idiomas: Array.isArray(perfil?.idiomas) && perfil.idiomas.length > 0 ? perfil.idiomas : ['es'],
      zonas_especialidad: Array.isArray(perfil?.zonas_especialidad) ? perfil.zonas_especialidad : [],
      anos_experiencia: perfil?.anos_experiencia ?? null,
      redes_sociales:
        perfil?.redes_sociales && typeof perfil.redes_sociales === 'object'
          ? perfil.redes_sociales
          : {},
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
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const rawSlug = typeof body?.slug === 'string' ? body.slug.trim() : undefined
    const rawEmpresa =
      typeof body?.empresa_nombre === 'string' ? body.empresa_nombre.trim().slice(0, 80) : null
    const rawDescripcion =
      typeof body?.descripcion_agente === 'string'
        ? body.descripcion_agente.trim().slice(0, 500)
        : null
    const rawLicencia =
      typeof body?.licencia_corredor === 'string'
        ? body.licencia_corredor.trim().slice(0, 80)
        : undefined
    const rawHorario =
      typeof body?.horario_atencion === 'string'
        ? body.horario_atencion.trim().slice(0, 120)
        : undefined

    const planData = await checkPlanLimits(auth.user.id)
    const canCustomize = canPlanUseCustomStorefront(planData.plan)

    let nextSlug: string | null | undefined = undefined
    if (rawSlug !== undefined) {
      if (rawSlug !== '') {
        if (!canCustomize) {
          return NextResponse.json(
            { error: 'La URL personalizada está disponible en los planes Profesional e Inmobiliaria.' },
            { status: 403 },
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
            { status: 400 },
          )
        }
        nextSlug = checked.normalized
      } else {
        nextSlug = null
      }
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
          { status: 409 },
        )
      }
    }

    const updates: Record<string, unknown> = {}
    if (nextSlug !== undefined && (canCustomize || nextSlug === null)) {
      updates.slug = nextSlug
    }
    if (rawEmpresa !== null) {
      updates.empresa_nombre = rawEmpresa || null
    }
    if (rawDescripcion !== null) {
      updates.descripcion_agente = rawDescripcion || null
    }
    if (rawLicencia !== undefined) {
      updates.licencia_corredor = rawLicencia || null
    }
    if (rawHorario !== undefined) {
      updates.horario_atencion = rawHorario || null
    }
    if (Array.isArray(body?.idiomas)) {
      const cleanLangs = Array.from(
        new Set(
          body.idiomas
            .map((l: unknown) => String(l || '').trim().toLowerCase())
            .filter((l: string) => ALLOWED_LANGUAGES.has(l)),
        ),
      )
      updates.idiomas = cleanLangs.length > 0 ? cleanLangs : ['es']
    }
    if (Array.isArray(body?.zonas_especialidad)) {
      const cleanZones = Array.from(
        new Set(
          body.zonas_especialidad
            .map((z: unknown) => String(z || '').trim().slice(0, 45))
            .filter((z: string) => z.length >= 2),
        ),
      ).slice(0, 8)
      updates.zonas_especialidad = cleanZones
    }
    if (body?.anos_experiencia !== undefined) {
      if (body.anos_experiencia === null || body.anos_experiencia === '') {
        updates.anos_experiencia = null
      } else {
        const yrs = Math.round(Number(body.anos_experiencia))
        if (Number.isFinite(yrs) && yrs >= 0 && yrs <= 80) {
          updates.anos_experiencia = yrs
        }
      }
    }
    if (body?.redes_sociales !== undefined) {
      updates.redes_sociales = sanitizeRedesSociales(body.redes_sociales)
    }

    const { error: updateError } = await supabase
      .from('perfiles')
      .update(updates)
      .eq('id', auth.user.id)

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'Ese enlace personalizado ya está en uso por otra cuenta.' },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: 'No se pudo guardar el escaparate público.' },
        { status: 500 },
      )
    }

    if (rawEmpresa !== null || rawDescripcion !== null) {
      const agencySync: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
      if (rawEmpresa && rawEmpresa.trim().length >= 2) agencySync.nombre = rawEmpresa.trim()
      if (rawDescripcion !== null) agencySync.descripcion = rawDescripcion || null
      await supabase.from('agencias').update(agencySync).eq('owner_id', auth.user.id)
    }

    return NextResponse.json({
      ok: true,
      slug: nextSlug ?? undefined,
      empresa_nombre: rawEmpresa ?? undefined,
      descripcion_agente: rawDescripcion ?? undefined,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno al actualizar el escaparate.' }, { status: 500 })
  }
}
