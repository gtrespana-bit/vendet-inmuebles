import test from 'node:test'
import assert from 'node:assert/strict'
import { assessReceipt, normalizeVePhone, translateReceiptReason } from '../src/lib/receipt-validation.ts'
import { alertarPagosPendientesRevision } from '../src/lib/pagos-alertas.ts'

const expected = {
  amount: 487,
  method: 'pagomovil',
  createdAt: '2026-10-31T10:00:00Z',
  expiresAt: '2026-11-01T10:00:00Z',
  recipient: { telefono: '04126443099', cedula: 'V20794917' },
  confidence: 94,
  now: Date.parse('2026-10-31T15:00:00Z'),
}
const text =
  'Pago realizado exitosamente\nMonto: Bs. 487,00\nReferencia: 123456789\nFecha: 31/10/2026 10:12\nTeléfono receptor: 04126443099\nCédula: V20794917'

test('matching legible proof eligible for provisional activation', () =>
  assert.deepEqual(assessReceipt(text, expected), { reference: '123456789', reasons: [], eligible: true }))

for (const [label, change] of [
  ['wrong amount', (t) => t.replace('487,00', '1,00')],
  ['wrong recipient', (t) => t.replace('04126443099', '04120000000')],
  ['missing reference', (t) => t.replace('Referencia: 123456789', '')],
  ['ambiguous reference', (t) => t + '\nReferencia: 987654321'],
  ['pending payment', (t) => t + '\nPendiente'],
  ['old date', (t) => t.replace('31/10/2026', '30/10/2026')],
  ['old time', (t) => t.replace('10:12', '01:00')],
  ['future time', (t) => t.replace('10:12', '23:00')],
  ['ambiguous recipients', (t) => t + '\nTeléfono: 04120000000'],
  ['wrong currency', (t) => t.replace('Bs.', 'USD')],
  ['missing success', (t) => t.replace('Pago realizado exitosamente', 'Pago')],
]) {
  test(`${label} requires review`, () => assert.equal(assessReceipt(change(text), expected).eligible, false))
}

test('low confidence and OCR unavailable fail closed', () => {
  assert.equal(assessReceipt(text, { ...expected, confidence: 40 }).eligible, false)
  assert.equal(assessReceipt('', { ...expected, confidence: 0 }).eligible, false)
})

test('expired order requires review', () =>
  assert.equal(assessReceipt(text, { ...expected, now: Date.parse('2026-11-02T00:00:00Z') }).eligible, false))

test('Binance exact recipient ID and USDT accepted', () => {
  const proof =
    'Payment completed\nAmount: 9.99 USDT\nTransaction ID: 123ABC789\nBinance ID: 204147542\n31/10/2026 10:12'
  assert.equal(
    assessReceipt(proof, { ...expected, method: 'binance', amount: 9.99, recipient: { id: '204147542' } }).eligible,
    true
  )
  assert.equal(
    assessReceipt(proof.replace('204147542', '999999999'), {
      ...expected,
      method: 'binance',
      amount: 9.99,
      recipient: { id: '204147542' },
    }).eligible,
    false
  )
})

test('F14: acepta comprobantes reales con AM/PM, fecha ISO YYYY-MM-DD y teléfono +58 sin relajar controles', () => {
  assert.equal(normalizeVePhone('+58 (412) 644-3099'), '04126443099')
  assert.equal(normalizeVePhone('00584126443099'), '04126443099')
  assert.equal(normalizeVePhone('412-6443099'), '04126443099')

  // Comprobante estilo Banesco/Mercantil con hora 10:15 a.m. (14:15 UTC, dentro de [10:00Z, 15:00Z]) y +58
  const banesco =
    'Operación ejecutada exitosamente\nMonto pagado: Bs. 487,00\nNro. de referencia: 00987654321\nFecha: 31-10-2026 10:15 a.m.\nCelular destino: +58 412-644-3099\nRIF beneficiario: V-20794917'
  assert.deepEqual(assessReceipt(banesco, expected), {
    reference: '00987654321',
    reasons: [],
    eligible: true,
  })

  // Comprobante Binance con fecha ISO 2026-10-31 y hora 12:30 PM (= 16:30 UTC) cuando now = 17:00 UTC
  const binanceIso =
    'Payment successful\nTotal: 9.99 USDT\nTXID: 9988776655\nPay ID: 204147542\n2026-10-31 12:30 PM'
  assert.equal(
    assessReceipt(binanceIso, {
      ...expected,
      method: 'binance',
      amount: 9.99,
      recipient: { id: '204147542' },
      now: Date.parse('2026-10-31T17:00:00Z'),
    }).eligible,
    true
  )

  // Hora 13:15 PM es inválida -> debe fallar cerrado
  const badMeridiem = banesco.replace('10:15 a.m.', '13:15 p.m.')
  assert.equal(assessReceipt(badMeridiem, expected).eligible, false)
})

test('F14: motivos traducidos a inglés y conteo de órdenes provisionales antiguas sin exponer PII', async () => {
  const sampleReason = 'El importe no coincide o no se pudo leer con seguridad.'
  assert.equal(translateReceiptReason(sampleReason, 'es'), sampleReason)
  assert.match(translateReceiptReason(sampleReason, 'en'), /amount does not match/i)

  const fakeSb = {
    from() {
      let mode = ''
      const chain = {
        select() { return chain },
        eq(_c, val) { mode = val; return chain },
        in() { mode = 'revision'; return chain },
        lte() {
          return Promise.resolve({ count: mode === 'provisional' ? 2 : 1, error: null })
        },
      }
      return chain
    },
  }
  const prevBot = process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_BOT_TOKEN
  const res = await alertarPagosPendientesRevision(fakeSb)
  if (prevBot) process.env.TELEGRAM_BOT_TOKEN = prevBot
  assert.deepEqual(res, { provisionalesAntiguos: 2, revisionAntiguos: 1, alertaEnviada: false })
})
