import test from 'node:test'
import assert from 'node:assert/strict'
import { assessReceipt } from '../src/lib/receipt-validation.ts'
const expected = { amount: 487, method:'pagomovil', createdAt:'2026-10-31T10:00:00Z', expiresAt:'2026-11-01T10:00:00Z', recipient:{telefono:'04126443099',cedula:'V20794917'}, confidence:94, now:Date.parse('2026-10-31T15:00:00Z') }
const text = 'Pago realizado exitosamente\nMonto: Bs. 487,00\nReferencia: 123456789\nFecha: 31/10/2026 10:12\nTeléfono receptor: 04126443099\nCédula: V20794917'
test('matching legible proof eligible for provisional activation',()=>assert.deepEqual(assessReceipt(text,expected),{reference:'123456789',reasons:[],eligible:true}))
for (const [label,change] of [
  ['wrong amount',t=>t.replace('487,00','1,00')],
  ['wrong recipient',t=>t.replace('04126443099','04120000000')],
  ['missing reference',t=>t.replace('Referencia: 123456789','')],
  ['ambiguous reference',t=>t+'\nReferencia: 987654321'],
  ['pending payment',t=>t+'\nPendiente'],
  ['old date',t=>t.replace('31/10/2026','30/10/2026')],
  ['old time',t=>t.replace('10:12','01:00')],
  ['future time',t=>t.replace('10:12','23:00')],
  ['ambiguous recipients',t=>t+'\nTeléfono: 04120000000'],
  ['wrong currency',t=>t.replace('Bs.','USD')],
  ['missing success',t=>t.replace('Pago realizado exitosamente','Pago')],
]) test(`${label} requires review`,()=>assert.equal(assessReceipt(change(text),expected).eligible,false))
test('low confidence and OCR unavailable fail closed',()=>{
  assert.equal(assessReceipt(text,{...expected,confidence:40}).eligible,false)
  assert.equal(assessReceipt('',{...expected,confidence:0}).eligible,false)
})
test('expired order requires review',()=>assert.equal(assessReceipt(text,{...expected,now:Date.parse('2026-11-02T00:00:00Z')}).eligible,false))
test('Binance exact recipient ID and USDT accepted',()=>{
  const proof='Payment completed\nAmount: 9.99 USDT\nTransaction ID: 123ABC789\nBinance ID: 204147542\n31/10/2026 10:12'
  assert.equal(assessReceipt(proof,{...expected,method:'binance',amount:9.99,recipient:{id:'204147542'}}).eligible,true)
  assert.equal(assessReceipt(proof.replace('204147542','999999999'),{...expected,method:'binance',amount:9.99,recipient:{id:'204147542'}}).eligible,false)
})
