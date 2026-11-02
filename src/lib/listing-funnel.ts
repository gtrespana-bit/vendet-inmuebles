/**
 * Motor isomórfico de Embudo de Conversión, Velocidad de Respuesta y Reputación (Etapa C).
 * Sin directiva `'use client'` ni alias `@/` para compatibilidad total con RSC, API y tests Node.
 */

export type ContactChannel = 'whatsapp' | 'llamar' | 'chat' | 'email' | 'messenger'

export type FunnelDiagnosticCode =
  | 'pending_visits'
  | 'strong_conversion'
  | 'high_views_low_leads'
  | 'high_favorites_no_visits'
  | 'building_traction'

export interface RawListingForFunnel {
  id: string
  slug?: string | null
  titulo: string
  precio?: number | null
  moneda?: string | null
  ciudad?: string | null
  estado?: string | null
  activo?: boolean | null
  vendido?: boolean | null
  destacado?: boolean | null
  visitas?: number | null
  usuario_id: string
  agente_asignado_id?: string | null
  creado_en?: string | null
}

export interface RawWebEventForFunnel {
  tipo: string
  session_id?: string | null
  meta?: Record<string, unknown> | null
  creado_en?: string | null
}

export interface RawVisitForFunnel {
  id: string
  inmueble_id: string
  agente_id?: string | null
  propietario_id: string
  estado: string
}

export interface RawConversationForFunnel {
  id: string
  producto_id?: string | null
}

export interface ListingFunnelMetrics {
  propertyId: string
  slug: string | null
  title: string
  price: number
  city: string | null
  state: string | null
  active: boolean
  sold: boolean
  featured: boolean
  assignedAgentId: string
  lifetimeViews: number
  periodViews: number
  uniqueViewSessions: number
  effectiveViews: number
  favorites: number
  shares: number
  whatsappClicks: number
  phoneClicks: number
  emailClicks: number
  messengerClicks: number
  chatClicks: number
  conversationsStarted: number
  totalContacts: number
  visitRequests: number
  confirmedVisits: number
  pendingVisits: number
  totalLeads: number
  viewToLeadPct: number
  leadToVisitPct: number
  diagnostic: FunnelDiagnosticCode
}

export interface PortfolioFunnelSummary {
  totalListings: number
  activeListings: number
  lifetimeViews: number
  periodViews: number
  effectiveViews: number
  favorites: number
  shares: number
  whatsappClicks: number
  phoneClicks: number
  emailClicks: number
  chatLeads: number
  totalContacts: number
  visitRequests: number
  confirmedVisits: number
  pendingVisits: number
  totalLeads: number
  viewToLeadPct: number
  leadToVisitPct: number
}

export interface AgentPerformanceRow {
  agentId: string
  agentName: string
  activeListings: number
  soldListings: number
  effectiveViews: number
  favorites: number
  totalContacts: number
  visitRequests: number
  confirmedVisits: number
  totalLeads: number
  viewToLeadPct: number
  reviewCount: number
  averageRating: number
}

export type ResponseSpeedTier =
  | 'fast_under_1h'
  | 'same_day'
  | 'within_24h'
  | 'over_24h'
  | 'insufficient_data'

