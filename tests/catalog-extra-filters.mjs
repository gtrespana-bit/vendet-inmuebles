import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyCatalogExtraFilters, CATALOG_AMENITIES } from '../src/lib/catalog-extra-filters.ts'

function fakeQuery() {
  return { calls: [], gte(...args) { this.calls.push(['gte', ...args]); return this }, lte(...args) { this.calls.push(['lte', ...args]); return this }, eq(...args) { this.calls.push(['eq', ...args]); return this }, contains(...args) { this.calls.push(['contains', ...args]); return this } }
}
test('applies combined numeric, condition and all amenity filters before pagination', () => {
  const q = fakeQuery()
  applyCatalogExtraFilters(q, { habitaciones: '3', banos: '2', estacionamientos: '1', areaMin: '100', areaMax: '500', condicion: 'Nuevo', amenidades: 'agua24,electricidad220,gas' })
  assert.deepEqual(q.calls, [
    ['gte', 'habitaciones', 3], ['gte', 'banos', 2], ['gte', 'puestos_estacionamiento', 1],
    ['gte', 'area_total', 100], ['lte', 'area_total', 500], ['eq', 'condicion', 'Nuevo'],
    ['contains', 'caracteristicas', ['Gas doméstico', 'Agua 24 horas', 'Electricidad 220V']],
  ])
})
test('ignores invalid and unknown filter values', () => {
  const q = fakeQuery()
  applyCatalogExtraFilters(q, { habitaciones: '-2', banos: 'abc', areaMax: 'Infinity', condicion: 'other', amenidades: 'unknown' })
  assert.deepEqual(q.calls, [])
})
test('amenity labels exist in both languages', () => {
  for (const locale of ['es', 'en']) {
    const messages = JSON.parse(readFileSync(`src/i18n/dictionaries/${locale}.json`, 'utf8'))
    for (const amenity of CATALOG_AMENITIES) assert.ok(messages.catalog.extra.amenity[amenity.key], `${locale}: ${amenity.key}`)
  }
})
