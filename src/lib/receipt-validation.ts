/** Conservative, deterministic OCR checks. Never accept client-provided OCR. */
export function normalizeReceipt(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
export type ReceiptExpectation = {
  amount: number; method: 'pagomovil' | 'binance'; createdAt: string; expiresAt: string
  recipient: Record<string, string>; confidence: number; now?: number
}
export function assessReceipt(text: string, expected: ReceiptExpectation) {
  const normalized = normalizeReceipt(text)
  const reasons: string[] = []
  // Require explicitly labelled, full references. Never guess from a phone/date.
  const references = Array.from(normalized.matchAll(/(?:referencia|reference|transaction\s*id|order\s*id|id\s*(?:de\s*)?(?:transaccion|orden)|n(?:ro|umero)\.?\s*(?:de\s*)?(?:operacion|confirmacion))\s*[:#-]?\s*([a-z0-9-]{6,64})/g))
    .map(m => m[1].replace(/[^a-z0-9]/g, ''))
  const distinct = Array.from(new Set(references))
  const reference = distinct.length === 1 ? distinct[0] : null
  if (!reference || !/\d/.test(reference)) reasons.push('No se pudo leer una referencia única y completa.')
  if (expected.confidence < 85) reasons.push('La imagen no tiene suficiente legibilidad. Sube una captura más clara.')
  if (/rechazad|fallid|pendiente|pending|failed|cancelad|reversed|reembols|no\s+(?:realizad|completad|exitos)|not\s+completed|unsuccessful/.test(normalized)) reasons.push('El comprobante no indica un pago completado.')
  if (!/exitos|realizad|completad|successful|success|completed|aprobada|procesado/.test(normalized)) reasons.push('No se pudo confirmar el estado de la operación en el comprobante.')
  const amountMatches = Array.from(normalized.matchAll(/(?:monto|importe|amount|total)\s*(?:pagado|enviado|a pagar)?\s*[:\-]?\s*(?:bs\.?|ves|usd|usdt|\$)?\s*([\d.,]+)\s*(bs\.?|ves|usd|usdt|\$)?/g))
  const amounts = amountMatches.map(m => {
    const raw = m[1]
    const comma = raw.lastIndexOf(','); const dot = raw.lastIndexOf('.')
    const value = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
    return Number(value)
  })
  if (!amounts.length || amounts.some(n => !Number.isFinite(n) || Math.abs(n - expected.amount) > 0.01)) reasons.push('El importe no coincide o no se pudo leer con seguridad.')
  if (expected.method === 'pagomovil' ? !/\bbs\b|bolivar|\bves\b/.test(normalized) : !/\busdt\b|\busd\b/.test(normalized)) reasons.push('No se pudo comprobar la moneda del pago.')
  // Only labelled recipient fields count. Sender details elsewhere cannot satisfy this check.
  const phones = Array.from(normalized.matchAll(/(?:telefono|celular)\s*(?:del?\s*)?(?:receptor|destinatario|beneficiario)?\s*[:#-]?\s*([+\d][\d ()-]{8,20})/g)).map(m => m[1].replace(/\D/g,''))
  const identities = Array.from(normalized.matchAll(/(?:cedula|documento)\s*(?:del?\s*)?(?:receptor|destinatario|beneficiario)?\s*[:#-]?\s*[vej]?[ -]?(\d{6,10})/g)).map(m=>m[1])
  const uniquePhones = Array.from(new Set(phones))
  const uniqueIdentities = Array.from(new Set(identities))
  const recipientOK = expected.method === 'pagomovil'
    ? uniquePhones.length === 1 && uniquePhones[0] === expected.recipient.telefono.replace(/\D/g,'') && uniqueIdentities.length === 1 && uniqueIdentities[0] === expected.recipient.cedula.replace(/\D/g,'')
    : new RegExp(`(?:pay\\s*id|binance\\s*id|destinatario|recipient|receptor)\\s*[:#-]?\\s*${expected.recipient.id}\\b`).test(normalized)
  if (!recipientOK) reasons.push('No se pudieron verificar los datos completos del destinatario.')
  // Numeric dates only; unrecognised formats fail closed to manual review.
  const dates = Array.from(normalized.matchAll(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/g)).map(m => `${m[3]}-${m[2]}-${m[1]}`)
  const day = (value: string) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
  const earliest = day(expected.createdAt)
  const latest = day(new Date(expected.now ?? Date.now()).toISOString())
  if (dates.length !== 1 || dates[0] < earliest || dates[0] > latest) reasons.push('La fecha no se pudo verificar o es anterior a la orden.')
  const times = Array.from(normalized.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/g))
  if (dates.length === 1 && times.length === 1 && !/\b[ap]\.?m\.?\b/.test(normalized)) {
    const t = times[0]
    const paidAt = Date.parse(`${dates[0]}T${t[1].padStart(2,'0')}:${t[2]}:${t[3] || '00'}-04:00`)
    if (!Number.isFinite(paidAt) || paidAt < Date.parse(expected.createdAt)-5*60_000 || paidAt > (expected.now ?? Date.now())+5*60_000) reasons.push('La hora de la operación no corresponde al período de la orden.')
  } else reasons.push('No se pudo verificar la hora del pago (formato de 24 horas).')
  if ((expected.now ?? Date.now()) > Date.parse(expected.expiresAt)) reasons.push('La orden ha vencido; requiere revisión del pago.')
  return { reference, reasons, eligible: reasons.length === 0 }
}
