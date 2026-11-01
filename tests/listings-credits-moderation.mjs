import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  fetchListingsByLocation,
  mapViewRowToCardProperty,
  resolveCityByParam,
  resolveStateByParam,
} from '../src/lib/location-listings.ts'
import { evaluarModeracionServidor, verificarContenido } from '../src/lib/moderacion.ts'

function fakeSupabase({ states = [], cities = [], rows = [], failTable = null } = {}) {
  return {
    calls: [],
    from(table) {
      const call = { table, filters: [], selectCols: null }
      this.calls.push(call)
      const chain = {
        select(cols) { call.selectCols = cols; return chain },
        eq(col, val) { call.filters.push(['eq', col, val]); return chain },
        ilike(col, val) { call.filters.push(['ilike', col, val]); return chain },
        or(expr) { call.filters.push(['or', expr]); return chain },
        order() { return chain },
        limit() { return chain },
        async maybeSingle() {
          if (failTable === table) return { data: null, error: { message: 'connection failed' } }
          if (table === 'states') return { data: states[0] ?? null, error: null }
          if (table === 'cities') return { data: cities[0] ?? null, error: null }
          return { data: null, error: null }
        },
        then(resolve) {
          if (failTable === table) return Promise.resolve({ data: null, error: { message: 'db error' } }).then(resolve)
          return Promise.resolve({ data: rows, error: null }).then(resolve)
        },
      }
      return chain
    },
  }
}

