import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  canPlanIncludeRichMedia,
  parseFloorPlanMedia,
  parseVideoMedia,
  parseVirtualTourMedia,
  sanitizeExternalMediaUrl,
} from '../src/lib/property-media.ts'
import {
  calculatePricePerM2,
  classifyLocationInput,
  getUrbanizacionesSugeridas,
  sanitizePostgrestSearchTerm,
} from '../src/lib/urbanizaciones.ts'
import {
  CATALOG_SORT_KEYS,
  normalizeCatalogSort,
  sortCatalogProperties,
} from '../src/lib/catalog-sort.ts'

test('property-media: valida URLs públicas HTTPS y bloquea esquemas/hosts inseguros', () => {
  assert.equal(
    sanitizeExternalMediaUrl(' https://www.youtube.com/watch?v=dQw4w9WgXcQ '),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  )
  assert.equal(sanitizeExternalMediaUrl('http://youtube.com/watch?v=dQw4w9WgXcQ'), null)
  assert.equal(sanitizeExternalMediaUrl('javascript:alert(1)'), null)
  assert.equal(sanitizeExternalMediaUrl('https://localhost:3000/video.mp4'), null)
  assert.equal(sanitizeExternalMediaUrl('https://127.0.0.1/video.mp4'), null)
  assert.equal(sanitizeExternalMediaUrl('https://192.168.1.10/plano.png'), null)
  assert.equal(sanitizeExternalMediaUrl('https://user:pass@example.com/plano.png'), null)
  assert.equal(sanitizeExternalMediaUrl(''), null)
})

