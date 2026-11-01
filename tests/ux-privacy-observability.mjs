import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseCookieConsent } from '../src/lib/cookie-consent.ts'
import { redactSensitiveText, scrubSentryEvent } from '../src/lib/sentry-scrubber.ts'

test('F24/F25: PropertyGallery optimiza dominios permitidos y gestiona trampa/restauración de foco en el modal', () => {
  const gallery = readFileSync('src/components/PropertyGallery.tsx', 'utf8')
  assert.match(gallery, /export function isOptimizableImageSrc/)
  assert.match(gallery, /unoptimized=\{!optimizeActive\}/)
  assert.match(gallery, /unoptimized=\{!isOptimizableImageSrc\(image\)\}/)
  assert.match(gallery, /createPortal/)
  assert.match(gallery, /previousFocusRef\.current/)
  assert.match(gallery, /event\.key === 'Tab'/)
  assert.match(gallery, /\.inert = true/)
})

test('F26: CookieConsent está montado en el layout y AnalyticsGate bloquea telemetría sin opt-in explícito', () => {
  assert.equal(parseCookieConsent('accepted'), 'accepted')
  assert.equal(parseCookieConsent('rejected'), 'rejected')
  assert.equal(parseCookieConsent(null), null)
  assert.equal(parseCookieConsent('otro'), null)

  const layout = readFileSync('src/app/[locale]/layout.tsx', 'utf8')
  assert.match(layout, /<CookieConsent\s*\/>/)
  assert.match(layout, /<AnalyticsGate\s*\/>/)
  assert.doesNotMatch(layout, /<TrackPageView\s*\/>/)

  const gate = readFileSync('src/components/AnalyticsGate.tsx', 'utf8')
  assert.match(gate, /readCookieConsent\(\) === 'accepted'/)
  assert.match(gate, /if \(!allowed\) return null/)

  const footer = readFileSync('src/components/Footer.tsx', 'utf8')
  assert.match(footer, /openCookieSettings/)
})

test('F28: scrubSentryEvent elimina tokens, cookies, correos, cédulas, teléfonos y comprobantes OCR', () => {
  const raw =
    'Fallo procesando orden de usuario ana@correo.com tel +58 412-644-3099 cédula V-20794917 con Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc1234567890'
  const clean = redactSensitiveText(raw)
  assert.doesNotMatch(clean, /ana@correo\.com/)
  assert.doesNotMatch(clean, /644-3099/)
  assert.doesNotMatch(clean, /20794917/)
  assert.doesNotMatch(clean, /eyJhbGci/)

  const scrubbed = scrubSentryEvent({
    message: raw,
    user: { id: 'u-1', email: 'ana@correo.com', ip_address: '1.2.3.4' },
    request: {
      headers: { authorization: 'Bearer secret123', 'user-agent': 'Mozilla/5.0' },
      cookies: 'sb-token=xyz',
      query_string: 'secret=supersecreto&page=1',
      data: { texto: 'Referencia 123456', concepto: 'creditos' },
    },
    extra: { token: 'abc', safe: 'ok' },
  })

  assert.deepEqual(scrubbed.user, { id: 'u-1' })
  assert.equal(scrubbed.request.headers.authorization, '[REDACTED]')
  assert.equal(scrubbed.request.headers['user-agent'], 'Mozilla/5.0')
  assert.equal(scrubbed.request.cookies, '[REDACTED]')
  assert.equal(scrubbed.request.query_string, 'secret=[REDACTED]&page=1')
  assert.equal(scrubbed.request.data.texto, '[REDACTED]')
  assert.equal(scrubbed.request.data.concepto, 'creditos')
  assert.equal(scrubbed.extra.token, '[REDACTED]')
  assert.equal(scrubbed.extra.safe, 'ok')

  const health = readFileSync('src/app/api/health/route.ts', 'utf8')
  assert.match(health, /Cache-Control': 'no-store'/)
  assert.doesNotMatch(health, /SUPABASE_SERVICE_ROLE_KEY\s*\}/)
})
