import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import { notifyUser } from '@/lib/push-notify'
import { notificarResena } from '@/lib/email-eventos'
import {
  formatReviewerPublicName,
  verificarElegibilidadResena,
} from '@/lib/reviews-server'
import {
  computeMedianFirstResponseMinutes,
  computeReviewDistribution,
} from '@/lib/listing-funnel'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/resenas?vendedor_id=<uuid>
 * Devuelve reseñas públicas verificadas de un asesor/agencia (con iniciales de autor,
 * origen de verificación, distribución de estrellas y velocidad mediana de respuesta).
 * Si el usuario está autenticado y pasa `&check_producto_id=<uuid>`, incluye también
 * su elegibilidad para reseñar ese inmueble.
 */
export async function GET(req: NextRequest) {
  try {
    const sellerId = req.nextUrl.searchParams.get('vendedor_id') || ''
    const checkPropertyId = req.nextUrl.searchParams.get('check_producto_id') || ''

    if (!isValidUUID(sellerId)) {
      return NextResponse.json({ error: 'Identificador de anunciante inválido' }, { status: 400 })
    }

    const supabaseAdmin = createServerClient()

    // Verificar si es dueño de agencia para incluir también conversaciones del equipo en tiempo de respuesta
    const { data: ownedAgency } = await supabaseAdmin
      .from('agencias')
      .select('id')
      .eq('owner_id', sellerId)
      .maybeSingle()

    const advisorIds = new Set<string>([sellerId])
    if (ownedAgency?.id) {
      const { data: members } = await supabaseAdmin
        .from('agencia_miembros')
        .select('user_id')
        .eq('agencia_id', ownedAgency.id)
        .eq('estado', 'activo')
      for (const m of members || []) {
        if (m.user_id) advisorIds.add(String(m.user_id))
      }
    }

    const advisorList = Array.from(advisorIds)

    const [{ data: reviewRows, error: revErr }, { data: recentConvs }] = await Promise.all([
      supabaseAdmin
        .from('resenas')
        .select(
          'id, producto_id, vendedor_id, comprador_id, puntuacion, comentario, producto_titulo, tipo_interaccion, respuesta_vendedor, respuesta_en, creado_en',
        )
        .in('vendedor_id', advisorList)
        .order('creado_en', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('conversaciones')
        .select('id')
        .or(`user1_id.eq.${sellerId},user2_id.eq.${sellerId}${ownedAgency?.id ? `,agencia_id.eq.${ownedAgency.id}` : ''}`)
        .order('creado_en', { ascending: false })
        .limit(60),
    ])

    if (revErr) {
      return NextResponse.json({ error: 'No se pudieron consultar las reseñas' }, { status: 500 })
    }

    const list = reviewRows || []
    const buyerIds = Array.from(new Set(list.map((r: any) => r.comprador_id).filter(Boolean)))
    const sellerIds = Array.from(new Set(list.map((r: any) => r.vendedor_id).filter(Boolean)))
    const allProfileIds = Array.from(new Set([...buyerIds, ...sellerIds]))

    const nameMap = new Map<string, string>()
    if (allProfileIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('perfiles')
        .select('id, nombre')
        .in('id', allProfileIds)
      for (const p of profs || []) {
        if (p?.id) nameMap.set(String(p.id), String(p.nombre || ''))
      }
    }

    let responseSpeed = computeMedianFirstResponseMinutes([], advisorIds)
    const convIds = (recentConvs || []).map((c: any) => c.id).filter(Boolean)
    if (convIds.length > 0) {
      const cutoffIso = new Date(Date.now() - 90 * 86400 * 1000).toISOString()
      const { data: msgRows } = await supabaseAdmin
        .from('mensajes')
        .select('conversacion_id, remitente_id, creado_en')
        .in('conversacion_id', convIds)
        .gte('creado_en', cutoffIso)
        .order('creado_en', { ascending: true })
        .limit(600)

      responseSpeed = computeMedianFirstResponseMinutes(msgRows || [], advisorIds)
    }

    const enriched = list.map((r: any) => ({
      id: r.id,
      producto_id: r.producto_id,
      vendedor_id: r.vendedor_id,
      vendedor_nombre: nameMap.get(String(r.vendedor_id)) || null,
      autor_nombre: formatReviewerPublicName(nameMap.get(String(r.comprador_id))),
      puntuacion: Number(r.puntuacion || 0),
      comentario: r.comentario || null,
      producto_titulo: r.producto_titulo || null,
      tipo_interaccion: r.tipo_interaccion || 'conversacion',
      respuesta_vendedor: r.respuesta_vendedor || null,
      respuesta_en: r.respuesta_en || null,
      creado_en: r.creado_en,
    }))

    const distribution = computeReviewDistribution(enriched)

    let eligibility: Awaited<ReturnType<typeof verificarElegibilidadResena>> | null = null
    if (isValidUUID(checkPropertyId)) {
      const auth = await requireAuthenticatedUser(req)
      if (auth.ok) {
        eligibility = await verificarElegibilidadResena(supabaseAdmin, {
          propertyId: checkPropertyId,
          buyerId: auth.user.id,
          preferredSellerId: sellerId,
        })
      }
    }

    return NextResponse.json({
      items: enriched,
      distribution,
      responseSpeed,
      eligibility,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno al cargar reseñas' }, { status: 500 })
  }
}

/**
 * POST /api/resenas
 * Emite una reseña verificada (1..5 estrellas) vinculada a visita confirmada,
 * conversación bidireccional o cierre de operación.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const rl = await checkRateLimit('resena:crear', auth.user.id)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiados intentos seguidos. Intenta de nuevo en unos minutos.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const propertyId = String(body?.producto_id || body?.inmueble_id || '').trim()
    const preferredSellerId =
      typeof body?.vendedor_id === 'string' && isValidUUID(body.vendedor_id)
        ? body.vendedor_id
        : null
    const rating = Number(body?.puntuacion)
    const comment =
      typeof body?.comentario === 'string' ? body.comentario.trim().slice(0, 1500) || null : null

    if (!isValidUUID(propertyId)) {
      return NextResponse.json({ error: 'Inmueble inválido.' }, { status: 400 })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'La calificación debe ser un número entero entre 1 y 5.' },
        { status: 400 },
      )
    }

    const check = await verificarElegibilidadResena(auth.supabaseAdmin, {
      propertyId,
      buyerId: auth.user.id,
      preferredSellerId,
    })

    if (check.alreadyReviewed) {
      return NextResponse.json(
        { error: 'Ya dejaste una reseña sobre este inmueble.' },
        { status: 409 },
      )
    }
    if (!check.eligible || !check.targetSellerId || !check.interactionType) {
      return NextResponse.json(
        { error: check.reason || 'No cumples los requisitos de interacción verificada.' },
        { status: 403 },
      )
    }

    const { data: inserted, error: insertError } = await auth.supabaseAdmin
      .from('resenas')
      .insert({
        producto_id: propertyId,
        vendedor_id: check.targetSellerId,
        comprador_id: auth.user.id,
        puntuacion: rating,
        comentario: comment,
        tipo_interaccion: check.interactionType,
        solicitud_visita_id: check.visitId,
      })
      .select('id, puntuacion, comentario, tipo_interaccion, creado_en')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una reseña registrada para esta propiedad.' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'No se pudo guardar la reseña.' }, { status: 500 })
    }

    void notifyUser(auth.supabaseAdmin, check.targetSellerId, {
      title: `⭐ Nueva reseña verificada (${rating}/5)`,
      body: comment ? comment.slice(0, 110) : 'Un cliente calificó tu atención inmobiliaria.',
      tag: `resena-${inserted.id}`,
      icon: '/icon-192.png',
      click_url: '/dashboard?tab=reputacion',
    }).catch(() => undefined)

    void notificarResena(auth.supabaseAdmin, {
      evaluadoId: check.targetSellerId,
      autorId: auth.user.id,
      puntuacion: rating,
      comentario: comment,
      productoId: propertyId,
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, item: inserted }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error inesperado al registrar reseña.' }, { status: 500 })
  }
}

/**
 * PATCH /api/resenas
 * Permite al asesor evaluado (o al titular activo de su agencia) publicar o editar
 * su respuesta oficial (`respuesta_vendedor`) en una reseña recibida.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const rl = await checkRateLimit('resena:responder', auth.user.id)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Demasiados cambios seguidos. Espera un momento.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const reviewId = String(body?.id || '').trim()
    const replyRaw = typeof body?.respuesta_vendedor === 'string' ? body.respuesta_vendedor : ''
    const cleanReply = replyRaw.trim().slice(0, 1000) || null

    if (!isValidUUID(reviewId)) {
      return NextResponse.json({ error: 'Identificador de reseña inválido.' }, { status: 400 })
    }

    const { data: review, error: findErr } = await auth.supabaseAdmin
      .from('resenas')
      .select('id, vendedor_id, comprador_id, producto_titulo')
      .eq('id', reviewId)
      .maybeSingle()

    if (findErr || !review) {
      return NextResponse.json({ error: 'Reseña no encontrada.' }, { status: 404 })
    }

    let authorized = review.vendedor_id === auth.user.id
    if (!authorized) {
      const { data: memberRow } = await auth.supabaseAdmin
        .from('agencia_miembros')
        .select('agencia_id')
        .eq('user_id', review.vendedor_id)
        .eq('estado', 'activo')
        .maybeSingle()

      if (memberRow?.agencia_id) {
        const { data: agencyRow } = await auth.supabaseAdmin
          .from('agencias')
          .select('owner_id')
          .eq('id', memberRow.agencia_id)
          .maybeSingle()
        if (agencyRow?.owner_id === auth.user.id) {
          authorized = true
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado para responder esta reseña.' }, { status: 403 })
    }

    const nowIso = cleanReply ? new Date().toISOString() : null
    const { data: updated, error: updErr } = await auth.supabaseAdmin
      .from('resenas')
      .update({
        respuesta_vendedor: cleanReply,
        respuesta_en: nowIso,
      })
      .eq('id', reviewId)
      .select('id, respuesta_vendedor, respuesta_en')
      .single()

    if (updErr) {
      return NextResponse.json({ error: 'No se pudo guardar la respuesta.' }, { status: 500 })
    }

    if (cleanReply && review.comprador_id) {
      void notifyUser(auth.supabaseAdmin, review.comprador_id, {
        title: '💬 Respondieron tu reseña',
        body: `El asesor respondió tu calificación${review.producto_titulo ? ` sobre "${review.producto_titulo}"` : ''}.`,
        tag: `resena-reply-${review.id}`,
        icon: '/icon-192.png',
        click_url: `/vendedor/${review.vendedor_id}`,
      }).catch(() => undefined)
    }

    return NextResponse.json({ ok: true, item: updated })
  } catch {
    return NextResponse.json({ error: 'Error inesperado al responder reseña.' }, { status: 500 })
  }
}
