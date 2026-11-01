import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ESTADOS, MUNICIPIOS_POR_ESTADO } from '../src/lib/ubicaciones.ts'
import {
  VE_CENTER,
  VE_ZOOM,
  VE_STATE_ZOOM,
  VE_CITY_ZOOM,
  VE_PIN_ZOOM,
  resolveListingGeo,
  resolveLocationViewport,
} from '../src/lib/geo/venezuela.ts'

test('Geo Venezuela: progresión de zoom País -> Estado (Carabobo) -> Municipio (San Diego) -> Pin', () => {
  // 1) Sin selección: vista general de Venezuela
  const countryView = resolveLocationViewport({ estado: '', ciudad: '' })
  assert.equal(countryView.level, 'country')
  assert.equal(countryView.zoom, VE_ZOOM)
  assert.deepEqual(countryView.center, VE_CENTER)

  // 2) Solo Estado (Carabobo): zoom estadal
  const stateView = resolveLocationViewport({ estado: 'Carabobo', ciudad: '' })
  assert.equal(stateView.level, 'state')
  assert.equal(stateView.zoom, VE_STATE_ZOOM)
  assert.ok(Math.abs(stateView.center.lat - 10.162) < 0.05)

  // 3) Estado + Ciudad/Municipio (San Diego, Carabobo): zoom urbano sobre San Diego (NO Caracas ni Valencia)
  const sanDiegoView = resolveLocationViewport({ estado: 'Carabobo', ciudad: 'San Diego' })
  assert.equal(sanDiegoView.level, 'city')
  assert.equal(sanDiegoView.zoom, VE_CITY_ZOOM)
  assert.ok(Math.abs(sanDiegoView.center.lat - 10.2558) < 0.01)
  assert.ok(Math.abs(sanDiegoView.center.lng - -67.9536) < 0.01)
  assert.notDeepEqual(sanDiegoView.center, stateView.center, 'San Diego no debe caer en el centro de Valencia')

  // 4) Pin exacto guardado (modo edición inicial)
  const pinView = resolveLocationViewport({
    latitud: 10.26123,
    longitud: -67.95891,
    estado: 'Carabobo',
    ciudad: 'San Diego',
  })
  assert.equal(pinView.level, 'pin')
  assert.equal(pinView.zoom, VE_PIN_ZOOM)
  assert.equal(pinView.center.lat, 10.26123)
  assert.equal(pinView.center.lng, -67.95891)
})

test('Geo Venezuela: cobertura 100% de los 24 estados y 327 municipios + capitales sin duplicados', () => {
  let count = 0
  for (const estado of ESTADOS) {
    const seenCapitals = new Set()
    const municipios = MUNICIPIOS_POR_ESTADO[estado] || []
    assert.ok(municipios.length > 0, `${estado} debe tener municipios`)

    const stateOnly = resolveLocationViewport({ estado })
    assert.equal(stateOnly.level, 'state', `Estado ${estado} debe resolver nivel 'state'`)

    for (const mun of municipios) {
      count++
      assert.equal(
        seenCapitals.has(mun.capital),
        false,
        `Capital duplicada '${mun.capital}' dentro del estado ${estado}`
      )
      seenCapitals.add(mun.capital)

      // Debe resolver a nivel 'city' tanto por capital como por nombre de municipio
      const byCapital = resolveLocationViewport({ estado, ciudad: mun.capital })
      const byMunicipio = resolveLocationViewport({ estado, municipio: mun.nombre })

      assert.equal(
        byCapital.level,
        'city',
        `${mun.capital} (${estado}) debe resolver nivel 'city', no caer en estado/país`
      )
      assert.equal(
        byMunicipio.level,
        'city',
        `Municipio ${mun.nombre} (${estado}) debe resolver nivel 'city'`
      )
      assert.ok(
        byCapital.center.lat >= 0.6 && byCapital.center.lat <= 12.5,
        `Latitud fuera de Venezuela para ${mun.capital}, ${estado}: ${byCapital.center.lat}`
      )
      assert.ok(
        byCapital.center.lng >= -73.5 && byCapital.center.lng <= -59.5,
        `Longitud fuera de Venezuela para ${mun.capital}, ${estado}: ${byCapital.center.lng}`
      )
    }
  }
  assert.ok(count >= 325, `Se esperaban >= 325 municipios indexados y se verificaron ${count}`)
})

