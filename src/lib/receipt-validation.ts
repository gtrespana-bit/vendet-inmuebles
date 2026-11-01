/** Conservative, deterministic OCR checks. Never accept client-provided OCR. */
export function normalizeReceipt(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export type ReceiptExpectation = {
  amount: number
  method: 'pagomovil' | 'binance'
  createdAt: string
  expiresAt: string
  recipient: Record<string, string>
  confidence: number
  now?: number
}

const REASON_TRANSLATIONS_EN: Record<string, string> = {
  'No se pudo leer una referencia única y completa.':
    'Could not read a single, complete payment reference.',
  'La imagen no tiene suficiente legibilidad. Sube una captura más clara.':
    'The image is not clear enough. Please upload a sharper screenshot.',
  'El comprobante no indica un pago completado.':
    'The receipt does not show a completed payment.',
  'No se pudo confirmar el estado de la operación en el comprobante.':
    'Could not confirm the transaction status on the receipt.',
  'El importe no coincide o no se pudo leer con seguridad.':
    'The amount does not match or could not be read reliably.',
  'No se pudo comprobar la moneda del pago.':
    'Could not verify the payment currency.',
  'No se pudieron verificar los datos completos del destinatario.':
    'Could not verify the full recipient details.',
  'La fecha no se pudo verificar o es anterior a la orden.':
    'The payment date could not be verified or predates the order.',
  'La hora de la operación no corresponde al período de la orden.':
    'The transaction time falls outside the order window.',
  'No se pudo verificar la hora del pago (formato de 24 horas).':
    'Could not verify the exact payment time on the receipt.',
  'La orden ha vencido; requiere revisión del pago.':
    'The order has expired and requires manual payment review.',
}

export function translateReceiptReason(reason: string, locale: string): string {
  if (locale !== 'en') return reason
  return REASON_TRANSLATIONS_EN[reason] || reason
}

/** Normalizes Venezuelan phone numbers (+58 412..., 0058412..., 412...) to 04XXXXXXXXX. */
export function normalizeVePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 14 && digits.startsWith('0058')) return `0${digits.slice(4)}`
  if (digits.length === 12 && digits.startsWith('58')) return `0${digits.slice(2)}`
  if (digits.length === 10 && digits.startsWith('4')) return `0${digits}`
  return digits
}

function extractIsoDates(normalized: string): string[] {
  const found: string[] = []
  for (const m of normalized.matchAll(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/g)) {
    found.push(`${m[3]}-${m[2]}-${m[1]}`)
  }
  for (const m of normalized.matchAll(/\b(\d{4})[/-](\d{2})[/-](\d{2})\b/g)) {
    found.push(`${m[1]}-${m[2]}-${m[3]}`)
  }
  return Array.from(new Set(found))
}

function extractNormalizedTimes(normalized: string): { times: string[]; ambiguousMeridiem: boolean } {
  const parsed: string[] = []
  // Match HH:MM(:SS)? optionally followed by am/pm / a.m. / p.m.
  const regex = /\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?(?:\s*([ap])\s*\.?\s*m\.?\b)?/g
  let hadMeridiemMatch = false

  for (const m of normalized.matchAll(regex)) {
    let hour = Number(m[1])
    const minute = m[2]
    const second = m[3] || '00'
    const meridiem = m[4] // 'a' | 'p' | undefined

    if (meridiem) {
      hadMeridiemMatch = true
      if (hour < 1 || hour > 12) return { times: [], ambiguousMeridiem: true }
      if (meridiem === 'a') {
        hour = hour === 12 ? 0 : hour
      } else {
        hour = hour === 12 ? 12 : hour + 12
      }
    } else if (hour < 0 || hour > 23) {
      return { times: [], ambiguousMeridiem: true }
    }

    parsed.push(`${String(hour).padStart(2, '0')}:${minute}:${second}`)
  }

  // If stray am/pm text exists without being attached to a valid time, fail closed.
  const strayMeridiem = !hadMeridiemMatch && /\b[ap]\.?m\.?\b/.test(normalized)
  const uniqueByMinute = Array.from(new Set(parsed.map((t) => t.slice(0, 5))))
  if (uniqueByMinute.length !== 1) {
    return { times: uniqueByMinute, ambiguousMeridiem: strayMeridiem }
  }
  return { times: [parsed[0]], ambiguousMeridiem: strayMeridiem }
}

