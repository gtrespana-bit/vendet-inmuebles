import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { canInviteMatchUserEmail, hashInviteToken, isValidInviteToken } from '@/lib/agency'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  try {
    const rawToken = new URL(req.url).searchParams.get('token') || ''
    if (!isValidInviteToken(rawToken)) {
      return NextResponse.json({ ok: false, error: 'Enlace de invitación no válido' }, { status: 404 })
    }

    const supabaseAdmin = createServerClient()
    const tokenHash = hashInviteToken(rawToken)

    const { data: invite } = await supabaseAdmin
      .from('agencia_invitaciones')
      .select('id, agencia_id, email, rol, estado, expira_en, invitado_por')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!invite) {
      return NextResponse.json({ ok: false, error: 'Invitación no encontrada' }, { status: 404 })
    }
    if (invite.estado !== 'pendiente' || new Date(invite.expira_en) <= new Date()) {
      return NextResponse.json(
        { ok: false, error: 'Esta invitación ya fue utilizada, revocada o ha expirado', estado: invite.estado },
        { status: 410 }
      )
    }

    const [{ data: agency }, { data: inviter }] = await Promise.all([
      supabaseAdmin
        .from('agencias')
        .select('id, nombre, descripcion, logo_url, owner_id')
        .eq('id', invite.agencia_id)
        .maybeSingle(),
      supabaseAdmin
        .from('perfiles')
        .select('nombre')
        .eq('id', invite.invitado_por)
        .maybeSingle(),
    ])

    if (!agency) {
      return NextResponse.json({ ok: false, error: 'La agencia ya no está disponible' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      invitacion: {
        rol: invite.rol,
        emailDestino: invite.email || null,
        expira_en: invite.expira_en,
      },
      agencia: {
        id: agency.id,
        nombre: agency.nombre,
        descripcion: agency.descripcion,
        logo_url: agency.logo_url,
        invitadoPor: inviter?.nombre || agency.nombre,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error verificando invitación' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const { supabaseAdmin, user } = auth
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rl = await checkRateLimit('agencia:aceptar', user.id, { ip })
    if (!rl.ok) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 })
    }

    const body = await req.json()
    const rawToken = typeof body.token === 'string' ? body.token.trim() : ''
    if (!isValidInviteToken(rawToken)) {
      return NextResponse.json({ error: 'Token de invitación no válido' }, { status: 400 })
    }

    const tokenHash = hashInviteToken(rawToken)
    const { data: invite } = await supabaseAdmin
      .from('agencia_invitaciones')
      .select('id, agencia_id, email, rol, estado, expira_en')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (!invite) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }
    if (invite.estado !== 'pendiente' || new Date(invite.expira_en) <= new Date()) {
      return NextResponse.json({ error: 'Esta invitación ya fue utilizada, revocada o expiró' }, { status: 410 })
    }

    if (!canInviteMatchUserEmail(invite.email, user.email)) {
      return NextResponse.json(
        {
          error: `Esta invitación fue emitida exclusivamente para ${invite.email}. Inicia sesión o regístrate con ese correo.`,
        },
        { status: 403 }
      )
    }

    const [{ data: agency }, { data: currentMembership }, { data: ownedAgency }] = await Promise.all([
      supabaseAdmin
        .from('agencias')
        .select('id, nombre, owner_id')
        .eq('id', invite.agencia_id)
        .maybeSingle(),
      supabaseAdmin
        .from('agencia_miembros')
        .select('id, agencia_id, estado')
        .eq('user_id', user.id)
        .eq('estado', 'activo')
        .maybeSingle(),
      supabaseAdmin
        .from('agencias')
        .select('id, nombre')
        .eq('owner_id', user.id)
        .maybeSingle(),
    ])

    if (!agency) {
      return NextResponse.json({ error: 'La agencia ya no existe' }, { status: 404 })
    }

    if (ownedAgency && ownedAgency.id !== agency.id) {
      return NextResponse.json(
        { error: `Tu cuenta ya es titular de la agencia "${ownedAgency.nombre}". Usa una cuenta de agente independiente.` },
        { status: 409 }
      )
    }

    if (currentMembership && currentMembership.agencia_id !== agency.id) {
      return NextResponse.json(
        { error: 'Ya perteneces activamente a otra agencia. Debes desvincularte primero desde tu panel.' },
        { status: 409 }
      )
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('agencia_miembros')
      .upsert(
        {
          agencia_id: agency.id,
          user_id: user.id,
          rol: agency.owner_id === user.id ? 'admin' : invite.rol,
          estado: 'activo',
        },
        { onConflict: 'agencia_id,user_id' }
      )

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('agencia_invitaciones')
      .update({
        estado: 'aceptada',
        aceptada_por: user.id,
        aceptada_en: new Date().toISOString(),
      })
      .eq('id', invite.id)

    return NextResponse.json({
      ok: true,
      agenciaId: agency.id,
      agenciaNombre: agency.nombre,
      rol: invite.rol,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error al aceptar la invitación' }, { status: 500 })
  }
}
