import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { assessReceipt } from '@/lib/receipt-validation'
import { readReceipt } from '@/lib/receipt-ocr'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response
  if (!isValidUUID(params.id)) return NextResponse.json({ error: 'Orden inválida' }, { status: 400 })
  const sb = auth.supabaseAdmin
  const { data: order, error } = await sb.from('ordenes_pago').select('*').eq('id', params.id).eq('user_id', auth.user.id).maybeSingle()
  if (error || !order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (['confirmada','provisional','rechazada'].includes(order.estado)) return NextResponse.json({ error: 'Esta orden ya está procesada.' }, { status: 409 })
  // Bound request before parsing. Host also enforces its request-body limit.
  if (Number(req.headers.get('content-length') || 0) > 4_400_000) return NextResponse.json({ error: 'Máximo 4 MB' }, { status: 413 })
  const { data: allowed, error: limitError } = await sb.rpc('reservar_analisis_pago', {
    p_user: auth.user.id, p_ip: req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  })
  if (limitError) return NextResponse.json({error:'No se pudo reservar el análisis. Intenta más tarde.'},{status:503})
  if (!allowed) return NextResponse.json({error:'Demasiados análisis. Intenta más tarde.'},{status:429})
  try {
    const form = await req.formData()
    const file = form.get('comprobante')
    if (!(file instanceof File) || file.size > 4 * 1024 * 1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Sube una imagen JPG, PNG o WebP de hasta 4 MB.' }, { status: 400 })
    }
    const raw = Buffer.from(await file.arrayBuffer())
    // Decode and re-encode server-side: rejects fake MIME, strips metadata, bounds pixels.
    const image = await sharp(raw, { limitInputPixels: 16_000_000, animated: false }).rotate().png().toBuffer()
    if (image.length > 4 * 1024 * 1024) return NextResponse.json({ error: 'Imagen demasiado grande. Reduce su resolución.' }, { status: 413 })
    const hash = createHash('sha256').update(image).digest('hex')
    const route = `${auth.user.id}/${order.id}/${randomUUID()}.png`
    const { error: uploadError } = await sb.storage.from('justificantes-pagos').upload(route, image, { contentType: 'image/png', upsert: false })
    if (uploadError) throw uploadError
    let text = ''; let confidence = 0
    try { ({ text, confidence } = await readReceipt(image)) } catch (e) { console.error('Receipt OCR unavailable', e instanceof Error ? e.message : 'OCR error') }
    const assessment = assessReceipt(text, { amount: Number(order.monto), method: order.metodo, createdAt: order.creada_en, expiresAt: order.vence_en, recipient: order.destinatario, confidence })
    const { data: state, error: rpcError } = await sb.rpc('registrar_intento_pago', {
      p_id: order.id, p_ruta: route, p_hash: hash, p_referencia: assessment.reference,
      p_texto: text, p_confianza: confidence, p_motivos: assessment.reasons,
    })
    if (rpcError) {
      await sb.storage.from('justificantes-pagos').remove([route])
      return NextResponse.json({ error: 'No se pudo registrar el intento. Revisa el estado de la orden e inténtalo de nuevo.' }, { status: 409 })
    }
    // A concurrent successful upload may have settled the order first. Remove unused evidence.
    const { data: recorded, error: recordedError } = await sb.from('intentos_pago').select('id').eq('orden_id',order.id).eq('ruta',route).maybeSingle()
    if (!recordedError && !recorded) await sb.storage.from('justificantes-pagos').remove([route])
    if (recorded && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(3000),
          body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID,
            text: `Justificante de pago: ${state}\nOrden: ${order.id}\n${order.concepto} — ${order.monto} ${order.moneda}\nRevisa el ingreso y confirma o rechaza en Administración → Pagos.`,
          }),
        })
      } catch { console.warn('No se pudo enviar el aviso de revisión de pago') }
    }
    return NextResponse.json({ state })
  } catch {
    return NextResponse.json({ error: 'No se pudo procesar la imagen. Prueba con otra captura.' }, { status: 400 })
  }
}
