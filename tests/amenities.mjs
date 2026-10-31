import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AMENITIES,
  AMENITY_GROUPS,
  FORM_AMENITY_GROUPS,
  claveAmenidad,
  leerAmenidades,
  nombreCanonicoAmenidad,
  ordenAmenidad,
} from '../src/lib/amenities.ts'
import { CATALOG_AMENITIES, applyCatalogExtraFilters } from '../src/lib/catalog-extra-filters.ts'
import { MAX_CARACTERISTICAS } from '../src/lib/property-features.ts'

test('el catálogo de ambientes y servicios es único y completo', () => {
  const keys = AMENITIES.map((item) => item.key)
  const names = AMENITIES.map((item) => item.name)
  assert.equal(new Set(keys).size, keys.length, 'claves duplicadas')
  assert.equal(new Set(names).size, names.length, 'nombres duplicados')
  assert.ok(AMENITIES.length >= 40, 'el catálogo debe ofrecer bastantes opciones')

  // Opciones pedidas explícitamente por el negocio.
  for (const name of ['Cámaras de seguridad', 'Conjunto privado', 'Urbanización cerrada', 'Portón eléctrico']) {
    assert.ok(names.includes(name), `falta la opción ${name}`)
  }

  // El límite del API debe permitir marcar todo el catálogo.
  assert.ok(MAX_CARACTERISTICAS >= AMENITIES.length, 'MAX_CARACTERISTICAS no cubre el catálogo')
})

test('los formularios agrupan las opciones y dejan fuera los controles propios', () => {
  assert.deepEqual(FORM_AMENITY_GROUPS.map((group) => group.key), [...AMENITY_GROUPS])
  const formNames = FORM_AMENITY_GROUPS.flatMap((group) => group.options.map((option) => option.name))
  for (const tecnica of ['Electricidad 110V', 'Electricidad 220V', 'Agua 24 horas', 'Amueblado', 'Amueblado parcialmente']) {
    assert.ok(!formNames.includes(tecnica), `${tecnica} debe editarse con su propio control`)
  }
  assert.ok(formNames.includes('Cámaras de seguridad'))
  assert.ok(formNames.includes('Conjunto privado'))
})

test('normaliza y busca amenidades sin depender de mayúsculas ni tildes', () => {
  assert.equal(claveAmenidad('cámaras de seguridad'), 'camaras')
  assert.equal(claveAmenidad('  Camaras de Seguridad '), 'camaras')
  assert.equal(claveAmenidad('AMUEBLADO PARCIALMENTE'), 'amuebladoParcial')
  assert.equal(claveAmenidad('Característica inventada'), null)
  assert.equal(nombreCanonicoAmenidad('gAS DOMESTICO'), 'Gas doméstico')
  assert.equal(nombreCanonicoAmenidad('Característica inventada '), 'Característica inventada')
  assert.ok(ordenAmenidad('Sala') < ordenAmenidad('Piscina'))
  assert.equal(ordenAmenidad('Característica inventada'), Number.MAX_SAFE_INTEGER)
})

test('la ficha lee TODAS las características guardadas, sin recortar', () => {
  // Payload real de un anuncio que se mostraba incompleto en producción.
  const guardadas = [
    'Agua 24 horas', 'Aire acondicionado', 'Amueblado', 'Balcón o terraza',
    'Electricidad 110V', 'Electricidad 220V', 'Gas doméstico',
    'Generador eléctrico', 'Jardín', 'Ventiladores',
  ]
  assert.deepEqual(leerAmenidades(guardadas), guardadas)
  assert.equal(leerAmenidades([...guardadas, ...guardadas]).length, guardadas.length, 'debe deduplicar')
  assert.deepEqual(leerAmenidades(guardadas.join(', ')), guardadas)
  assert.deepEqual(leerAmenidades(guardadas.map((nombre) => ({ nombre }))), guardadas)

  // Nombres fuera de catálogo se conservan tal cual (no se descartan).
  assert.deepEqual(leerAmenidades(['Cámaras de seguridad', 'Terraza con vista']).at(-1), 'Terraza con vista')
  assert.deepEqual(leerAmenidades(null), [])
  assert.deepEqual(leerAmenidades(['  ', 'Sala']), ['Sala'])
  // 43 opciones del catálogo pasan íntegras.
  const todas = AMENITIES.map((item) => item.name)
  assert.deepEqual(leerAmenidades(todas), todas)
})

test('los filtros del catálogo usan el mismo catálogo compartido', () => {
  assert.equal(CATALOG_AMENITIES.length, AMENITIES.length)
  const calls = []
  const query = {
    gte() { return query }, lte() { return query }, eq() { return query },
    contains(column, values) { calls.push([column, values]); return query },
  }
  applyCatalogExtraFilters(query, { amenidades: 'gas,camaras,conjuntoPrivado,noExiste' })
  assert.deepEqual(calls, [['caracteristicas', ['Gas doméstico', 'Cámaras de seguridad', 'Conjunto privado']]])
})

test('las etiquetas ES/EN de cada amenidad y grupo existen', () => {
  for (const locale of ['es', 'en']) {
    const extra = JSON.parse(readFileSync(`src/i18n/dictionaries/${locale}.json`, 'utf8')).catalog.extra
    for (const amenity of AMENITIES) {
      assert.equal(typeof extra.amenity[amenity.key], 'string', `${locale}: falta amenity.${amenity.key}`)
    }
    for (const group of AMENITY_GROUPS) {
      assert.equal(typeof extra.amenityGroup[group], 'string', `${locale}: falta amenityGroup.${group}`)
    }
  }
})

test('publicar, editar y la ficha usan el catálogo compartido sin recortar la lista', () => {
  const publicar = readFileSync('src/app/[locale]/publicar-inmueble/page.tsx', 'utf8')
  const editar = readFileSync('src/app/[locale]/inmueble/editar/[id]/page.tsx', 'utf8')
  const detalle = readFileSync('src/app/[locale]/inmueble/[id]/page.tsx', 'utf8')

  assert.match(publicar, /FORM_AMENITY_GROUPS/)
  assert.match(editar, /FORM_AMENITY_GROUPS/)
  assert.match(detalle, /leerAmenidades\(property\.caracteristicas\)/)
  assert.match(detalle, /features\.map/)
  assert.doesNotMatch(detalle, /features\.slice\(/, 'la ficha no debe recortar las amenidades')
  assert.doesNotMatch(detalle, /features\.filter\([^)]*index/, 'la ficha no debe filtrar por posición')
})

test('los datos del servidor se leen sin caché para que la ficha se actualice al editar', () => {
  const supabase = readFileSync('src/lib/supabase-server.ts', 'utf8')
  const detalle = readFileSync('src/app/[locale]/inmueble/[id]/page.tsx', 'utf8')
  const api = readFileSync('src/app/api/properties/route.ts', 'utf8')

  assert.match(supabase, /cache:\s*'no-store'/)
  assert.match(detalle, /export const dynamic = 'force-dynamic'/)
  assert.match(detalle, /export const fetchCache = 'force-no-store'/)
  assert.match(api, /revalidatePath\(`\/inmueble\/\$\{id\}`\)/)
})
