import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fuente = readFileSync('src/components/CatalogFilters.tsx', 'utf8')

test('los filtros de precio y área no tienen botón de aplicar dentro de la sección', () => {
  for (const fieldset of fuente.split('<fieldset className="catalog-filter-panel__price">').slice(1)) {
    const contenido = fieldset.split('</fieldset>')[0]
    assert.doesNotMatch(contenido, /applyFilters|applyPendingFilters|Aplicar/i)
  }
})

test('la acción de aplicar aparece una sola vez y al final del panel', () => {
  assert.equal((fuente.match(/catalog\.applyChanges/g) || []).length, 1)
  assert.equal((fuente.match(/applyPendingFilters/g) || []).length, 2) // definición + uso

  const posicionAcciones = fuente.indexOf('catalog-filter-panel__actions')
  const posicionFiltrosAvanzados = fuente.indexOf('catalog-filter-panel__more')
  assert.ok(posicionAcciones > posicionFiltrosAvanzados)
  assert.ok(fuente.indexOf('</section>') > posicionAcciones)
})

test('la acción aplica precio y área en una sola navegación', () => {
  assert.match(fuente, /setNumericParam\(params, 'precioMin'/)
  assert.match(fuente, /setNumericParam\(params, 'precioMax'/)
  assert.match(fuente, /setNumericParam\(params, 'areaMin'/)
  assert.match(fuente, /setNumericParam\(params, 'areaMax'/)
  assert.equal((fuente.match(/router\.push\(/g) || []).length, 3)
})

test('las traducciones y los estilos acompañan la acción final', () => {
  for (const locale of ['es', 'en']) {
    const messages = JSON.parse(readFileSync(`src/i18n/dictionaries/${locale}.json`, 'utf8'))
    assert.equal(typeof messages.catalog.applyChanges, 'string')
    assert.equal(typeof messages.catalog.pendingChanges, 'string')
  }

  const css = readFileSync('src/app/globals.css', 'utf8')
  assert.match(css, /\.catalog-filter-panel__actions\s*\{/)
  assert.match(css, /\.catalog-filter-panel__apply\s*\{/)
  assert.match(css, /\.catalog-filter-panel__reset\s*\{/)
})
