import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizarTelefono,
  telHref,
  whatsappHref,
  mensajeWhatsappPredeterminado,
  tieneMetodosConfigurados,
  sanitizarMetodosContacto,
  limpiarMetodosContacto,
  validarMetodosContacto,
  resolverContactoPublicacion,
} from '../src/lib/contact-methods.ts'

const perfil = {
  propietario_telefono: '+58 412 1112233',
  propietario_email: 'perfil@correo.com',
}

test('normaliza teléfonos válidos y descarta el resto', () => {
  assert.equal(normalizarTelefono('+58 412-123 45 67'), '+584121234567')
  assert.equal(normalizarTelefono('0424.123.45.67'), '04241234567')
  assert.equal(normalizarTelefono('123456'), null)
  assert.equal(normalizarTelefono('1234567890123456'), null)
  assert.equal(normalizarTelefono('   '), null)
  assert.equal(normalizarTelefono(null), null)
})

test('genera enlaces tel: y wa.me correctos', () => {
  assert.equal(telHref('+58 412 1234567'), 'tel:+584121234567')
  assert.equal(whatsappHref('+58 412 1234567', 'Hola & adiós'), 'https://wa.me/584121234567?text=Hola%20%26%20adi%C3%B3s')
  assert.match(mensajeWhatsappPredeterminado('Casa', 'https://x.test/1', false), /Casa/)
  assert.match(mensajeWhatsappPredeterminado('House', null, true), /^Hello!/)
})

test('sanitiza solo claves conocidas y distingue "sin configurar" de "solo chat"', () => {
  assert.equal(sanitizarMetodosContacto(null), null)
  assert.equal(sanitizarMetodosContacto('texto'), null)
  assert.equal(sanitizarMetodosContacto([]), null)

  assert.deepEqual(sanitizarMetodosContacto({}), {})
  assert.deepEqual(
    sanitizarMetodosContacto({
      telefono: '+58 412 1234567',
      whatsapp: 'no-es-telefono',
      email: '  VENDEDOR@Correo.com ',
      messenger: 'https://m.me/usuario',
      otra_clave: 'se descarta',
    }),
    { telefono: '+584121234567', email: 'vendedor@correo.com', messenger: 'https://m.me/usuario' },
  )
})

test('limpia y valida el formulario antes de enviarlo', () => {
  assert.deepEqual(
    limpiarMetodosContacto({ telefono: ' +58 412 1234567 ', whatsapp: '   ', email: '', messenger: 'https://m.me/x' }),
    { telefono: '+58 412 1234567', messenger: 'https://m.me/x' },
  )

  assert.equal(validarMetodosContacto({}), null)
  assert.equal(validarMetodosContacto({ telefono: '+58 412 1234567' }), null)
  assert.equal(validarMetodosContacto({ telefono: '123' }), 'telefono')
  assert.equal(validarMetodosContacto({ whatsapp: '123' }), 'whatsapp')
  assert.equal(validarMetodosContacto({ email: 'no-email' }), 'email')
  assert.equal(validarMetodosContacto({ messenger: 'm.me/usuario' }), 'messenger')
})

test('las publicaciones antiguas (null) siguen usando el contacto del perfil', () => {
  const contacto = resolverContactoPublicacion({ ...perfil, metodos_contacto: null })
  assert.deepEqual(contacto, {
    telLlamadas: '+584121112233',
    telWhatsapp: '+584121112233',
    email: 'perfil@correo.com',
    messenger: null,
  })
})

test('si el anuncio eligió métodos se muestran solo los elegidos', () => {
  const soloWhatsApp = resolverContactoPublicacion({
    ...perfil,
    metodos_contacto: { whatsapp: '+58 414 9998877' },
  })
  assert.equal(soloWhatsApp.telWhatsapp, '+584149998877')
  assert.equal(soloWhatsApp.telLlamadas, null)
  assert.equal(soloWhatsApp.email, null)

  const soloChat = resolverContactoPublicacion({ ...perfil, metodos_contacto: {} })
  assert.deepEqual(soloChat, { telLlamadas: null, telWhatsapp: null, email: null, messenger: null })

  const conEmail = resolverContactoPublicacion({
    ...perfil,
    metodos_contacto: { telefono: '+58 412 1234567', email: 'anuncio@correo.com', messenger: 'https://m.me/anuncio' },
  })
  assert.equal(conEmail.telLlamadas, '+584121234567')
  assert.equal(conEmail.email, 'anuncio@correo.com')
  assert.equal(conEmail.messenger, 'https://m.me/anuncio')

  assert.equal(tieneMetodosConfigurados({}), true)
  assert.equal(tieneMetodosConfigurados(null), false)
})

test('publicar y editar comparten el mismo formulario y el API guarda los métodos', () => {
  const publicar = readFileSync('src/app/[locale]/publicar/page.tsx', 'utf8')
  const publicarInmueble = readFileSync('src/app/[locale]/publicar-inmueble/page.tsx', 'utf8')
  const editar = readFileSync('src/app/[locale]/inmueble/editar/[id]/page.tsx', 'utf8')
  const api = readFileSync('src/app/api/properties/route.ts', 'utf8')

  for (const fuente of [publicar, publicarInmueble, editar]) {
    assert.match(fuente, /ContactMethodsFields/, 'el flujo debe usar el bloque compartido de contacto')
    assert.match(fuente, /limpiarMetodosContacto/, 'el flujo debe limpiar los métodos antes de enviarlos')
    assert.match(fuente, /validarMetodosContacto/, 'el flujo debe validar los métodos antes de enviarlos')
  }

  assert.match(publicar, /metodos_contacto: metodosElegidos/)
  assert.match(publicarInmueble, /metodos_contacto: limpiarMetodosContacto\(metodosContacto\)/)
  assert.match(editar, /metodos_contacto: limpiarMetodosContacto\(metodosContacto\)/)
  assert.match(editar, /metodos_contacto,/) // se carga la configuración actual del anuncio
  assert.match(api, /metodos_contacto: sanitizarMetodosContacto\(metodos_contacto\)/) // POST (publicar)
  assert.match(api, /if \('metodos_contacto' in body\)/) // PATCH (editar)
  assert.match(api, /cambios\.metodos_contacto = sanitizarMetodosContacto\(body\.metodos_contacto\)/)
})

test('las traducciones del formulario de contacto existen en ambos idiomas', () => {
  const claves = [
    'contactTitle', 'contactDesc', 'whatsappLabel', 'phoneCallsLabel',
    'emailLabel', 'messengerLabel', 'chatAuto',
    'invalidPhone', 'invalidEmail', 'invalidMessenger',
  ]
  for (const locale of ['es', 'en']) {
    const messages = JSON.parse(readFileSync(`src/i18n/dictionaries/${locale}.json`, 'utf8'))
    for (const clave of claves) {
      assert.equal(typeof messages.publicar[clave], 'string', `${locale}: falta publicar.${clave}`)
      assert.equal(typeof messages.publishProperty[clave], 'string', `${locale}: falta publishProperty.${clave}`)
      assert.equal(typeof messages.editListing[clave], 'string', `${locale}: falta editListing.${clave}`)
    }
    assert.equal(typeof messages.publishProperty.contactSection, 'string', `${locale}: falta publishProperty.contactSection`)
    assert.equal(typeof messages.editListing.contactLegacyHint, 'string', `${locale}: falta editListing.contactLegacyHint`)
  }
})
