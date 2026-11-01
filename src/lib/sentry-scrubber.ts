/**
 * Sanitizador determinista de eventos de telemetría/errores (F28).
 * Evita que tokens, cookies, comprobantes OCR, cédulas, teléfonos o correos
 * salgan hacia proveedores externos de observabilidad.
 */

const SENSITIVE_KEY_PATTERN =
  /^(authorization|cookie|set-cookie|x-supabase-auth|password|pass|token|access_token|refresh_token|secret|api_key|apikey|comprobante|ocr|texto|cedula|cedula_numero|telefono|pago_movil_telefono|pago_movil_cedula|destinatario)$/i

export function redactSensitiveText(input: string): string {
  return input
    // Bearer / JWT tokens
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[JWT_REDACTED]')
    // Emails
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]')
    // Cédulas / RIF venezolanos explícitos (V-12345678, J-123456789)
    .replace(/\b[VEJG][-\s]?\d{6,10}\b/gi, '[ID_REDACTED]')
    // Teléfonos venezolanos (+58 412..., 0412...)
    .replace(/(?:\+?58[\s-]?)?0?4(?:12|14|16|24|26)[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE_REDACTED]')
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value
  if (typeof value === 'string') return redactSensitiveText(value)
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]'
      } else {
        out[k] = scrubValue(v, depth + 1)
      }
    }
    return out
  }
  return value
}

export function scrubSentryEvent<T extends Record<string, any>>(event: T): T {
  const clone: Record<string, any> = { ...event }

  if (typeof clone.message === 'string') {
    clone.message = redactSensitiveText(clone.message)
  }
  if (clone.user && typeof clone.user === 'object') {
    clone.user = { id: clone.user.id }
  }
  if (clone.request && typeof clone.request === 'object') {
    const req = { ...clone.request }
    if (req.headers) req.headers = scrubValue(req.headers)
    if (req.cookies) req.cookies = '[REDACTED]'
    if (req.data) req.data = scrubValue(req.data)
    if (typeof req.query_string === 'string') {
      req.query_string = req.query_string.replace(/(secret|token|code)=([^&]+)/gi, '$1=[REDACTED]')
    }
    clone.request = req
  }
  if (clone.extra) {
    clone.extra = scrubValue(clone.extra)
  }
  if (Array.isArray(clone.breadcrumbs)) {
    clone.breadcrumbs = clone.breadcrumbs.map((b: Record<string, any>) => ({
      ...b,
      message: typeof b.message === 'string' ? redactSensitiveText(b.message) : b.message,
      data: b.data ? scrubValue(b.data) : b.data,
    }))
  }
  if (clone.exception?.values && Array.isArray(clone.exception.values)) {
    clone.exception = {
      ...clone.exception,
      values: clone.exception.values.map((ex: Record<string, any>) => ({
        ...ex,
        value: typeof ex.value === 'string' ? redactSensitiveText(ex.value) : ex.value,
      })),
    }
  }

  return clone as T
}
