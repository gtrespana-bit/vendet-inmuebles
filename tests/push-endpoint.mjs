import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { esEndpointPushPermitido } from '../src/lib/push-endpoint.ts'

test('se aceptan los servicios push reales de los navegadores', () => {
  for (const url of [
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/xyz',
    'https://web.push.apple.com/QGVsbG8',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) assert.equal(esEndpointPushPermitido(url), true, url)
})

test('no se aceptan destinos internos ni terceros arbitrarios', () => {
  for (const url of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://127.0.0.1/push',
    'https://10.0.0.5:8443/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/push',
    'https://evil.example.com/push',
    'https://fcm.googleapis.com.evil.com/push',
    'https://user:pass@fcm.googleapis.com/push',
    'https://fcm.googleapis.com:8443/push',
    '',
    null,
    undefined,
  ]) assert.equal(esEndpointPushPermitido(url), false, String(url))
})

test('la suscripción y el envío usan la misma validación', () => {
  
  assert.match(readFileSync('src/app/api/push-subscribe/route.ts', 'utf8'), /esEndpointPushPermitido/)
  assert.match(readFileSync('src/lib/push.ts', 'utf8'), /esEndpointPushPermitido/)
})
