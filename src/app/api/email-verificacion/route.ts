import { NextRequest, NextResponse } from 'next/server'
import { emailVerificacionAprobada, emailSubidaNivel } from '@/lib/server-email'
import { requireAuthenticatedUser, isAdminUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rate-limit'

const NIVELES = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Maestro']

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { userId, nuevoNivel, nivelAnterior } = body
    if (!isValidUUID(userId)) return NextResponse.json({ ok: false, error: 'userId inválido' }, { status: 400 })

    const admin = isAdminUser(auth.user)
    const isSelf = userId === auth.user.id
    if (!admin && !isSelf) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })

    const { data: userData, error } = await auth.supabaseAdmin.auth.admin.getUserById(userId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const targetUser = userData.user
    if (!targetUser?.email) return NextResponse.json({ ok: false, error: 'Email no encontrado' }, { status: 404 })

    if (!admin) {
      // Los usuarios sólo pueden enviar a sí mismos el aviso de subida de nivel,
      // y el nivel debe coincidir con el perfil actual. No pueden simular aprobación.
      if (typeof nuevoNivel !== 'string' || typeof nivelAnterior !== 'string') {
        return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
      }
      const { data: perfil } = await auth.supabaseAdmin
        .from('perfiles')
        .select('nivel_confianza')
        .eq('id', auth.user.id)
        .maybeSingle()
      const nivelActual = Number(perfil?.nivel_confianza)
      if (!Number.isInteger(nivelActual) || NIVELES[nivelActual] !== nuevoNivel || NIVELES[nivelActual - 1] !== nivelAnterior) {
        return NextResponse.json({ ok: false, error: 'El cambio de nivel no coincide con el perfil' }, { status: 403 })
      }
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const rateLimit = await checkRateLimit('email:level-up', auth.user.id, { ip })
      if (!rateLimit.ok) return NextResponse.json({ ok: false, error: 'Ya se envió recientemente un aviso de nivel' }, { status: 429 })
    }

    const nombre = targetUser.email.split('@')[0]
    if (admin && typeof nuevoNivel === 'string' && typeof nivelAnterior === 'string') {
      await emailSubidaNivel(targetUser.email, nombre, nuevoNivel, nivelAnterior)
    } else if (admin) {
      await emailVerificacionAprobada(targetUser.email, nombre)
    } else {
      await emailSubidaNivel(targetUser.email, nombre, nuevoNivel, nivelAnterior)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