test('F16: fetchListingsByLocation consulta columnas reales de vw_propiedades_publicas y mapea habitaciones/baños/área', async () => {
  const sb = fakeSupabase({
    rows: [
      {
        id: 'prop-1',
        titulo: 'Quinta en San Diego',
        slug: 'quinta-san-diego',
        precio: 85000,
        ciudad: 'San Diego',
        estado: 'Carabobo',
        main_image_url: 'https://cdn.example.com/1.webp',
        habitaciones: 4,
        banos: 3,
        area_total: 240,
        tipo_operacion: 'venta',
      },
    ],
  })

  const { properties, serviceError } = await fetchListingsByLocation(sb, {
    operacion: 'venta',
    state: { id: 'carabobo', name: 'Carabobo', slug: 'carabobo' },
    city: { id: 'carabobo-san-diego', name: 'San Diego', slug: 'san-diego', state_id: 'carabobo' },
  })

  assert.equal(serviceError, false)
  assert.equal(properties.length, 1)
  assert.deepEqual(properties[0], {
    id: 'prop-1',
    title: 'Quinta en San Diego',
    slug: 'quinta-san-diego',
    price: 85000,
    operation_type: 'venta',
    city: 'San Diego',
    state: 'Carabobo',
    main_image_url: 'https://cdn.example.com/1.webp',
    bedrooms: 4,
    bathrooms: 3,
    area_size: 240,
  })

  const viewCall = sb.calls.find((c) => c.table === 'vw_propiedades_publicas')
  assert.ok(viewCall)
  assert.doesNotMatch(viewCall.selectCols, /property_images|states\s*\(|cities\s*\(/)
  assert.deepEqual(viewCall.filters[0], ['eq', 'tipo_operacion', 'venta'])
})

test('F16: distingue error del servicio frente a ausencia real de estado/ciudad o inventario', async () => {
  const sbDown = fakeSupabase({ failTable: 'states' })
  const rStateErr = await resolveStateByParam(sbDown, 'carabobo')
  assert.equal(rStateErr.state, null)
  assert.equal(rStateErr.serviceError, true)

  const sbEmpty = fakeSupabase({ states: [] })
  const rStateMissing = await resolveStateByParam(sbEmpty, 'no-existe')
  assert.equal(rStateMissing.state, null)
  assert.equal(rStateMissing.serviceError, false)

  const sbCity = fakeSupabase({
    cities: [{ id: 'carabobo-san-diego', name: 'San Diego', slug: 'san-diego', state_id: 'carabobo' }],
  })
  const rCity = await resolveCityByParam(sbCity, 'carabobo', 'san-diego')
  assert.equal(rCity.serviceError, false)
  assert.equal(rCity.city?.name, 'San Diego')

  const sbQueryErr = fakeSupabase({ failTable: 'vw_propiedades_publicas' })
  const rListingsErr = await fetchListingsByLocation(sbQueryErr, { operacion: 'alquiler' })
  assert.equal(rListingsErr.serviceError, true)
  assert.equal(rListingsErr.properties.length, 0)

  const mappedFallback = mapViewRowToCardProperty({ id: 'x', precio: '1200' }, 'alquiler')
  assert.equal(mappedFallback.operation_type, 'alquiler')
  assert.equal(mappedFallback.price, 1200)
})

test('F16/F19: ninguna página de /propiedades usa joins inexistentes y properties.ts filtra antes de paginar', () => {
  const pages = [
    'src/app/[locale]/propiedades/venta/page.tsx',
    'src/app/[locale]/propiedades/alquiler/page.tsx',
    'src/app/[locale]/propiedades/venta/[estado]/page.tsx',
    'src/app/[locale]/propiedades/alquiler/[estado]/page.tsx',
    'src/app/[locale]/propiedades/venta/[estado]/[ciudad]/page.tsx',
    'src/app/[locale]/propiedades/alquiler/[estado]/[ciudad]/page.tsx',
  ]
  for (const p of pages) {
    const src = readFileSync(p, 'utf8')
    assert.doesNotMatch(src, /property_images/, `${p} no debe consultar property_images`)
    assert.doesNotMatch(src, /operacion_tipo/, `${p} no debe filtrar por operacion_tipo heredado`)
    assert.match(src, /role="alert"/, `${p} debe mostrar alerta explícita ante fallo de servicio`)
  }

  const libProps = readFileSync('src/lib/properties.ts', 'utf8')
  const idxBedrooms = libProps.indexOf("query.gte('habitaciones'")
  const idxAmenities = libProps.indexOf("query.contains('caracteristicas'")
  const idxRange = libProps.indexOf('query.range(from, to)')
  assert.ok(idxBedrooms > 0 && idxBedrooms < idxRange, 'habitaciones debe filtrarse antes de range()')
  assert.ok(idxAmenities > 0 && idxAmenities < idxRange, 'caracteristicas debe filtrarse antes de range()')
})

test('F17/F18: la página de Créditos usa t.rich, pasa {count} y alinea métodos ES/EN sin claves rotas', () => {
  const page = readFileSync('src/app/[locale]/creditos/page.tsx', 'utf8')
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/)
  assert.doesNotMatch(page, /\.replace\(['"]\{count\}['"]/)
  assert.doesNotMatch(page, /Transferencia/)
  assert.match(page, /t\.rich\('subtitle'/)
  assert.match(page, /t\.rich\('boostDesc'/)
  assert.match(page, /t\.rich\('featureDesc'/)
  assert.match(page, /t\('orFeatured',\s*\{\s*count:/)
  assert.match(page, /CREDIT_PACKAGES/)

  const es = JSON.parse(readFileSync('src/i18n/dictionaries/es.json', 'utf8')).creditos
  const en = JSON.parse(readFileSync('src/i18n/dictionaries/en.json', 'utf8')).creditos
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort())
  for (const k of ['accumulableFeatured', 'tier12h', 'tier24h', 'tier48h', 'step1', 'step2', 'step3', 'step4']) {
    assert.equal(typeof es[k], 'string')
    assert.equal(typeof en[k], 'string')
  }
  assert.doesNotMatch(es.step4, /8am-10pm/i)
  assert.doesNotMatch(en.step4, /8am-10pm/i)
})

test('F19: moderación del servidor detecta prohibidos/sospechosos sin falsos positivos en textos inmobiliarios', () => {
  const normal = verificarContenido(
    'Apartamento remodelado con espacio para computadora, excelente reputación del condominio y piso antiresbaladizo en urbanización C4B.'
  )
  assert.equal(normal.nivel, 'limpio')

  const sospechoso = evaluarModeracionServidor('Apartamento en Chacao', 'Solo cripto y pago por adelantado antes de mostrar')
  assert.equal(sospechoso.permitido, true)
  assert.equal(sospechoso.estadoModeracion, 'pendiente')

  const prohibido = evaluarModeracionServidor('Venta de cédula falsa', 'Entrega inmediata')
  assert.equal(prohibido.permitido, false)

  const apiPublicar = readFileSync('src/app/api/publicar/route.ts', 'utf8')
  const apiProperties = readFileSync('src/app/api/properties/route.ts', 'utf8')
  assert.doesNotMatch(apiPublicar, /body\.estado_moderacion/)
  assert.match(apiPublicar, /evaluarModeracionServidor/)
  assert.match(apiProperties, /evaluarModeracionServidor/)
})