test('Geo Venezuela: desambiguación estricta de municipios homónimos entre estados', () => {
  // Libertador: Carabobo (Tocuyito) vs Distrito Capital (Caracas) vs Mérida vs Aragua (Palo Negro)
  const libCarabobo = resolveListingGeo({ estado: 'Carabobo', municipio: 'Libertador' })
  const libCaracas = resolveListingGeo({ estado: 'Distrito Capital', municipio: 'Libertador' })
  const libMerida = resolveListingGeo({ estado: 'Mérida', municipio: 'Libertador' })
  const libAragua = resolveListingGeo({ estado: 'Aragua', municipio: 'Libertador' })

  assert.ok(libCarabobo.point && libCaracas.point && libMerida.point && libAragua.point)
  assert.ok(Math.abs(libCarabobo.point.lng - -68.0678) < 0.02, 'Libertador Carabobo debe ser Tocuyito')
  assert.ok(Math.abs(libCaracas.point.lng - -66.9036) < 0.02, 'Libertador DC debe ser Caracas')
  assert.ok(Math.abs(libMerida.point.lng - -71.1561) < 0.02, 'Libertador Mérida debe ser Mérida')
  assert.ok(Math.abs(libAragua.point.lng - -67.5419) < 0.02, 'Libertador Aragua debe ser Palo Negro')

  // Miranda: Carabobo vs Falcón (Coro) vs Zulia (Los Puertos)
  const mirCarabobo = resolveListingGeo({ estado: 'Carabobo', ciudad: 'Miranda' })
  const mirFalcon = resolveListingGeo({ estado: 'Falcón', municipio: 'Miranda' })
  const mirZulia = resolveListingGeo({ estado: 'Zulia', municipio: 'Miranda' })
  assert.notDeepEqual(mirCarabobo.point, mirFalcon.point)
  assert.notDeepEqual(mirCarabobo.point, mirZulia.point)

  // Nombres oficiales largos en Miranda (Baruta y El Hatillo)
  const barutaFull = resolveListingGeo({
    estado: 'Miranda',
    ciudad: 'Nuestra Señora del Rosario de Baruta',
  })
  const elHatilloFull = resolveListingGeo({
    estado: 'Miranda',
    ciudad: 'Santa Rosalía de Palermo de El Hatillo',
  })
  assert.ok(Math.abs(barutaFull.point.lat - 10.4335) < 0.01)
  assert.ok(Math.abs(elHatilloFull.point.lat - 10.4244) < 0.01)
})

test('LocationPicker y PropertyMap reaccionan dinámicamente a cambios de estado y ciudad/municipio', () => {
  const propertyMap = readFileSync('src/components/map/PropertyMap.tsx', 'utf8')
  assert.match(propertyMap, /viewCenter/)
  assert.match(propertyMap, /viewZoom/)
  assert.match(propertyMap, /viewKey/)
  assert.match(propertyMap, /map\.flyTo\(\[viewLat,\s*viewLng\]/)

  const picker = readFileSync('src/components/map/LocationPicker.tsx', 'utf8')
  assert.match(picker, /viewCenter=\{center\}/)
  assert.match(picker, /viewZoom=\{zoom\}/)
  assert.match(picker, /viewKey=\{effectiveViewKey\}/)

  const publishPage = readFileSync('src/app/[locale]/publicar-inmueble/page.tsx', 'utf8')
  assert.match(publishPage, /resolveLocationViewport\(\{\s*estado,\s*ciudad\s*\}\)/)
  assert.match(publishPage, /zoom=\{mapViewport\.zoom\}/)
  assert.match(publishPage, /viewKey=\{mapViewport\.key\}/)

  const editPage = readFileSync('src/app/[locale]/inmueble/editar/[id]/page.tsx', 'utf8')
  assert.match(editPage, /resolveLocationViewport\(/)
  assert.match(editPage, /zoom=\{editViewport\.zoom\}/)
  assert.match(editPage, /viewKey=\{editViewport\.key\}/)
})
