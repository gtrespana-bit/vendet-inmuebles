import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { CREDIT_PACKAGES, PLAN_PRICES, recipientData } from '@/lib/payment-catalog'
import { getPlanRank } from '@/lib/plan-catalog'
import { getTasaBCV } from '@/lib/tasaBCV'
import { checkRateLimit } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  const { data, error } = await auth.supabaseAdmin.from('ordenes_pago').select('*, suscripciones(inicio, fin)').eq('user_id', auth.user.id).order('creada_en', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: 'No se pudieron consultar los pagos' }, { status: 500 })
  return NextResponse.json({ orders: data })
}
export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  const limit = await checkRateLimit('pagos:crear', auth.user.id)
  if (!limit.ok) return NextResponse.json({ error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 })
  try {
    const body = await req.json()
    if (!['creditos','profesional','profesional_plus','agencia'].includes(body.concepto)) return NextResponse.json({error:'Concepto inválido'},{status:400})
    if (!['pagomovil','binance'].includes(body.metodo)) return NextResponse.json({ error: 'Método inválido' }, { status: 400 })
    const pack = CREDIT_PACKAGES.find(p => p.creditos === body.creditos)
    const price = body.concepto === 'creditos' ? pack?.precio : PLAN_PRICES[body.concepto as keyof typeof PLAN_PRICES]
    if (!price) return NextResponse.json({ error: 'Compra inválida' }, { status: 400 })
    if (body.concepto !== 'creditos') {
      const { data: subscriptions, error: subError } = await auth.supabaseAdmin.from('suscripciones')
        .select('plan, inicio, fin, estado, trial_ends_at').eq('user_id', auth.user.id).in('estado',['activa','trial'])
        .or(`fin.is.null,fin.gt.${new Date().toISOString()}`).order('created_at',{ascending:false})
      if (subError) throw subError
      if (subscriptions?.some(s=>s.estado==='trial' && Date.parse(s.inicio)<=Date.now() && Date.parse(s.trial_ends_at)>Date.now())) {
        return NextResponse.json({error:'Tu prueba gratuita sigue activa. Puedes cambiar de plan sin pagar desde Planes.',code:'TRIAL_ACTIVE'},{status:409})
      }
      if (subscriptions?.some(s => Date.parse(s.inicio)>Date.now())) return NextResponse.json({error:'Ya tienes un cambio de plan pagado programado. Revisa tus pagos.'},{status:409})
      const current = subscriptions?.[0]
      if (current && !current.fin && getPlanRank(body.concepto) <= getPlanRank(current.plan)) return NextResponse.json({error:'Tu plan actual no tiene fecha de fin. Contacta con soporte antes de pagar.'},{status:409})
    }
    const rate = body.metodo === 'pagomovil' ? await getTasaBCV() : null
    // A stale hard-coded exchange rate must never trigger an automatic activation.
    if (rate?.fuente === 'fallback') return NextResponse.json({ error: 'No podemos obtener una tasa BCV actual. Intenta más tarde o utiliza Binance.' }, { status: 503 })
    const { data: existing, error: readError } = await auth.supabaseAdmin.from('ordenes_pago').select('id').eq('user_id', auth.user.id).in('estado', ['creada','revision','bloqueada','provisional']).limit(10)
    if (readError) throw readError
    if ((existing?.length || 0) >= 5) return NextResponse.json({ error: 'Revisa tus pagos pendientes antes de crear otra orden.' }, { status: 409 })
    const { data, error } = await auth.supabaseAdmin.from('ordenes_pago').insert({
      user_id: auth.user.id, concepto: body.concepto, creditos: body.concepto === 'creditos' ? pack!.creditos : 0,
      precio_usd: price, monto: Math.round(price * (rate?.tasa || 1) * 100) / 100,
      metodo: body.metodo, moneda: body.metodo === 'pagomovil' ? 'VES' : 'USDT',
      destinatario: recipientData()[body.metodo as 'pagomovil' | 'binance'],
    }).select().single()
    if (error) throw error
    return NextResponse.json({ order: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'No se pudo crear la orden de pago.' }, { status: 500 })
  }
}