export interface ResponseSpeedSummary {
  medianMinutes: number | null
  sampleConversations: number
  tier: ResponseSpeedTier
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function normalizeChannel(raw: unknown): ContactChannel | null {
  const clean = String(raw || '').trim().toLowerCase()
  if (clean === 'whatsapp' || clean === 'wa') return 'whatsapp'
  if (clean === 'llamar' || clean === 'telefono' || clean === 'phone' || clean === 'call') return 'llamar'
  if (clean === 'chat') return 'chat'
  if (clean === 'email' || clean === 'correo') return 'email'
  if (clean === 'messenger') return 'messenger'
  return null
}

export function computePortfolioListingFunnels({
  listings,
  events,
  favoriteCountsByProperty,
  conversations,
  visits,
}: {
  listings: RawListingForFunnel[]
  events: RawWebEventForFunnel[]
  favoriteCountsByProperty: Map<string, number> | Record<string, number>
  conversations: RawConversationForFunnel[]
  visits: RawVisitForFunnel[]
}): {
  items: ListingFunnelMetrics[]
  summary: PortfolioFunnelSummary
} {
  const favLookup = (id: string): number => {
    if (favoriteCountsByProperty instanceof Map) {
      return Number(favoriteCountsByProperty.get(id) || 0)
    }
    return Number((favoriteCountsByProperty as Record<string, number>)[id] || 0)
  }

  const eventStats = new Map<
    string,
    {
      periodViews: number
      sessions: Set<string>
      shares: number
      whatsapp: number
      llamar: number
      email: number
      messenger: number
      chat: number
    }
  >()

  const ensureStat = (propId: string) => {
    let cur = eventStats.get(propId)
    if (!cur) {
      cur = {
        periodViews: 0,
        sessions: new Set<string>(),
        shares: 0,
        whatsapp: 0,
        llamar: 0,
        email: 0,
        messenger: 0,
        chat: 0,
      }
      eventStats.set(propId, cur)
    }
    return cur
  }

  for (const ev of events) {
    const propId = typeof ev.meta?.inmueble_id === 'string' ? ev.meta.inmueble_id.trim() : ''
    if (!propId) continue
    const st = ensureStat(propId)

    if (ev.tipo === 'vista_inmueble') {
      st.periodViews += 1
      if (ev.session_id) st.sessions.add(String(ev.session_id))
    } else if (ev.tipo === 'compartir') {
      st.shares += 1
    } else if (ev.tipo === 'click_contacto') {
      const ch = normalizeChannel(ev.meta?.canal)
      if (ch === 'whatsapp') st.whatsapp += 1
      else if (ch === 'llamar') st.llamar += 1
      else if (ch === 'email') st.email += 1
      else if (ch === 'messenger') st.messenger += 1
      else if (ch === 'chat') st.chat += 1
    }
  }

  const convCountByProp = new Map<string, number>()
  for (const c of conversations) {
    if (!c.producto_id) continue
    convCountByProp.set(c.producto_id, (convCountByProp.get(c.producto_id) || 0) + 1)
  }

  const visitStatsByProp = new Map<
    string,
    { total: number; confirmed: number; pending: number }
  >()
  for (const v of visits) {
    if (!v.inmueble_id) continue
    const cur = visitStatsByProp.get(v.inmueble_id) || { total: 0, confirmed: 0, pending: 0 }
    cur.total += 1
    if (v.estado === 'confirmada' || v.estado === 'atendida') cur.confirmed += 1
    else if (v.estado === 'pendiente') cur.pending += 1
    visitStatsByProp.set(v.inmueble_id, cur)
  }

  const items: ListingFunnelMetrics[] = listings.map((listing) => {
    const st = eventStats.get(listing.id)
    const vSt = visitStatsByProp.get(listing.id)
    const lifetimeViews = Math.max(0, Number(listing.visitas || 0))
    const periodViews = st?.periodViews || 0
    const uniqueViewSessions = st?.sessions.size || 0
    const effectiveViews = Math.max(periodViews, lifetimeViews)
    const favorites = Math.max(0, favLookup(listing.id))
    const shares = st?.shares || 0
    const whatsappClicks = st?.whatsapp || 0
    const phoneClicks = st?.llamar || 0
    const emailClicks = st?.email || 0
    const messengerClicks = st?.messenger || 0
    const chatClicks = st?.chat || 0
    const conversationsStarted = convCountByProp.get(listing.id) || 0
    const chatEffective = Math.max(conversationsStarted, chatClicks)

    const totalContacts = whatsappClicks + phoneClicks + emailClicks + messengerClicks + chatEffective
    const visitRequests = vSt?.total || 0
    const confirmedVisits = vSt?.confirmed || 0
    const pendingVisits = vSt?.pending || 0
    const totalLeads = totalContacts + visitRequests

    const viewToLeadPct =
      effectiveViews > 0 ? Math.min(100, round1((totalLeads / effectiveViews) * 100)) : 0
    const leadToVisitPct =
      totalLeads > 0 ? Math.min(100, round1((visitRequests / totalLeads) * 100)) : 0

    let diagnostic: FunnelDiagnosticCode = 'building_traction'
    if (pendingVisits > 0) {
      diagnostic = 'pending_visits'
    } else if (confirmedVisits >= 1 || (effectiveViews >= 10 && viewToLeadPct >= 5)) {
      diagnostic = 'strong_conversion'
    } else if (effectiveViews >= 25 && totalLeads === 0) {
      diagnostic = 'high_views_low_leads'
    } else if (favorites >= 3 && visitRequests === 0) {
      diagnostic = 'high_favorites_no_visits'
    }

    return {
      propertyId: listing.id,
      slug: listing.slug || null,
      title: listing.titulo || 'Inmueble',
      price: Number(listing.precio || 0),
      city: listing.ciudad || null,
      state: listing.estado || null,
      active: Boolean(listing.activo && !listing.vendido),
      sold: Boolean(listing.vendido),
      featured: Boolean(listing.destacado),
      assignedAgentId: listing.agente_asignado_id || listing.usuario_id,
      lifetimeViews,
      periodViews,
      uniqueViewSessions,
      effectiveViews,
      favorites,
      shares,
      whatsappClicks,
      phoneClicks,
      emailClicks,
      messengerClicks,
      chatClicks,
      conversationsStarted,
      totalContacts,
      visitRequests,
      confirmedVisits,
      pendingVisits,
      totalLeads,
      viewToLeadPct,
      leadToVisitPct,
      diagnostic,
    }
  })

  items.sort((a, b) => b.totalLeads - a.totalLeads || b.effectiveViews - a.effectiveViews)

  const summary: PortfolioFunnelSummary = {
    totalListings: items.length,
    activeListings: items.filter((i) => i.active).length,
    lifetimeViews: items.reduce((s, i) => s + i.lifetimeViews, 0),
    periodViews: items.reduce((s, i) => s + i.periodViews, 0),
    effectiveViews: items.reduce((s, i) => s + i.effectiveViews, 0),
    favorites: items.reduce((s, i) => s + i.favorites, 0),
    shares: items.reduce((s, i) => s + i.shares, 0),
    whatsappClicks: items.reduce((s, i) => s + i.whatsappClicks, 0),
    phoneClicks: items.reduce((s, i) => s + i.phoneClicks, 0),
    emailClicks: items.reduce((s, i) => s + i.emailClicks, 0),
    chatLeads: items.reduce((s, i) => s + Math.max(i.conversationsStarted, i.chatClicks), 0),
    totalContacts: items.reduce((s, i) => s + i.totalContacts, 0),
    visitRequests: items.reduce((s, i) => s + i.visitRequests, 0),
    confirmedVisits: items.reduce((s, i) => s + i.confirmedVisits, 0),
    pendingVisits: items.reduce((s, i) => s + i.pendingVisits, 0),
    totalLeads: items.reduce((s, i) => s + i.totalLeads, 0),
    viewToLeadPct: 0,
    leadToVisitPct: 0,
  }

  summary.viewToLeadPct =
    summary.effectiveViews > 0
      ? Math.min(100, round1((summary.totalLeads / summary.effectiveViews) * 100))
      : 0
  summary.leadToVisitPct =
    summary.totalLeads > 0
      ? Math.min(100, round1((summary.visitRequests / summary.totalLeads) * 100))
      : 0

  return { items, summary }
}

export function aggregateAgentPerformance({
  listingFunnels,
  agentNamesById,
  reviewsByAgentId,
}: {
  listingFunnels: ListingFunnelMetrics[]
  agentNamesById: Map<string, string> | Record<string, string>
  reviewsByAgentId?: Map<string, { count: number; avg: number }>
}): AgentPerformanceRow[] {
  const getName = (id: string): string => {
    if (agentNamesById instanceof Map) return agentNamesById.get(id) || 'Asesor'
    return (agentNamesById as Record<string, string>)[id] || 'Asesor'
  }

  const map = new Map<string, AgentPerformanceRow>()

  const seedIds =
    agentNamesById instanceof Map
      ? Array.from(agentNamesById.keys())
      : Object.keys(agentNamesById)

  for (const agentId of seedIds) {
    const rev = reviewsByAgentId?.get(agentId)
    map.set(agentId, {
      agentId,
      agentName: getName(agentId),
      activeListings: 0,
      soldListings: 0,
      effectiveViews: 0,
      favorites: 0,
      totalContacts: 0,
      visitRequests: 0,
      confirmedVisits: 0,
      totalLeads: 0,
      viewToLeadPct: 0,
      reviewCount: rev?.count || 0,
      averageRating: rev?.avg || 0,
    })
  }

  for (const item of listingFunnels) {
    const id = item.assignedAgentId
    const rev = reviewsByAgentId?.get(id)
    const row = map.get(id) || {
      agentId: id,
      agentName: getName(id),
      activeListings: 0,
      soldListings: 0,
      effectiveViews: 0,
      favorites: 0,
      totalContacts: 0,
      visitRequests: 0,
      confirmedVisits: 0,
      totalLeads: 0,
      viewToLeadPct: 0,
      reviewCount: rev?.count || 0,
      averageRating: rev?.avg || 0,
    }

    if (item.active) row.activeListings += 1
    if (item.sold) row.soldListings += 1
    row.effectiveViews += item.effectiveViews
    row.favorites += item.favorites
    row.totalContacts += item.totalContacts
    row.visitRequests += item.visitRequests
    row.confirmedVisits += item.confirmedVisits
    row.totalLeads += item.totalLeads
    map.set(id, row)
  }

  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    viewToLeadPct:
      r.effectiveViews > 0 ? Math.min(100, round1((r.totalLeads / r.effectiveViews) * 100)) : 0,
  }))

  rows.sort((a, b) => b.totalLeads - a.totalLeads || b.effectiveViews - a.effectiveViews)
  return rows
}

