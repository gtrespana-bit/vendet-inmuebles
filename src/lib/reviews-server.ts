import type { SupabaseClient } from '@supabase/supabase-js'

export type VerifiedInteractionOrigin =
  | 'cierre_operacion'
  | 'visita_confirmada'
  | 'conversacion'

export interface ReviewEligibilityResult {
  eligible: boolean
  alreadyReviewed: boolean
  targetSellerId: string | null
  interactionType: VerifiedInteractionOrigin | null
  visitId: string | null
  reason?: string
}

/**
 * Verifica de forma estricta si `buyerId` mantuvo una interacción inmobiliaria real
 * sobre `propertyId` que habilite emitir una reseña verificada:
 * 1) Cierre de operación (`comprador_id = buyerId` o inmueble vendido con interacción previa)
 * 2) Visita o videollamada confirmada/atendida (`solicitudes_visita`)
 * 3) Conversación bidireccional real en `mensajes` (ambas partes escribieron >= 1 mensaje)
 */
export async function verificarElegibilidadResena(
  supabaseAdmin: SupabaseClient,
  {
    propertyId,
    buyerId,
    preferredSellerId,
  }: {
    propertyId: string
    buyerId: string
    preferredSellerId?: string | null
  },
): Promise<ReviewEligibilityResult> {
  const { data: inmueble, error: propError } = await supabaseAdmin
    .from('inmuebles')
    .select('id, usuario_id, agente_asignado_id, agencia_id, activo, vendido, comprador_id')
    .eq('id', propertyId)
    .maybeSingle()

  if (propError || !inmueble) {
    return {
      eligible: false,
      alreadyReviewed: false,
      targetSellerId: null,
      interactionType: null,
      visitId: null,
      reason: 'Inmueble no encontrado.',
    }
  }

  const validSellerCandidates = new Set<string>(
    [inmueble.agente_asignado_id, inmueble.usuario_id].filter(Boolean) as string[],
  )

  const targetSellerId =
    preferredSellerId && validSellerCandidates.has(preferredSellerId)
      ? preferredSellerId
      : (inmueble.agente_asignado_id || inmueble.usuario_id)

  if (!targetSellerId || validSellerCandidates.has(buyerId) || buyerId === targetSellerId) {
    return {
      eligible: false,
      alreadyReviewed: false,
      targetSellerId,
      interactionType: null,
      visitId: null,
      reason: 'No puedes calificar tu propia publicación.',
    }
  }

  // Impedir reseñas cruzadas entre miembros activos de la misma agencia
  if (inmueble.agencia_id) {
    const { data: sameAgency } = await supabaseAdmin
      .from('agencia_miembros')
      .select('user_id')
      .eq('agencia_id', inmueble.agencia_id)
      .eq('user_id', buyerId)
      .eq('estado', 'activo')
      .maybeSingle()

    if (sameAgency) {
      return {
        eligible: false,
        alreadyReviewed: false,
        targetSellerId,
        interactionType: null,
        visitId: null,
        reason: 'Los integrantes de la misma agencia no pueden calificarse entre sí.',
      }
    }
  }

  // ¿Ya dejó reseña sobre este inmueble para este asesor/propietario?
  const { count: existingCount } = await supabaseAdmin
    .from('resenas')
    .select('id', { count: 'exact', head: true })
    .eq('producto_id', propertyId)
    .eq('comprador_id', buyerId)
    .in('vendedor_id', Array.from(validSellerCandidates))

  if ((existingCount || 0) > 0) {
    return {
      eligible: false,
      alreadyReviewed: true,
      targetSellerId,
      interactionType: null,
      visitId: null,
      reason: 'Ya registraste una reseña sobre este inmueble.',
    }
  }

  // 1. Verificar visita confirmada o atendida
  const { data: visitRow } = await supabaseAdmin
    .from('solicitudes_visita')
    .select('id, agente_id, propietario_id, estado')
    .eq('inmueble_id', propertyId)
    .eq('solicitante_user_id', buyerId)
    .in('estado', ['confirmada', 'atendida'])
    .order('actualizado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 2. Verificar conversación bidireccional en chat
  let hasBidirectionalChat = false
  let chatCounterpartyId: string | null = null

  for (const candidateId of validSellerCandidates) {
    const [u1, u2] = [buyerId, candidateId].sort()
    const { data: conv } = await supabaseAdmin
      .from('conversaciones')
      .select('id')
      .eq('producto_id', propertyId)
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle()

    if (conv?.id) {
      const [{ count: buyerMsgCount }, { count: sellerMsgCount }] = await Promise.all([
        supabaseAdmin
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .eq('conversacion_id', conv.id)
          .eq('remitente_id', buyerId),
        supabaseAdmin
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .eq('conversacion_id', conv.id)
          .eq('remitente_id', candidateId),
      ])

      if ((buyerMsgCount || 0) >= 1 && (sellerMsgCount || 0) >= 1) {
        hasBidirectionalChat = true
        chatCounterpartyId = candidateId
        break
      }
    }
  }

  if (
    inmueble.comprador_id === buyerId ||
    (inmueble.vendido && (Boolean(visitRow) || hasBidirectionalChat))
  ) {
    return {
      eligible: true,
      alreadyReviewed: false,
      targetSellerId: visitRow?.agente_id || chatCounterpartyId || targetSellerId,
      interactionType: 'cierre_operacion',
      visitId: visitRow?.id || null,
    }
  }

  if (visitRow) {
    const resolvedVisitAdvisor =
      visitRow.agente_id && validSellerCandidates.has(visitRow.agente_id)
        ? visitRow.agente_id
        : targetSellerId
    return {
      eligible: true,
      alreadyReviewed: false,
      targetSellerId: resolvedVisitAdvisor,
      interactionType: 'visita_confirmada',
      visitId: visitRow.id,
    }
  }

  if (hasBidirectionalChat) {
    return {
      eligible: true,
      alreadyReviewed: false,
      targetSellerId: chatCounterpartyId || targetSellerId,
      interactionType: 'conversacion',
      visitId: null,
    }
  }

  return {
    eligible: false,
    alreadyReviewed: false,
    targetSellerId,
    interactionType: null,
    visitId: null,
    reason:
      'Para dejar una reseña verificada necesitas haber recibido respuesta en el chat del inmueble o contar con una visita confirmada.',
  }
}

export function formatReviewerPublicName(rawName: string | null | undefined): string {
  const clean = String(rawName || '').trim()
  if (!clean) return 'Usuario verificado'
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 24)
  const first = parts[0].slice(0, 20)
  const lastInitial = parts[1].charAt(0).toUpperCase()
  return `${first} ${lastInitial}.`
}
