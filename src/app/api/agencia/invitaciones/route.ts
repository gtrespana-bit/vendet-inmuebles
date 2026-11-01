import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { getUserAgencyContext } from '@/lib/agency-server'
import {
  canManageAgencyTeam,
  generateInviteToken,
  hashInviteToken,
  isValidAgencyRole,
  normalizeInviteEmail,
} from '@/lib/agency'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import { emailInvitacionAgencia } from '@/lib/server-email'
import { SITE_URL } from '@/lib/seo-metadata'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rl = await checkRateLimit('agencia:invitar', user.id, { ip })
    if (!rl.ok) {
      return NextResponse.json({ error: 'Has enviado demasiadas invitaciones recientemente. Intenta más tarde.' }, { status: 429 })
    }

    const { agency } = await getUserAgencyContext(supabaseAdmin, user.id)
    if (!agency || !canManageAgencyTeam(user.id, agency.owner_id, agency.rol)) {
      return NextResponse.json({ error: 'Solo el titular o administrador de una agencia puede invitar agentes' }, { status: 403 })
    }
    if (!agency.agenciaPlanActivo) {
      return NextResponse.json(
        { error: 'Necesitas tener el Plan Agencia activo para incorporar nuevos agentes al equipo' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const emailParsed = normalizeInviteEmail(body.email)
    if (!emailParsed.ok) {
      return NextResponse.json({ error: emailParsed.error }, { status: 400 })
    }

    const rol = isValidAgencyRole(body.rol) ? body.rol : 'agente'
    if (rol === 'admin' && !agency.isOwner) {
      return NextResponse.json({ error: 'Solo el titular principal de la agencia puede nombrar administradores' }, { status: 403 })
    }

    const locale = body.locale === 'en' ? 'en' : 'es'

    // Si se especificó email, comprobar que no sea ya miembro activo de esta agencia
    if (emailParsed.email) {
      const { data: existingUser } = await supabaseAdmin
        .from('perfiles')
        .select('id, email')
        .ilike('email', emailParsed.email)
        .maybeSingle()

      if (existingUser?.id) {
        const { data: existingMember } = await supabaseAdmin
          .from('agencia_miembros')
          .select('agencia_id')
          .eq('user_id', existingUser.id)
          .eq('estado', 'activo')
          .maybeSingle()

        if (existingMember?.agencia_id === agency.id) {
          return NextResponse.json({ error: 'Este agente ya forma parte activa de tu equipo' }, { status: 409 })
        }
        if (existingMember?.agencia_id) {
          return NextResponse.json({ error: 'Esa cuenta ya está vinculada activamente a otra agencia inmobiliaria' }, { status: 409 })
        }
      }

      // Revocar invitaciones pendientes previas al mismo correo en esta agencia para evitar confusión
      await supabaseAdmin
        .from('agencia_invitaciones')
        .update({ estado: 'revocada' })
        .eq('agencia_id', agency.id)
        .eq('estado', 'pendiente')
        .ilike('email', emailParsed.email)
    }

    const rawToken = generateInviteToken()
    const tokenHash = hashInviteToken(rawToken)
    const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invitacion, error: insertError } = await supabaseAdmin
      .from('agencia_invitaciones')
      .insert({
        agencia_id: agency.id,
        email: emailParsed.email,
        rol,
        token_hash: tokenHash,
        invitado_por: user.id,
        estado: 'pendiente',
        expira_en: expiraEn,
      })
      .select('id, email, rol, estado, expira_en, creado_en')
      .single()

    if (insertError || !invitacion) {
      return NextResponse.json({ error: insertError?.message || 'No se pudo generar la invitación' }, { status: 500 })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_URL || SITE_URL).replace(/\/$/, '')
    const invitePath = `${locale === 'en' ? '/en' : ''}/invitacion/${rawToken}`
    const inviteUrl = `${baseUrl}${invitePath}`

    let emailEnviado = false
    if (emailParsed.email) {
      const { data: inviterProfile } = await supabaseAdmin
        .from('perfiles')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle()
      const inviterName = inviterProfile?.nombre || agency.nombre
      emailEnviado = await emailInvitacionAgencia(
        emailParsed.email,
        agency.nombre,
        inviterName,
        rol,
        inviteUrl
      )
    }

    return NextResponse.json(
      {
        ok: true,
        invitacion,
        inviteUrl,
        emailEnviado,
      },
      { status: 201 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al crear la invitación' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const id = new URL(req.url).searchParams.get('id') || ''
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Identificador de invitación inválido' }, { status: 400 })
    }

    const { agency } = await getUserAgencyContext(supabaseAdmin, user.id)
    if (!agency || !canManageAgencyTeam(user.id, agency.owner_id, agency.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('agencia_invitaciones')
      .update({ estado: 'revocada' })
      .eq('id', id)
      .eq('agencia_id', agency.id)
      .eq('estado', 'pendiente')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al revocar la invitación' }, { status: 500 })
  }
}