export interface RawMessageForResponseSpeed {
  conversacion_id: string
  remitente_id: string
  creado_en: string
}

export function computeMedianFirstResponseMinutes(
  messages: RawMessageForResponseSpeed[],
  advisorIds: Set<string> | string[],
): ResponseSpeedSummary {
  const advisorSet = advisorIds instanceof Set ? advisorIds : new Set(advisorIds)
  if (advisorSet.size === 0 || messages.length === 0) {
    return { medianMinutes: null, sampleConversations: 0, tier: 'insufficient_data' }
  }

  const byConv = new Map<string, RawMessageForResponseSpeed[]>()
  for (const m of messages) {
    if (!m.conversacion_id || !m.creado_en) continue
    const list = byConv.get(m.conversacion_id) || []
    list.push(m)
    byConv.set(m.conversacion_id, list)
  }

  const deltasMinutes: number[] = []
  const MAX_WINDOW_MINUTES = 72 * 60 // 72 horas

  for (const list of byConv.values()) {
    list.sort((a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime())
    const firstBuyerMsg = list.find((m) => !advisorSet.has(m.remitente_id))
    if (!firstBuyerMsg) continue
    const buyerTs = new Date(firstBuyerMsg.creado_en).getTime()
    if (Number.isNaN(buyerTs)) continue

    const firstAdvisorReply = list.find(
      (m) => advisorSet.has(m.remitente_id) && new Date(m.creado_en).getTime() >= buyerTs,
    )
    if (!firstAdvisorReply) continue
    const replyTs = new Date(firstAdvisorReply.creado_en).getTime()
    if (Number.isNaN(replyTs)) continue

    const diffMin = Math.max(1, Math.round((replyTs - buyerTs) / 60000))
    if (diffMin <= MAX_WINDOW_MINUTES) {
      deltasMinutes.push(diffMin)
    }
  }

  if (deltasMinutes.length === 0) {
    return { medianMinutes: null, sampleConversations: 0, tier: 'insufficient_data' }
  }

  deltasMinutes.sort((a, b) => a - b)
  const mid = Math.floor(deltasMinutes.length / 2)
  const median =
    deltasMinutes.length % 2 === 1
      ? deltasMinutes[mid]
      : Math.round((deltasMinutes[mid - 1] + deltasMinutes[mid]) / 2)

  let tier: ResponseSpeedTier = 'over_24h'
  if (median <= 60) tier = 'fast_under_1h'
  else if (median <= 360) tier = 'same_day'
  else if (median <= 1440) tier = 'within_24h'

  return {
    medianMinutes: median,
    sampleConversations: deltasMinutes.length,
    tier,
  }
}

export interface ReviewDistributionSummary {
  total: number
  average: number
  countsByStar: Record<1 | 2 | 3 | 4 | 5, number>
  countsByOrigin: {
    visita_confirmada: number
    conversacion: number
    cierre_operacion: number
  }
}

export function computeReviewDistribution(
  reviews: Array<{ puntuacion?: number | null; tipo_interaccion?: string | null }>,
): ReviewDistributionSummary {
  const countsByStar: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const countsByOrigin = {
    visita_confirmada: 0,
    conversacion: 0,
    cierre_operacion: 0,
  }

  let sum = 0
  let total = 0
  for (const r of reviews) {
    const score = Math.round(Number(r.puntuacion || 0))
    if (score >= 1 && score <= 5) {
      countsByStar[score as 1 | 2 | 3 | 4 | 5] += 1
      sum += score
      total += 1
    }
    if (r.tipo_interaccion === 'visita_confirmada') countsByOrigin.visita_confirmada += 1
    else if (r.tipo_interaccion === 'cierre_operacion') countsByOrigin.cierre_operacion += 1
    else if (score >= 1 && score <= 5) countsByOrigin.conversacion += 1
  }

  return {
    total,
    average: total > 0 ? round1(sum / total) : 0,
    countsByStar,
    countsByOrigin,
  }
}

function escapeCsvCell(raw: unknown): string {
  const str = String(raw ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim()
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  if (/[",;]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export function buildFunnelCsv(
  items: ListingFunnelMetrics[],
  agentNamesById: Record<string, string> = {},
  locale: 'es' | 'en' = 'es',
): string {
  const isEn = locale === 'en'
  const headers = isEn
    ? [
        'Property',
        'Location',
        'Price USD',
        'Assigned Advisor',
        'Views',
        'Favorites',
        'WhatsApp Clicks',
        'Phone Clicks',
        'Chats',
        'Visit Requests',
        'Confirmed Visits',
        'Total Leads',
        'Conversion %',
      ]
    : [
        'Inmueble',
        'Ubicación',
        'Precio USD',
        'Asesor asignado',
        'Vistas',
        'Favoritos',
        'Clics WhatsApp',
        'Clics Llamada',
        'Chats',
        'Solicitudes Visita',
        'Visitas Confirmadas',
        'Total Leads',
        'Conversión %',
      ]

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...items.map((item) =>
      [
        item.title,
        [item.city, item.state].filter(Boolean).join(', '),
        item.price,
        agentNamesById[item.assignedAgentId] || '',
        item.effectiveViews,
        item.favorites,
        item.whatsappClicks,
        item.phoneClicks,
        Math.max(item.conversationsStarted, item.chatClicks),
        item.visitRequests,
        item.confirmedVisits,
        item.totalLeads,
        `${item.viewToLeadPct}%`,
      ]
        .map(escapeCsvCell)
        .join(','),
    ),
  ]

  return `\uFEFF${lines.join('\r\n')}`
}
