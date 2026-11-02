import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { getUserAgencyContext } from '@/lib/agency-server'
import {
  aggregateAgentPerformance,
  computeMedianFirstResponseMinutes,
  computePortfolioListingFunnels,
  type RawConversationForFunnel,
  type RawListingForFunnel,
  type RawVisitForFunnel,
  type RawWebEventForFunnel,
} from '@/lib/listing-funnel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/mi-embudo?days=30
 * Devuelve el embudo completo de conversión (Vistas → Favoritos → Clics WhatsApp/Teléfono/Chat → Visitas)
 * para propietarios individuales, asesores vinculados y agencias multi-agente (incluyendo desglose por asesor).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const rawDays = Number(req.nextUrl.searchParams.get('days') || '30')
    const days = [7, 30, 90, 0].includes(rawDays) ? rawDays : 30
    const cutoffIso = days > 0 ? new Date(Date.now() - days * 86400 * 1000).toISOString() : null

    const userId = auth.user.id
    const supabaseAdmin = auth.supabaseAdmin
    const { agency, activeMemberIds } = await getUserAgencyContext(supabaseAdmin, userId)
    const isAgencyAdmin = Boolean(agency && agency.rol === 'admin')

    // 1. Obtener cartera de inmuebles según rol
    const listingsQuery = supabaseAdmin
      .from('inmuebles')
      .select(
        'id, slug, titulo, precio, moneda, ciudad, estado, activo, vendido, destacado, visitas, usuario_id, agente_asignado_id, creado_en',
      )
      .order('creado_en', { ascending: false })
      .limit(300)

    const { data: rawListings, error: listingsErr } = isAgencyAdmin && agency
      ? await listingsQuery.or(`usuario_id.eq.${userId},agencia_id.eq.${agency.id}`)
      : await listingsQuery.or(`usuario_id.eq.${userId},agente_asignado_id.eq.${userId}`)

    if (listingsErr) {
      return NextResponse.json({ error: 'No se pudo cargar la cartera analítica' }, { status: 500 })
    }

    const listings = (rawListings || []) as RawListingForFunnel[]
    const propertyIds = listings.map((l) => l.id)

    // Determinar asesores relevantes para nombres, reseñas y tiempo de respuesta
    const advisorIdsSet = new Set<string>([userId])
    if (isAgencyAdmin) {
      for (const mId of activeMemberIds) advisorIdsSet.add(mId)
    }
    for (const l of listings) {
      if (l.agente_asignado_id) advisorIdsSet.add(l.agente_asignado_id)
      if (l.usuario_id) advisorIdsSet.add(l.usuario_id)
    }
    const advisorIds = Array.from(advisorIdsSet)

    const agentNamesById: Record<string, string> = {}
    if (advisorIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('perfiles')
        .select('id, nombre, empresa_nombre')
        .in('id', advisorIds)
      for (const p of profs || []) {
        if (p?.id) {
          agentNamesById[String(p.id)] =
            String(p.nombre || p.empresa_nombre || 'Asesor').trim() || 'Asesor'
        }
      }
    }

    let events: RawWebEventForFunnel[] = []
    const favMap = new Map<string, number>()
    let conversations: RawConversationForFunnel[] = []
    let visits: RawVisitForFunnel[] = []

    if (propertyIds.length > 0) {
      let eventsQuery = supabaseAdmin
        .from('eventos_web')
        .select('tipo, session_id, meta, creado_en')
        .in('tipo', ['vista_inmueble', 'click_contacto', 'compartir'])
        .in('meta->>inmueble_id', propertyIds)
        .limit(5000)

      if (cutoffIso) {
        eventsQuery = eventsQuery.gte('creado_en', cutoffIso)
      }

      let visitsQuery = supabaseAdmin
        .from('solicitudes_visita')
        .select('id, inmueble_id, agente_id, propietario_id, estado')
        .in('inmueble_id', propertyIds)

      if (cutoffIso) {
        visitsQuery = visitsQuery.gte('creado_en', cutoffIso)
      }

      let convsQuery = supabaseAdmin
        .from('conversaciones')
        .select('id, producto_id')
        .in('producto_id', propertyIds)

      if (cutoffIso) {
        convsQuery = convsQuery.gte('creado_en', cutoffIso)
      }

      const [evRes, favRes, convRes, visRes] = await Promise.all([
        eventsQuery,
        supabaseAdmin.from('favoritos').select('producto_id').in('producto_id', propertyIds),
        convsQuery,
        visitsQuery,
      ])

      events = (evRes.data || []) as RawWebEventForFunnel[]
      for (const f of favRes.data || []) {
        const pid = String((f as any).producto_id || '')
        if (pid) favMap.set(pid, (favMap.get(pid) || 0) + 1)
      }
      conversations = (convRes.data || []) as RawConversationForFunnel[]
      visits = (visRes.data || []) as RawVisitForFunnel[]
    }

    // Calcular tiempo mediano de primera respuesta en los últimos 90 días
    const conv90Cutoff = new Date(Date.now() - 90 * 86400 * 1000).toISOString()
    const { data: recentConvs } = await supabaseAdmin
      .from('conversaciones')
      .select('id')
      .or(
        isAgencyAdmin && agency
          ? `user1_id.eq.${userId},user2_id.eq.${userId},agencia_id.eq.${agency.id}`
          : `user1_id.eq.${userId},user2_id.eq.${userId},agente_asignado_id.eq.${userId}`,
      )
      .gte('creado_en', conv90Cutoff)
      .limit(80)

    let responseSpeed = computeMedianFirstResponseMinutes([], advisorIdsSet)
    const recentConvIds = (recentConvs || []).map((c: any) => c.id).filter(Boolean)
    if (recentConvIds.length > 0) {
      const { data: msgRows } = await supabaseAdmin
        .from('mensajes')
        .select('conversacion_id, remitente_id, creado_en')
        .in('conversacion_id', recentConvIds)
        .gte('creado_en', conv90Cutoff)
        .order('creado_en', { ascending: true })
        .limit(800)

      responseSpeed = computeMedianFirstResponseMinutes(msgRows || [], advisorIdsSet)
    }

    const { items, summary } = computePortfolioListingFunnels({
      listings,
      events,
      favoriteCountsByProperty: favMap,
      conversations,
      visits,
    })

    // Desglose por asesor para agencias multi-agente
    let byAgent: ReturnType<typeof aggregateAgentPerformance> = []
    if (isAgencyAdmin && agency) {
      const { data: reviewRows } = await supabaseAdmin
        .from('resenas')
        .select('vendedor_id, puntuacion')
        .in('vendedor_id', advisorIds)

      const revAgg = new Map<string, { sum: number; count: number }>()
      for (const r of reviewRows || []) {
        const vid = String((r as any).vendedor_id || '')
        if (!vid) continue
        const cur = revAgg.get(vid) || { sum: 0, count: 0 }
        cur.sum += Number((r as any).puntuacion || 0)
        cur.count += 1
        revAgg.set(vid, cur)
      }

      const reviewsByAgentId = new Map<string, { count: number; avg: number }>()
      for (const [vid, agg] of revAgg.entries()) {
        reviewsByAgentId.set(vid, {
          count: agg.count,
          avg: agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
        })
      }

      const agencyMemberNames = new Map<string, string>()
      for (const mId of activeMemberIds) {
        agencyMemberNames.set(mId, agentNamesById[mId] || 'Asesor')
      }

      byAgent = aggregateAgentPerformance({
        listingFunnels: items,
        agentNamesById: agencyMemberNames,
        reviewsByAgentId,
      })
    }

    return NextResponse.json({
      days,
      isAgencyAdmin,
      agencyName: agency?.nombre || null,
      summary,
      responseSpeed,
      items,
      agentNamesById,
      byAgent,
    })
  } catch {
    return NextResponse.json({ error: 'Error inesperado al calcular el embudo' }, { status: 500 })
  }
}
