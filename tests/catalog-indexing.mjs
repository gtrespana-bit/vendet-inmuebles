import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { catalogRobots, hasActiveCatalogParams } from '../src/lib/catalog-seo.ts'

test('Solo la vista canónica del catálogo se indexa; cualquier parámetro implica noindex, follow', () => {
  // Vista canónica: sin parámetros, o con parámetros vacíos.
  assert.equal(hasActiveCatalogParams(undefined), false)
  assert.equal(hasActiveCatalogParams({}), false)
  assert.equal(hasActiveCatalogParams({ pagina: undefined }), false)
  assert.equal(hasActiveCatalogParams({ categoria: '' }), false)
  assert.equal(hasActiveCatalogParams({ amenidades: [] }), false)

  const canonical = catalogRobots({})
  assert.equal(canonical.index, true)
  assert.equal(canonical.follow, true)

  // Cualquier filtro real -> noindex, pero follow para no perder el rastreo de las fichas.
  for (const params of [
    { pagina: '2' },
    { orden: 'precio-asc' },
    { operacion: 'venta' },
    { q: 'apartamento' },
    { estado: 'carabobo', ciudad: 'valencia' },
    { precioMin: '50000', precioMax: '120000' },
    { amenidades: ['pozo', 'planta'] },
  ]) {
    assert.equal(hasActiveCatalogParams(params), true, `Se esperaban parámetros activos en ${JSON.stringify(params)}`)
    const robots = catalogRobots(params)
    assert.equal(robots.index, false, `La vista ${JSON.stringify(params)} no debe indexarse`)
    assert.equal(robots.follow, true, `La vista ${JSON.stringify(params)} debe permitir seguir enlaces`)
    assert.equal(robots.googleBot?.index, false)
    assert.equal(robots.googleBot?.follow, true)
  }
})

test('El catálogo aplica la política: canonical sin parámetros y robots según la query', () => {
  const catalogPage = readFileSync('src/app/[locale]/catalogo/page.tsx', 'utf8')

  assert.match(catalogPage, /searchParams: Promise<CatalogSearchParams>/)
  assert.match(catalogPage, /robots: catalogRobots\(searchParams\)/)
  assert.match(catalogPage, /buildPageAlternates\(locale, '\/catalogo'\)/)

  // El canonical no debe arrastrar la query: siempre la ruta limpia.
  assert.doesNotMatch(catalogPage, /buildPageAlternates\(locale, `\/catalogo\$\{/)

  // Los parámetros no deben inyectarse en el título: evita títulos duplicados por filtro.
  assert.doesNotMatch(catalogPage, /title:.*searchParams/)
})

test('robots.txt no bloquea /catalogo: Disallow impediría leer el noindex', () => {
  const robotsFile = readFileSync('src/app/robots.ts', 'utf8')
  assert.doesNotMatch(robotsFile, /'\/catalogo'/, '`/catalogo` no debe estar en Disallow')
  assert.match(robotsFile, /'\/buscar'/, '`/buscar` sigue siendo una ruta privada')

  const nextConfig = readFileSync('next.config.js', 'utf8')
  assert.doesNotMatch(nextConfig, /source: '\/catalogo/, 'No debe haber reglas especiales sobre /catalogo')
})
