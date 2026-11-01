import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_UPLOAD_BYTES, claveNormalizada, motivoRechazo, esFormatoAdmitido,
} from '../src/lib/image-upload.ts'

const grande = { bytes: MAX_UPLOAD_BYTES + 1 }

test('el límite de subida cabe en el cuerpo de una función de Vercel', () => {
  assert.equal(MAX_UPLOAD_BYTES, 4 * 1024 * 1024)
  assert.equal(motivoRechazo({ bytes: MAX_UPLOAD_BYTES, formato: 'jpeg', ancho: 1000, alto: 1000 }), null)
})

test('se rechaza por tamaño, formato y dimensiones antes de subir nada', () => {
  assert.equal(motivoRechazo({ ...grande, formato: 'jpeg', ancho: 1000, alto: 1000 }), 'La imagen supera el máximo de 4 MB')
  assert.equal(motivoRechazo({ bytes: 1000, formato: 'gif', ancho: 10, alto: 10 }), 'El archivo no es una imagen JPG, PNG o WebP válida')
  assert.equal(motivoRechazo({ bytes: 1000, formato: 'jpeg', ancho: 0, alto: 10 }), 'El archivo no es una imagen válida')
  assert.equal(motivoRechazo({ bytes: 1000, formato: 'png', ancho: 9000, alto: 10 }), 'La imagen supera el tamaño permitido')
  assert.equal(motivoRechazo({ bytes: 1000, formato: 'png', ancho: 8000, alto: 8000 }), 'La imagen tiene demasiados píxeles')
  assert.equal(motivoRechazo({ bytes: 1000, formato: 'webp', ancho: 2560, alto: 1440 }), null)
  assert.equal(motivoRechazo({ bytes: 0, formato: 'jpeg', ancho: 10, alto: 10 }), 'El archivo está vacío')
})

test('la clave guardada usa la extensión del formato real', () => {
  assert.equal(claveNormalizada('uid/listing/foto.JPEG', 'webp'), 'uid/listing/foto.webp')
  assert.equal(claveNormalizada('uid/listing/foto.png', 'jpeg'), 'uid/listing/foto.jpg')
  assert.equal(claveNormalizada('uid/foto', 'png'), 'uid/foto.png')
  assert.equal(esFormatoAdmitido('gif'), false)
})
