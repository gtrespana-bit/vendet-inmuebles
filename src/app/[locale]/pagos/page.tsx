'use client'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { CREDIT_PACKAGES, PLAN_PRICES } from '@/lib/payment-catalog'
import { getPlanDisplayName } from '@/lib/plan-catalog'
import { translateReceiptReason } from '@/lib/receipt-validation'
import { trialDaysRemaining } from '@/lib/trial-status'
import { useAuth } from '@/components/AuthProvider'

type Order = {
  id: string; concepto: string; creditos: number; monto: number; moneda: string; estado: string
  motivos: string[]; destinatario: Record<string,string>; vence_en: string; nota_revision: string | null; suscripciones: { inicio: string; fin: string } | null
}
export default function PaymentsPage() {
  const en = useLocale() === 'en'
  const copy = (es: string, english: string) => en ? english : es
  const params = useSearchParams()
  const { user, loading } = useAuth()
  const [product, setProduct] = useState(() => {
    const plan = params.get('plan')
    return plan && plan in PLAN_PRICES ? plan : `creditos:${params.get('creditos') || 15}`
  })
  const [planStatus, setPlanStatus] = useState<{estado:string|null;trialEndsAt:string|null}|null>(null)
  const trialDays = trialDaysRemaining(planStatus?.estado, planStatus?.trialEndsAt)
  const [method, setMethod] = useState('pagomovil')
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<Record<string, File | undefined>>({})
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pagos', { headers: await getSupabaseAuthHeaders(), cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrders(data.orders)
      const planRes = await fetch('/api/user/plan', {headers:await getSupabaseAuthHeaders(),cache:'no-store'})
      if (!planRes.ok) { setPlanStatus(null); throw new Error('No se pudo consultar el estado de tu plan. Actualiza antes de pagar un plan.') }
      setPlanStatus(await planRes.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }, [])
  useEffect(() => { if (user) void load() }, [user, load])
  async function createOrder() {
    if (!product.startsWith('creditos:') && (!planStatus || trialDays)) {
      setError(copy('Comprueba tu prueba gratuita en Planes antes de pagar.', 'Check your free trial on Plans before paying.')); return
    }
    setBusy('create'); setError(''); setMessage('')
    try {
      const [concepto, credits] = product.split(':')
      const res = await fetch('/api/pagos', { method: 'POST', headers: { ...await getSupabaseAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ concepto, creditos: Number(credits), metodo: method }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
      setMessage(copy('Orden creada. Paga el importe exacto y adjunta el justificante en la orden.', 'Order created. Pay the exact amount and upload your receipt below.'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') } finally { setBusy('') }
  }
  async function upload(order: Order) {
    const file = files[order.id]
    if (!file) return
    setBusy(order.id); setError(''); setMessage('')
    try {
      const form = new FormData(); form.set('comprobante', file)
      const res = await fetch(`/api/pagos/${order.id}/comprobante`, { method: 'POST', headers: await getSupabaseAuthHeaders(), body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFiles(prev => ({ ...prev, [order.id]: undefined }))
      await load()
      setMessage(data.state === 'provisional'
        ? copy('Pago validado provisionalmente. Los créditos o el plan se han activado o programado según corresponda. Pendientes de confirmación final del ingreso.', 'Payment provisionally validated. Benefits have been activated or scheduled, pending final payment confirmation.')
        : copy('Justificante registrado. Revisa los motivos: puedes subir una imagen mejor en esta misma orden.', 'Receipt recorded. Check the reasons below; you can upload a better image to this order.'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') } finally { setBusy('') }
  }
  const labels: Record<string,string> = {
    creada: copy('Pendiente de justificante','Awaiting receipt'), revision: copy('Pendiente de revisión','Awaiting review'),
    bloqueada: copy('Sin activación · requiere revisión','Not activated · review required'),
    provisional: copy('Activación provisional','Provisionally activated'), confirmada: copy('Pago confirmado','Payment confirmed'), rechazada: copy('Pago rechazado','Payment rejected'),
  }
  const queryStr = params.toString()
  const returnTo = queryStr ? `/pagos?${queryStr}` : '/pagos'
  const loginHref = `/login?redirect=${encodeURIComponent(returnTo)}`
  if (loading) return <div className="max-w-3xl mx-auto p-6" role="status">{copy('Cargando…','Loading…')}</div>
  if (!user) return <div className="max-w-3xl mx-auto p-6"><LocalLink href={loginHref}>{copy('Inicia sesión para gestionar tus pagos','Sign in to manage payments')}</LocalLink></div>
  return <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
    <h1 className="text-3xl font-bold">{copy('Pagos y justificantes','Payments and receipts')}</h1>
    <p>{copy('Paga por Pago Móvil o Binance. Analizamos la imagen con OCR gratuito: no confirma el ingreso bancario. Las activaciones automáticas son provisionales y pueden revocarse si el pago no existe.', 'Pay with Pago Móvil or Binance. Free OCR checks the image, not the bank deposit. Automatic activations are provisional and may be revoked if payment is invalid.')}</p>
    {planStatus && !trialDays && <p className="text-sm text-gray-600">{copy('Los planes se pagan por 30 días, sin cobros automáticos. Una subida comienza al activarse; las renovaciones y los planes inferiores comienzan al finalizar el período actual. El importe indicado es el precio completo del nuevo período, sin prorrateo.', 'Plans are prepaid for 30 days, without automatic charges. Upgrades start on activation; renewals and lower plans start at the end of the current period. The amount is the full price for the new period, without proration.')}</p>}
    {!planStatus && <p role="status">{copy('Comprobando tu plan y el estado de la prueba gratuita…', 'Checking your plan and free trial status…')}</p>}
    {trialDays > 0 && <section className="bg-blue-50 text-blue-900 rounded-xl p-5 space-y-3" role="status">
      <h2 className="font-bold">{copy(`Te quedan ${trialDays} días de prueba gratuita`, `${trialDays} free trial days remaining`)}</h2>
      <p>{copy('No tienes que pagar para cambiar de plan durante tu prueba. Los paquetes de créditos son compras adicionales y sí tienen coste.', 'You do not need to pay to change plans during your trial. Credit packages are separate paid purchases.')}</p>
      <LocalLink className="block underline font-semibold" href="/planes">{copy('Elegir otro plan sin pagar', 'Choose another plan for free')}</LocalLink>
      {!product.startsWith('creditos:') && <button className="underline" onClick={()=>setProduct('creditos:15')}>{copy('Quiero comprar créditos adicionales', 'I want to buy extra credits')}</button>}
    </section>}
    {!(trialDays > 0 && !product.startsWith('creditos:')) && <section className="bg-white border rounded-xl p-5 space-y-4" aria-label={copy('Nueva compra','New purchase')}>
      <label className="block">{copy('Qué quieres comprar','Purchase')}
        <select className="block w-full border rounded p-3 mt-1" value={product} onChange={e => setProduct(e.target.value)}>
          {CREDIT_PACKAGES.map(p => <option key={p.creditos} value={`creditos:${p.creditos}`}>{p.creditos} {copy('créditos','credits')} — ${p.precio}</option>)}
          {!trialDays && Object.entries(PLAN_PRICES).map(([name, price]) => <option key={name} value={name}>{getPlanDisplayName(name, en ? 'en' : 'es')} — ${price} / 30 {copy('días','days')}</option>)}
        </select>
      </label>
      <label className="block">{copy('Método de pago','Payment method')}
        <select className="block w-full border rounded p-3 mt-1" value={method} onChange={e => setMethod(e.target.value)}><option value="pagomovil">Pago Móvil</option><option value="binance">Binance Pay (USDT)</option></select>
      </label>
      <button disabled={!!busy || (!product.startsWith('creditos:') && !planStatus)} onClick={createOrder} className="rounded-lg bg-brand-primary text-white px-5 py-3 disabled:opacity-50">{busy === 'create' ? copy('Creando…','Creating…') : copy('Crear orden y ver datos de pago','Create order and view payment details')}</button>
    </section>}
    {error && <p role="alert" className="bg-red-50 text-red-800 p-4 rounded">{error}</p>}
    {message && <p role="status" className="bg-blue-50 text-blue-900 p-4 rounded">{message}</p>}
    <div className="flex justify-between items-center"><h2 className="text-xl font-bold">{copy('Mis pagos','My payments')}</h2><button onClick={load} disabled={!!busy} className="underline">{copy('Actualizar','Refresh')}</button></div>
    {orders.length === 0 && <p>{copy('Todavía no tienes órdenes de pago.','No payment orders yet.')}</p>}
    {orders.map(order => <article key={order.id} className="border bg-white rounded-xl p-5 space-y-3">
      <h3 className="font-bold">{order.concepto === 'creditos' ? `${order.creditos} ${copy('créditos','credits')}` : getPlanDisplayName(order.concepto, en ? 'en' : 'es')} · {Number(order.monto).toFixed(2)} {order.moneda}</h3>
      <p className="font-semibold">{labels[order.estado]}</p>
      {order.suscripciones && <p className="text-sm">{copy('Período del plan','Plan period')}: {new Date(order.suscripciones.inicio).toLocaleDateString(en ? 'en':'es')} → {new Date(order.suscripciones.fin).toLocaleDateString(en ? 'en':'es')}</p>}<p className="text-xs text-gray-500">{order.id}</p>
      <dl className="text-sm space-y-1">{Object.entries(order.destinatario).map(([key,value]) => <div key={key} className="flex flex-wrap gap-2"><dt className="capitalize">{key}:</dt><dd className="font-mono select-all">{value}</dd></div>)}</dl>
      {['creada','revision','bloqueada'].includes(order.estado) && <p className="text-sm">{copy('Pagar antes de','Pay before')}: {new Date(order.vence_en).toLocaleString(en ? 'en' : 'es')}</p>}
      {!!order.motivos.length && <ul className="list-disc pl-5 text-amber-900">{order.motivos.map((reason,i) => <li key={i}>{translateReceiptReason(reason, en ? 'en' : 'es')}</li>)}</ul>}
      {order.nota_revision && <p>{order.nota_revision}</p>}
      {order.estado === 'bloqueada' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-1">
          <p className="font-semibold">
            {copy('¿Alcanzaste el límite de intentos automáticos o tu captura fue rechazada por formato?', 'Reached the automatic check limit or had a valid receipt flagged?')}
          </p>
          <p>
            {copy(
              'No realices un segundo pago. Nuestro equipo revisará esta orden manualmente en Administración → Pagos, o puedes escribirnos indicando el código de orden para adjuntar soporte adicional:',
              'Do not pay twice. Our team reviews blocked orders manually, or you can contact support quoting your order ID if you need to attach additional proof:'
            )}{' '}
            <LocalLink href={`/contacto?orden=${encodeURIComponent(order.id)}`} className="underline font-semibold">
              {copy('Contactar soporte con este número de orden', 'Contact support with this order ID')}
            </LocalLink>
          </p>
        </div>
      )}
      {['creada','revision','bloqueada'].includes(order.estado) && <div className="space-y-3">
        <label className="block font-medium">{copy('Subir o resubir justificante','Upload or replace receipt')}
          <input className="block mt-2 w-full" type="file" accept="image/png,image/jpeg,image/webp" disabled={!!busy} onChange={e => {
            const file = e.target.files?.[0]
            if (file && file.size > 4*1024*1024) { setError(copy('Máximo 4 MB','Maximum 4 MB')); e.target.value=''; return }
            setFiles(prev => ({ ...prev, [order.id]: file }))
          }} />
        </label>
        <p className="text-xs text-gray-600">{copy('JPG, PNG o WebP · hasta 4 MB. Incluye importe, moneda, referencia completa, fecha, destinatario y estado del pago. No recortes estos datos.', 'JPG, PNG or WebP · up to 4 MB. Include amount, currency, full reference, date, recipient and payment status. Do not crop these details.')}</p>
        <button disabled={!!busy || !files[order.id]} onClick={() => upload(order)} className="rounded-lg bg-brand-primary text-white px-5 py-3 disabled:opacity-50">{busy === order.id ? copy('Analizando comprobante…','Checking receipt…') : copy('Enviar y verificar justificante','Submit and check receipt')}</button>
      </div>}
    </article>)}
  </div>
}