export function assessReceipt(text: string, expected: ReceiptExpectation) {
  const normalized = normalizeReceipt(text)
  const reasons: string[] = []

  // Require explicitly labelled, full references. Never guess from a phone/date.
  const references = Array.from(
    normalized.matchAll(
      /(?:(?:nro|numero|num)\.?\s*(?:de\s*)?(?:referencia|operacion|confirmacion|recibo|comprobante)|referencia|reference|transaction\s*id|txid|order\s*id|id\s*(?:de\s*)?(?:transaccion|orden))\s*[:#-]?\s*([a-z0-9-]{6,64})/g
    )
  ).map((m) => m[1].replace(/[^a-z0-9]/g, ''))
  const distinct = Array.from(new Set(references))
  const reference = distinct.length === 1 ? distinct[0] : null
  if (!reference || !/\d/.test(reference)) {
    reasons.push('No se pudo leer una referencia única y completa.')
  }

  if (expected.confidence < 85) {
    reasons.push('La imagen no tiene suficiente legibilidad. Sube una captura más clara.')
  }
  if (
    /rechazad|fallid|pendiente|pending|failed|cancelad|reversed|reembols|no\s+(?:realizad|completad|exitos)|not\s+completed|unsuccessful/.test(
      normalized
    )
  ) {
    reasons.push('El comprobante no indica un pago completado.')
  }
  if (!/exitos|realizad|completad|successful|success|completed|aprobad|procesad|ejecutad/.test(normalized)) {
    reasons.push('No se pudo confirmar el estado de la operación en el comprobante.')
  }

  const amountMatches = Array.from(
    normalized.matchAll(
      /(?:monto|importe|amount|total)\s*(?:pagado|enviado|transferido|a pagar)?\s*[:\-]?\s*(?:bs\.?|ves|usd|usdt|\$)?\s*([\d.,]+)\s*(bs\.?|ves|usd|usdt|\$)?/g
    )
  )
  const amounts = amountMatches.map((m) => {
    const raw = m[1]
    const comma = raw.lastIndexOf(',')
    const dot = raw.lastIndexOf('.')
    const value = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
    return Number(value)
  })
  const uniqueAmounts = Array.from(new Set(amounts.filter((n) => Number.isFinite(n)).map((n) => n.toFixed(2)))).map(Number)
  if (
    !amounts.length ||
    amounts.some((n) => !Number.isFinite(n)) ||
    uniqueAmounts.some((n) => Math.abs(n - expected.amount) > 0.01)
  ) {
    reasons.push('El importe no coincide o no se pudo leer con seguridad.')
  }

  if (
    expected.method === 'pagomovil'
      ? !/\bbs\b|bolivar|\bves\b/.test(normalized)
      : !/\busdt\b|\busd\b/.test(normalized)
  ) {
    reasons.push('No se pudo comprobar la moneda del pago.')
  }

  // Only labelled recipient fields count. Sender details elsewhere cannot satisfy this check.
  const phones = Array.from(
    normalized.matchAll(
      /(?:telefono|celular|movil)\s*(?:del?\s*)?(?:receptor|destinatario|beneficiario|destino)?\s*[:#-]?\s*([+\d][\d ()-]{8,22})/g
    )
  ).map((m) => normalizeVePhone(m[1]))
  const identities = Array.from(
    normalized.matchAll(
      /(?:cedula|documento|rif|identificacion)\s*(?:del?\s*)?(?:receptor|destinatario|beneficiario|destino)?\s*[:#-]?\s*[vejg]?[ -]?(\d{6,10})/g
    )
  ).map((m) => m[1])
  const uniquePhones = Array.from(new Set(phones))
  const uniqueIdentities = Array.from(new Set(identities))
  const expectedPhone = normalizeVePhone(expected.recipient.telefono || '')
  const expectedIdentity = (expected.recipient.cedula || '').replace(/\D/g, '')

  const recipientOK =
    expected.method === 'pagomovil'
      ? uniquePhones.length === 1 &&
        uniquePhones[0] === expectedPhone &&
        uniqueIdentities.length === 1 &&
        uniqueIdentities[0] === expectedIdentity
      : new RegExp(
          `(?:pay\\s*id|binance\\s*id|destinatario|recipient|receptor)\\s*[:#-]?\\s*${expected.recipient.id}\\b`
        ).test(normalized)
  if (!recipientOK) {
    reasons.push('No se pudieron verificar los datos completos del destinatario.')
  }

  // Numeric dates (DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD); unrecognised or conflicting dates fail closed.
  const dates = extractIsoDates(normalized)
  const day = (value: string) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
  const earliest = day(expected.createdAt)
  const latest = day(new Date(expected.now ?? Date.now()).toISOString())
  if (dates.length !== 1 || dates[0] < earliest || dates[0] > latest) {
    reasons.push('La fecha no se pudo verificar o es anterior a la orden.')
  }

  const { times, ambiguousMeridiem } = extractNormalizedTimes(normalized)
  if (dates.length === 1 && times.length === 1 && !ambiguousMeridiem) {
    const paidAt = Date.parse(`${dates[0]}T${times[0]}-04:00`)
    if (
      !Number.isFinite(paidAt) ||
      paidAt < Date.parse(expected.createdAt) - 5 * 60_000 ||
      paidAt > (expected.now ?? Date.now()) + 5 * 60_000
    ) {
      reasons.push('La hora de la operación no corresponde al período de la orden.')
    }
  } else {
    reasons.push('No se pudo verificar la hora del pago (formato de 24 horas).')
  }

  if ((expected.now ?? Date.now()) > Date.parse(expected.expiresAt)) {
    reasons.push('La orden ha vencido; requiere revisión del pago.')
  }

  return { reference, reasons, eligible: reasons.length === 0 }
}
