import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { getUserAgencyContext } from '@/lib/agency-server'
import { checkPlanLimits } from '@/lib/plans'
import { sanitizeString } from '@/lib/validation'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const { agency } = await getUserAgencyContext(supabaseAdmin, user.id)

    if (!agency) {
      return NextResponse.json({ agencia: null, miembros: [], invitaciones: [], cartera: [], creditosAgencia: null })
    }

    const [
      { data: ownerProfile },
      { data: memberRows },
      { data: listingsRows },
      ownerPlan,
    ] = await Promise.all([
      supabaseAdmin
        .from('perfiles')
        .select('id, slug, credito_balance')
        .eq('id', agency.owner_id)
        .maybeSingle(),
      supabaseAdmin
        .from('agencia_miembros')
        .select('id, user_id, rol, estado, creado_en')
        .eq('agencia_id', agency.id)
        .eq('estado', 'activo')
        .order('creado_en', { ascending: true }),
      supabaseAdmin
        .from('vw_propiedades_publicas')
        .select('id, titulo, slug, precio, moneda, estado, ciudad, activo, vendido, estado_moderacion, visitas, main_image_url, operacion_nombre, destacado, destacado_hasta, boosteado_en, usuario_id, agencia_id, agente_asignado_id, agente_nombre, creado_en')
        .eq('agencia_id', agency.id)
        .order('creado_en', { ascending: false }),
      agency.isOwner ? checkPlanLimits(agency.owner_id).catch(() => null) : Promise.resolve(null),
    ])

    const allMemberIds = Array.from(
      new Set([agency.owner_id, ...(memberRows || []).map((m: any) => m.user_id)])
    )

    const { data: profilesRows } = allMemberIds.length
      ? await supabaseAdmin
          .from('perfiles')
          .select('id, nombre, email, telefono, foto_perfil_url, verificado, credito_balance, slug')
          .in('id', allMemberIds)
      : { data: [] }

    const profileMap = new Map<string, any>((profilesRows || []).map((p: any) => [p.id, p]))
    const allListings = listingsRows || []

    // Estadísticas por agente dentro de la agencia
    const statsByAgent = new Map<string, { activos: number; totales: number; visitas: number }>()
    for (const item of allListings) {
      const agentId = item.agente_asignado_id || item.usuario_id
      if (!agentId) continue
      const prev = statsByAgent.get(agentId) || { activos: 0, totales: 0, visitas: 0 }
      prev.totales += 1
      if (item.activo && !item.vendido) prev.activos += 1
      prev.visitas += Number(item.visitas || 0)
      statsByAgent.set(agentId, prev)
    }

    const memberRoleByUser = new Map<string, { id: string; rol: string; creado_en: string }>(
      (memberRows || []).map((m: any) => [m.user_id, m])
    )

    const miembros = allMemberIds.map((uid) => {
      const prof = profileMap.get(uid) || {}
      const mem = memberRoleByUser.get(uid)
      const st = statsByAgent.get(uid) || { activos: 0, totales: 0, visitas: 0 }
      const esDueno = uid === agency.owner_id
      return {
        user_id: uid,
        membership_id: mem?.id || null,
        nombre: prof.nombre || prof.email?.split('@')[0] || 'Agente',
        email: agency.isAdmin || uid === user.id ? prof.email || null : null,
        telefono: prof.telefono || null,
        foto_perfil_url: prof.foto_perfil_url || null,
        verificado: Boolean(prof.verificado),
        slug: prof.slug || null,
        rol: esDueno ? 'admin' : (mem?.rol || 'agente'),
        esDueno,
        credito_balance: agency.isOwner || uid === user.id ? Number(prof.credito_balance || 0) : null,
        inmueblesActivos: st.activos,
        inmueblesTotales: st.totales,
        visitasTotales: st.visitas,
        creado_en: mem?.creado_en || null,
      }
    }).sort((a, b) => (a.esDueno === b.esDueno ? 0 : a.esDueno ? -1 : 1))

    let invitaciones: any[] = []
    if (agency.isAdmin) {
      const nowIso = new Date().toISOString()
      const { data: inviteRows } = await supabaseAdmin
        .from('agencia_invitaciones')
        .select('id, email, rol, estado, expira_en, creado_en')
        .eq('agencia_id', agency.id)
        .eq('estado', 'pendiente')
        .gt('expira_en', nowIso)
        .order('creado_en', { ascending: false })
      invitaciones = inviteRows || []
    }

    const visibleCartera = agency.isAdmin
      ? allListings
      : allListings.filter((item: any) => item.agente_asignado_id === user.id)

    const compradosOwner = Number(ownerProfile?.credito_balance || 0)
    const planRestantesOwner = Number(ownerPlan?.creditosRestantesPlan || 0)

    return NextResponse.json({
      agencia: {
        id: agency.id,
        nombre: agency.nombre,
        descripcion: agency.descripcion,
        logo_url: agency.logo_url,
        owner_id: agency.owner_id,
        slug: ownerProfile?.slug || null,
        rol: agency.rol,
        esDueno: agency.isOwner,
        esAdmin: agency.isAdmin,
        planAgenciaActivo: agency.agenciaPlanActivo,
        totalCarteraActiva: allListings.filter((i: any) => i.activo && !i.vendido).length,
        visitasCarteraTotal: allListings.reduce((acc: number, i: any) => acc + Number(i.visitas || 0), 0),
      },
      miembros,
      invitaciones,
      cartera: visibleCartera,
      creditosAgencia: agency.isOwner
        ? {
            planRestantes: planRestantesOwner,
            comprados: compradosOwner,
            totalDisponibles: planRestantesOwner + compradosOwner,
          }
        : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al cargar la agencia' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const { agency } = await getUserAgencyContext(supabaseAdmin, user.id)
    if (!agency || !agency.isAdmin) {
      return NextResponse.json({ error: 'No tienes permisos para editar esta agencia' }, { status: 403 })
    }

    const body = await req.json()
    const updates: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
    if (typeof body.nombre === 'string') {
      const limpio = sanitizeString(body.nombre, 120)
      if (!limpio || limpio.length < 2) {
        return NextResponse.json({ error: 'El nombre comercial de la agencia debe tener al menos 2 caracteres' }, { status: 400 })
      }
      updates.nombre = limpio
    }
    if ('descripcion' in body) {
      updates.descripcion = typeof body.descripcion === 'string' ? sanitizeString(body.descripcion, 800) || null : null
    }
    if ('logo_url' in body) {
      const logo = typeof body.logo_url === 'string' ? body.logo_url.trim() : ''
      if (logo && !logo.startsWith('https://')) {
        return NextResponse.json({ error: 'URL de logo no válida' }, { status: 400 })
      }
      updates.logo_url = logo || null
    }

    const { data: updated, error } = await supabaseAdmin
      .from('agencias')
      .update(updates)
      .eq('id', agency.id)
      .select('id, nombre, descripcion, logo_url, owner_id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Sincronizar nombre comercial y descripción con el perfil público del dueño
    const ownerProfileSync: Record<string, unknown> = {}
    if ('nombre' in updates) ownerProfileSync.empresa_nombre = updates.nombre
    if ('descripcion' in updates) ownerProfileSync.descripcion_agente = updates.descripcion
    if ('logo_url' in updates) ownerProfileSync.logo_url = updates.logo_url
    if (Object.keys(ownerProfileSync).length > 0) {
      await supabaseAdmin.from('perfiles').update(ownerProfileSync).eq('id', agency.owner_id)
    }

    return NextResponse.json({ ok: true, agencia: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al actualizar la agencia' }, { status: 500 })
  }
}
