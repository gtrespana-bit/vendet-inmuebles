import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  formatearPrecioPropiedad,
  limpiarPreviewMensaje,
  puedeEnviarAviso,
  resumenMensajesNoLeidos,
} from '../src/lib/email-resumen.ts'

test('formatea precios por moneda y descarta valores inválidos', () => {
  assert.equal(formatearPrecioPropiedad(150000, 'USD'), '$ 150.000')
  assert.equal(formatearPrecioPropiedad(1500, 'VES'), 'Bs. 1.500')
  assert.equal(formatearPrecioPropiedad('2500.4', 'EUR'), '€ 2.500')
  assert.equal(formatearPrecioPropiedad(0, 'USD'), null)
  assert.equal(formatearPrecioPropiedad('abc', 'USD'), null)
})

test('limpia y recorta la vista previa del mensaje', () => {
  assert.equal(limpiarPreviewMensaje('  Hola\n\n  ¿sigue disponible?  '), 'Hola ¿sigue disponible?')
  assert.equal(limpiarPreviewMensaje(''), '')
  const largo = 'a'.repeat(300)
  const recortado = limpiarPreviewMensaje(largo, 180)
  assert.equal(recortado.length, 180)
  assert.ok(recortado.endsWith('…'))
})

test('resume la cantidad de mensajes sin leer', () => {
  assert.equal(resumenMensajesNoLeidos(1), '1 mensaje sin leer')
  assert.equal(resumenMensajesNoLeidos(4), '4 mensajes sin leer')
  assert.equal(resumenMensajesNoLeidos(0), '1 mensaje sin leer')
})

test('respeta el límite de frecuencia entre avisos de chat', () => {
  const ahora = new Date('2026-01-01T12:00:00Z')
  assert.equal(puedeEnviarAviso(null, ahora), true)
  assert.equal(puedeEnviarAviso('2026-01-01T11:45:00Z', ahora), false)
  assert.equal(puedeEnviarAviso('2026-01-01T11:30:00Z', ahora), true)
  assert.equal(puedeEnviarAviso('fecha inválida', ahora), true)
})

test('la migración programa el aviso, lo cancela al leer y permite configurar el plazo', () => {
  const sql = readFileSync('supabase/migrations/006_notificaciones_email.sql', 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notificaciones_email/)
  assert.match(sql, /CREATE TRIGGER mensajes_encolar_email/)
  assert.match(sql, /CREATE TRIGGER mensajes_cancelar_email/)
  assert.match(sql, /app\.chat_email_delay_minutes/)
  assert.match(sql, /email_notificado_en/)
})

test('el cron procesa la cola y las plantillas de eventos importantes existen', () => {
  const cron = readFileSync('src/app/api/cron/notificaciones-email/route.ts', 'utf8')
  assert.match(cron, /CRON_SECRET/)
  assert.match(cron, /procesarNotificacionesEmailPendientes/)

  const plantillas = readFileSync('src/lib/server-email.ts', 'utf8')
  for (const fn of [
    'emailMensajesNoLeidos',
    'emailProductoPublicado',
    'emailPropiedadEnRevision',
    'emailPropiedadAprobada',
    'emailPropiedadRechazada',
    'emailVerificacionRevocada',
    'emailResenaRecibida',
    'emailPropiedadDestacada',
    'emailCreditosRechazados',
  ]) {
    assert.match(plantillas, new RegExp(`export async function ${fn}\\(`), fn)
  }
})

test('los eventos importantes disparan correos desde sus rutas', () => {
  const rutas = [
    ['src/app/api/publicar/route.ts', 'emailProductoPublicado'],
    ['src/app/api/admin/moderar-producto/route.ts', 'notificarPropiedadModerada'],
    ['src/app/api/admin/verificar/route.ts', 'notificarVerificacion'],
    ['src/app/api/admin/toggle-verificado/route.ts', 'notificarVerificacion'],
    ['src/app/api/admin/add-creditos/route.ts', 'notificarCreditosAgregados'],
    ['src/app/api/admin/enviar-resena/route.ts', 'notificarResena'],
    ['src/app/api/admin/toggle-destacado/route.ts', 'notificarPropiedadDestacada'],
    ['src/app/api/admin/boost-producto/route.ts', 'notificarPropiedadBoost'],
    ['src/app/api/admin/marcar-vendido/route.ts', 'notificarPropiedadVendida'],
    ['src/app/api/telegram/webhook/route.ts', 'notificarCreditosAgregados'],
  ]
  for (const [ruta, funcion] of rutas) {
    assert.match(readFileSync(ruta, 'utf8'), new RegExp(funcion), ruta)
  }
})
