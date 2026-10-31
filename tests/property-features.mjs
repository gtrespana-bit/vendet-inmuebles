import { test } from 'node:test'
import assert from 'node:assert/strict'
import { savePropertyFeatures } from '../src/lib/property-features.ts'

function database({ failCatalog = false, failInsert = false } = {}) {
  const catalog = [{ id: 1, nombre: 'Aire acondicionado', slug: 'aire-acondicionado' }]
  const links = [{ inmueble_id: 'p1', caracteristica_id: 1 }]
  const db = { catalog, links, from(table) {
    let action = 'select', payload, filters = []
    const query = {
      select() { return query }, order() { return query }, range() { return query },
      eq(field, value) { filters.push([field, value]); return query },
      in(field, values) { filters.push([field, values]); return query },
      insert(value) { action = 'insert'; payload = value; return query },
      delete() { action = 'delete'; return query },
      single() { return Promise.resolve(execute()) },
      maybeSingle() { const result = execute(); return Promise.resolve({ ...result, data: result.data?.[0] || null }) },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) },
    }
    function execute() {
      if (table === 'caracteristicas') {
        if (action === 'select') {
          if (failCatalog) return { data: null, error: new Error('catalog error') }
          return { data: catalog.filter((row) => filters.every(([key, value]) => row[key] === value)), error: null }
        }
        assert.ok(payload.slug, 'catalog entries require a slug')
        const entry = { ...payload, id: catalog.length + 1 }
        catalog.push(entry)
        return { data: entry, error: null }
      }
      if (action === 'select') return { data: links.filter((r) => r.inmueble_id === filters[0][1]), error: null }
      if (action === 'insert') {
        if (failInsert) return { error: new Error('insert error') }
        links.push(...payload)
      } else {
        const ids = filters.find(([key]) => key === 'caracteristica_id')[1]
        for (let i = links.length - 1; i >= 0; i--) if (links[i].inmueble_id === filters[0][1] && ids.includes(links[i].caracteristica_id)) links.splice(i, 1)
      }
      return { error: null }
    }
    return query
  } }
  return db
}

test('saves and reloads existing and new amenities without duplicates', async () => {
  const db = database()
  const selected = ['Aire acondicionado', 'Electricidad 110V', 'Electricidad 220V', 'Agua 24 horas', 'Gas doméstico', 'Generador eléctrico', 'generador eléctrico']
  await savePropertyFeatures(db, 'p1', selected)
  assert.equal(db.links.length, 6)
  assert.deepEqual(db.links.map((l) => db.catalog.find((c) => c.id === l.caracteristica_id).nombre), [
    'Aire acondicionado', 'Electricidad 110V', 'Electricidad 220V', 'Agua 24 horas', 'Gas doméstico', 'Generador eléctrico',
  ])
  await savePropertyFeatures(db, 'p1', ['Agua 24 horas'])
  assert.deepEqual(db.links.map((l) => db.catalog.find((c) => c.id === l.caracteristica_id).nombre), ['Agua 24 horas'])
})

test('keeps existing selections if catalog or insertion fails', async () => {
  for (const failure of [{ failCatalog: true }, { failInsert: true }]) {
    const db = database(failure)
    await assert.rejects(savePropertyFeatures(db, 'p1', ['Agua 24 horas']))
    assert.deepEqual(db.links, [{ inmueble_id: 'p1', caracteristica_id: 1 }])
  }
})
