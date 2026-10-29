import { NextRequest, NextResponse } from 'next/server'
import { emailCreditosAgregados } from '@/lib/server-email'
import { notifyUser } from '@/lib/push-notify'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { userId, cantidad, balanceTotal } = body
    const creditos = Number(cantidad)
    const balance = balanceTotal === undefined ? creditos : Number(balanceTotal)
    if (!isValidUUID(userId) || !Number.isFinite(creditos) || creditos <= 0 || !Number.isFinite(balance)) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos' }, { status: 400 })
    }

    const { data: userData, error } = await auth.supabaseAdmin.auth.admin.getUserById(userId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const user = userData.user
    if (!user?.email) return NextResponse.json({ ok: false, error: 'Email no encontrado' }, { status: 404 })

    const nombre = user.email.split('@')[0]
    await emailCreditosAgregados(user.email, nombre, creditos, balance)
    await notifyUser(auth.supabaseAdmin, userId, {
      title: '💰 Créditos recibidos',
      body: `${creditos} créditos fueron agregados a tu cuenta. Balance total: ${balance}.`,
      tag: 'creditos-email',
      icon: '/icon-192.png',
      click_url: '/creditos',
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