test('property-media: resuelve embeds de YouTube, Shorts, Vimeo, Matterport, Kuula y planos', () => {
  const yt = parseVideoMedia('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  assert.equal(yt?.provider, 'youtube')
  assert.equal(yt?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1')
  assert.equal(yt?.isVertical, false)

  const short = parseVideoMedia('https://www.youtube.com/shorts/abc123XYZ_-')
  assert.equal(short?.provider, 'youtube')
  assert.equal(short?.isVertical, true)

  const vimeo = parseVideoMedia('https://vimeo.com/76979871')
  assert.equal(vimeo?.provider, 'vimeo')
  assert.equal(vimeo?.embedUrl, 'https://player.vimeo.com/video/76979871?dnt=1')

  const reel = parseVideoMedia('https://www.instagram.com/reel/C9xYz123/')
  assert.equal(reel?.provider, 'instagram')
  assert.equal(reel?.embedUrl, null)
  assert.equal(reel?.isVertical, true)

  const mp = parseVirtualTourMedia('https://my.matterport.com/show/?m=SxQL3iGyoDo')
  assert.equal(mp?.provider, 'matterport')
  assert.match(mp?.embedUrl || '', /^https:\/\/my\.matterport\.com\/show\/\?m=SxQL3iGyoDo/)

  const kuula = parseVirtualTourMedia('https://kuula.co/share/collection/7vXzY')
  assert.equal(kuula?.provider, 'kuula')
  assert.equal(kuula?.embedUrl, 'https://kuula.co/share/collection/7vXzY')

  assert.equal(parseFloorPlanMedia('https://pub-xxx.r2.dev/u1/planos/planta.webp')?.kind, 'image')
  assert.equal(parseFloorPlanMedia('https://example.com/planos/apartamento.pdf')?.kind, 'pdf')

  assert.equal(canPlanIncludeRichMedia('gratuita'), false)
  assert.equal(canPlanIncludeRichMedia('profesional'), true)
  assert.equal(canPlanIncludeRichMedia('agencia'), true)
})

test('urbanizaciones: sugiere zonas reales por ciudad/estado, clasifica ubicación y calcula $/m²', () => {
  const zonasCaracas = getUrbanizacionesSugeridas('Miranda', 'Caracas')
  assert.ok(zonasCaracas.includes('Las Mercedes'))
  assert.ok(zonasCaracas.includes('Altamira'))

  const zonasValencia = getUrbanizacionesSugeridas('Carabobo', 'San Diego')
  assert.ok(zonasValencia.includes('El Remanso'))
  assert.ok(zonasValencia.includes('El Parral'))

  assert.deepEqual(classifyLocationInput('valencia'), { kind: 'ciudad', value: 'Valencia' })
  assert.deepEqual(classifyLocationInput('Lecheria'), { kind: 'ciudad', value: 'Lechería' })
  assert.deepEqual(classifyLocationInput('Las Mercedes'), { kind: 'zona', value: 'Las Mercedes' })
  assert.deepEqual(classifyLocationInput('   '), { kind: 'empty', value: '' })

  assert.equal(sanitizePostgrestSearchTerm('Las Mercedes, (Caracas)%*'), 'Las Mercedes Caracas')
  assert.equal(calculatePricePerM2(120000, 100, 150), 1200)
  assert.equal(calculatePricePerM2(90000, null, 180), 500)
  assert.equal(calculatePricePerM2(0, 100, 100), null)
  assert.equal(calculatePricePerM2(100000, 0, 0), null)
})

test('catalog-sort: ordena por relevancia, recientes, precio, $/m² y metraje dejando vacíos al final', () => {
  for (const key of CATALOG_SORT_KEYS) {
    assert.equal(normalizeCatalogSort(key), key)
  }
  assert.equal(normalizeCatalogSort('desconocido'), 'relevancia')

  const now = Date.parse('2026-11-01T12:00:00Z')
  const items = [
    { id: 'sin-precio', precio: 0, area_total: 200, creado_en: '2026-11-01T10:00:00Z' },
    { id: 'caro', precio: 180000, area_construida: 90, creado_en: '2026-10-28T10:00:00Z' }, // $2.000/m²
    { id: 'destacado', precio: 95000, area_construida: 95, destacado: true, destacado_hasta: '2026-11-15T00:00:00Z', creado_en: '2026-10-20T10:00:00Z' }, // $1.000/m²
    { id: 'economico-m2', precio: 110000, area_construida: 220, creado_en: '2026-10-25T10:00:00Z' }, // $500/m²
  ]

  assert.deepEqual(
    sortCatalogProperties(items, 'relevancia', now).map((x) => x.id),
    ['destacado', 'sin-precio', 'caro', 'economico-m2']
  )
  assert.deepEqual(
    sortCatalogProperties(items, 'recientes', now).map((x) => x.id),
    ['sin-precio', 'caro', 'economico-m2', 'destacado']
  )
  assert.deepEqual(
    sortCatalogProperties(items, 'precio_asc', now).map((x) => x.id),
    ['destacado', 'economico-m2', 'caro', 'sin-precio']
  )
  assert.deepEqual(
    sortCatalogProperties(items, 'precio_desc', now).map((x) => x.id),
    ['caro', 'economico-m2', 'destacado', 'sin-precio']
  )
  assert.deepEqual(
    sortCatalogProperties(items, 'precio_m2_asc', now).map((x) => x.id),
    ['economico-m2', 'destacado', 'caro', 'sin-precio']
  )
  assert.deepEqual(
    sortCatalogProperties(items, 'area_desc', now).map((x) => x.id),
    ['economico-m2', 'sin-precio', 'destacado', 'caro']
  )
})

test('Etapa A cableado completo: HomeSearch alquiler/venta, tarjetas sin botones anidados, multimedia, similares y limpieza de rutas', () => {
  const homeSearch = readFileSync('src/components/home/HomeSearch.tsx', 'utf8')
  assert.match(homeSearch, /SALE_PRICE_STEPS/)
  assert.match(homeSearch, /RENT_PRICE_STEPS/)
  assert.match(homeSearch, /classifyLocationInput/)

  const catalogo = readFileSync('src/app/[locale]/catalogo/CatalogoPage.tsx', 'utf8')
  assert.match(catalogo, /id="catalog-sort-select"/)
  assert.match(catalogo, /onZonaChange/)

  for (const cardFile of [
    'src/components/PropertyCard.tsx',
    'src/components/ProductCardLazy.tsx',
    'src/components/home/ListingCard.tsx',
  ]) {
    const src = readFileSync(cardFile, 'utf8')
    assert.match(src, /FavoriteCardButton/)
    assert.match(src, /calculatePricePerM2/)
  }

  const ficha = readFileSync('src/app/[locale]/inmueble/[id]/page.tsx', 'utf8')
  assert.match(ficha, /<PropertyRichMedia/)
  assert.match(ficha, /getSimilarProperties/)
  assert.match(ficha, /property-detail__similar/)

  const nextCfg = readFileSync('next.config.js', 'utf8')
  assert.match(nextCfg, /https:\/\/www\.youtube-nocookie\.com/)
  assert.match(nextCfg, /frame-ancestors 'none'/)

  const middleware = readFileSync('src/middleware.ts', 'utf8')
  assert.match(middleware, /publicar-inmueble/)
  assert.match(middleware, /return NextResponse\.redirect\(dest,\s*308\)/)

  for (const removedDir of [
    'test-catalog',
    'test-db',
    'test-layout-only',
    'test-minimal',
    'test-product',
    'test-supabase',
  ]) {
    assert.equal(existsSync(`src/app/[locale]/${removedDir}`), false, `${removedDir} debe estar eliminado`)
  }
})
