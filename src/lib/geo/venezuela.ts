/**
 * Geodatos abiertos de Venezuela (centroides de los 24 estados y 327 municipios).
 *
 * Se usan para:
 * 1) Encuadrar y hacer zoom dinámico en el mapa al seleccionar estado, ciudad
 *    o municipio durante la publicación o edición de un anuncio.
 * 2) Respaldo cuando un inmueble no tiene `latitud`/`longitud` exactas: el
 *    marcador se dibuja en su ciudad/municipio y la interfaz lo señala como
 *    "ubicación aproximada".
 */

import { MUNICIPIOS_POR_ESTADO } from '../ubicaciones.ts'
import { MUNICIPIOS_COORDS_POR_ESTADO } from './municipios-coords.ts'

export type GeoPoint = { lat: number; lng: number }

export type ListingGeoInput = {
  latitud?: number | string | null
  longitud?: number | string | null
  ciudad?: string | null
  municipio?: string | null
  estado?: string | null
  zona?: string | null
}

export type ResolvedGeo = {
  point: GeoPoint | null
  approximate: boolean
}

export type LocationViewport = {
  center: GeoPoint
  zoom: number
  level: 'pin' | 'city' | 'state' | 'country'
  key: string
}

/** Centro geográfico de Venezuela (para el encuadre general inicial). */
export const VE_CENTER: GeoPoint = { lat: 8.6, lng: -66.2 }
export const VE_ZOOM = 6
export const VE_STATE_ZOOM = 9.5
export const VE_CITY_ZOOM = 13.5
export const VE_PIN_ZOOM = 15.5

export function normalizePlace(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Centroides representativos de los 24 estados/entidades federales. */
const STATE_COORDS: Record<string, GeoPoint> = {
  'distrito capital': { lat: 10.4806, lng: -66.9036 },
  amazonas: { lat: 5.6631, lng: -67.6236 },
  anzoategui: { lat: 10.1363, lng: -64.6862 },
  apure: { lat: 7.8878, lng: -67.4723 },
  aragua: { lat: 10.2469, lng: -67.5958 },
  barinas: { lat: 8.6226, lng: -70.2075 },
  bolivar: { lat: 8.1222, lng: -63.5497 },
  carabobo: { lat: 10.1620, lng: -68.0077 },
  cojedes: { lat: 9.6612, lng: -68.5827 },
  'delta amacuro': { lat: 9.0581, lng: -62.0500 },
  falcon: { lat: 11.4045, lng: -69.6734 },
  guarico: { lat: 9.9115, lng: -67.3587 },
  lara: { lat: 10.0678, lng: -69.3475 },
  merida: { lat: 8.5897, lng: -71.1561 },
  miranda: { lat: 10.3445, lng: -67.0433 },
  monagas: { lat: 9.7457, lng: -63.1837 },
  'nueva esparta': { lat: 11.0000, lng: -63.8628 },
  portuguesa: { lat: 9.0436, lng: -69.7486 },
  sucre: { lat: 10.4539, lng: -64.1825 },
  tachira: { lat: 7.7669, lng: -72.2250 },
  trujillo: { lat: 9.3667, lng: -70.4333 },
  vargas: { lat: 10.5990, lng: -66.9346 },
  'la guaira': { lat: 10.5990, lng: -66.9346 },
  yaracuy: { lat: 10.3399, lng: -68.7425 },
  zulia: { lat: 10.6427, lng: -71.6125 },
}

/** Capitales, ciudades principales y zonas urbanas frecuentes (respaldo sin estado). */
const CITY_COORDS: Record<string, GeoPoint> = {
  // Distrito Capital / Miranda
  caracas: { lat: 10.4806, lng: -66.9036 },
  chacao: { lat: 10.4961, lng: -66.8517 },
  altamira: { lat: 10.4989, lng: -66.8522 },
  'los palos grandes': { lat: 10.5017, lng: -66.8428 },
  'la castellana': { lat: 10.5022, lng: -66.8569 },
  baruta: { lat: 10.4335, lng: -66.8753 },
  'las mercedes': { lat: 10.4803, lng: -66.8606 },
  'prados del este': { lat: 10.4508, lng: -66.8806 },
  'el hatillo': { lat: 10.4244, lng: -66.8244 },
  petare: { lat: 10.4779, lng: -66.8092 },
  'los chorros': { lat: 10.4952, lng: -66.8237 },
  'los teques': { lat: 10.3445, lng: -67.0433 },
  'san antonio de los altos': { lat: 10.3742, lng: -66.9539 },
  carrizal: { lat: 10.3497, lng: -66.9864 },
  guarenas: { lat: 10.4703, lng: -66.6164 },
  guatire: { lat: 10.4764, lng: -66.5428 },
  higuerote: { lat: 10.4853, lng: -66.1011 },
  charallave: { lat: 10.2425, lng: -66.8572 },
  cua: { lat: 10.1603, lng: -66.8858 },
  'ocumare del tuy': { lat: 10.1181, lng: -66.7753 },
  'santa teresa del tuy': { lat: 10.2331, lng: -66.6636 },

  // La Guaira / Vargas
  'la guaira': { lat: 10.5990, lng: -66.9346 },
  'catia la mar': { lat: 10.5953, lng: -67.0297 },
  macuto: { lat: 10.6083, lng: -66.8908 },
  caraballeda: { lat: 10.6147, lng: -66.8519 },

  // Carabobo
  valencia: { lat: 10.1620, lng: -68.0077 },
  'san diego': { lat: 10.2558, lng: -67.9536 },
  naguanagua: { lat: 10.2547, lng: -68.0108 },
  manongo: { lat: 10.2478, lng: -68.0006 },
  prebo: { lat: 10.2131, lng: -68.0169 },
  'el trigal': { lat: 10.2189, lng: -67.9978 },
  tocuyito: { lat: 10.1136, lng: -68.0678 },
  'los guayos': { lat: 10.1894, lng: -67.9381 },
  guacara: { lat: 10.2289, lng: -67.8772 },
  'san joaquin': { lat: 10.2631, lng: -67.7858 },
  mariara: { lat: 10.2964, lng: -67.7178 },
  guigue: { lat: 10.0833, lng: -67.7792 },
  'puerto cabello': { lat: 10.4731, lng: -68.0125 },
  moron: { lat: 10.4869, lng: -68.2003 },
  bejuma: { lat: 10.1725, lng: -68.2589 },
  montalban: { lat: 10.2144, lng: -68.3283 },

  // Aragua
  maracay: { lat: 10.2469, lng: -67.5958 },
  'el limon': { lat: 10.3014, lng: -67.6322 },
  turmero: { lat: 10.2286, lng: -67.4742 },
  cagua: { lat: 10.1869, lng: -67.4594 },
  'la victoria': { lat: 10.2278, lng: -67.3303 },
  'colonia tovar': { lat: 10.4086, lng: -67.2894 },
  'villa de cura': { lat: 10.0386, lng: -67.4892 },

  // Occidente y Andes
  barquisimeto: { lat: 10.0678, lng: -69.3475 },
  cabudare: { lat: 10.0331, lng: -69.2633 },
  carora: { lat: 10.1756, lng: -70.0828 },
  'san felipe': { lat: 10.3399, lng: -68.7425 },
  yaritagua: { lat: 10.0800, lng: -69.1261 },
  'san carlos': { lat: 9.6612, lng: -68.5827 },
  tinaquillo: { lat: 9.9186, lng: -68.3047 },
  guanare: { lat: 9.0436, lng: -69.7486 },
  acarigua: { lat: 9.5553, lng: -69.1950 },
  araure: { lat: 9.5608, lng: -69.2147 },
  coro: { lat: 11.4045, lng: -69.6734 },
  'santa ana de coro': { lat: 11.4045, lng: -69.6734 },
  'punto fijo': { lat: 11.6956, lng: -70.1997 },
  tucacas: { lat: 10.7906, lng: -68.3256 },
  chichiriviche: { lat: 10.9308, lng: -68.2728 },
  barinas: { lat: 8.6226, lng: -70.2075 },
  merida: { lat: 8.5897, lng: -71.1561 },
  ejido: { lat: 8.5467, lng: -71.2408 },
  'el vigia': { lat: 8.6136, lng: -71.6575 },
  trujillo: { lat: 9.3667, lng: -70.4333 },
  valera: { lat: 9.3178, lng: -70.6036 },
  bocono: { lat: 9.2539, lng: -70.2511 },
  'san cristobal': { lat: 7.7669, lng: -72.2250 },
  tariba: { lat: 7.7919, lng: -72.2194 },
  rubio: { lat: 7.7014, lng: -72.3556 },
  'san antonio del tachira': { lat: 7.8147, lng: -72.4431 },
  'la grita': { lat: 8.1333, lng: -71.9833 },
  maracaibo: { lat: 10.6427, lng: -71.6125 },
  'san francisco': { lat: 10.5519, lng: -71.6442 },
  cabimas: { lat: 10.3991, lng: -71.4456 },
  'ciudad ojeda': { lat: 10.1964, lng: -71.3083 },

  // Oriente, Llanos y Sur
  barcelona: { lat: 10.1363, lng: -64.6862 },
  'puerto la cruz': { lat: 10.2142, lng: -64.6328 },
  lecheria: { lat: 10.1869, lng: -64.6917 },
  guanta: { lat: 10.2369, lng: -64.5944 },
  anaco: { lat: 9.4319, lng: -64.4694 },
  'el tigre': { lat: 8.8875, lng: -64.2454 },
  cumana: { lat: 10.4539, lng: -64.1825 },
  carupano: { lat: 10.6678, lng: -63.2583 },
  maturin: { lat: 9.7457, lng: -63.1837 },
  'ciudad bolivar': { lat: 8.1222, lng: -63.5497 },
  'puerto ordaz': { lat: 8.3000, lng: -62.7167 },
  'san felix': { lat: 8.3661, lng: -62.6528 },
  'ciudad guayana': { lat: 8.3114, lng: -62.7117 },
  upata: { lat: 8.0103, lng: -62.3989 },
  porlamar: { lat: 10.9577, lng: -63.8491 },
  pampatar: { lat: 10.9986, lng: -63.7975 },
  'la asuncion': { lat: 11.0333, lng: -63.8628 },
  'juan griego': { lat: 11.0819, lng: -63.9669 },
  'san fernando de apure': { lat: 7.8878, lng: -67.4723 },
  'san juan de los morros': { lat: 9.9115, lng: -67.3587 },
  'valle de la pascua': { lat: 9.2156, lng: -65.9994 },
  tucupita: { lat: 9.0581, lng: -62.0500 },
  'puerto ayacucho': { lat: 5.6631, lng: -67.6236 },
  'santa elena de uairen': { lat: 4.6022, lng: -61.1103 },
}

/**
 * Índice indexado por `estado::lugar` para los 327 municipios y sus capitales,
 * evitando colisiones entre municipios homónimos de distintos estados
 * (p. ej. Libertador en Carabobo/Tocuyito vs. Distrito Capital/Caracas vs. Mérida).
 */
const STATE_PLACE_COORDS = new Map<string, GeoPoint>()

;(function buildMunicipioIndex() {
  for (const [estado, municipios] of Object.entries(MUNICIPIOS_POR_ESTADO)) {
    const stateKey = normalizePlace(estado)
    const stateCoordsMap = MUNICIPIOS_COORDS_POR_ESTADO[estado] || {}

    for (const mun of municipios) {
      const tuple = stateCoordsMap[mun.nombre]
      if (!tuple) continue
      const point: GeoPoint = { lat: tuple[0], lng: tuple[1] }

      const munKey = normalizePlace(mun.nombre)
      const capKey = normalizePlace(mun.capital)
      const combinedKey = normalizePlace(`${mun.capital} (${mun.nombre})`)

      if (munKey) STATE_PLACE_COORDS.set(`${stateKey}::${munKey}`, point)
      if (capKey) STATE_PLACE_COORDS.set(`${stateKey}::${capKey}`, point)
      if (combinedKey) STATE_PLACE_COORDS.set(`${stateKey}::${combinedKey}`, point)

      // Si no existía aún en el diccionario global sin estado, registrarlo también
      if (capKey && !CITY_COORDS[capKey]) {
        CITY_COORDS[capKey] = point
      }
      if (munKey && !CITY_COORDS[munKey]) {
        CITY_COORDS[munKey] = point
      }
    }
  }

  // Alias equivalentes para Vargas / La Guaira
  for (const [key, point] of Array.from(STATE_PLACE_COORDS.entries())) {
    if (key.startsWith('vargas::')) {
      STATE_PLACE_COORDS.set(key.replace(/^vargas::/, 'la guaira::'), point)
    }
  }
})()

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isValid(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180 &&
    point.lat !== 0 &&
    point.lng !== 0
  )
}

function resolveCityOrMunicipioPoint(input: ListingGeoInput): { point: GeoPoint; key: string } | null {
  const stateKey = input.estado ? normalizePlace(String(input.estado)) : ''
  const placeCandidates = [input.ciudad, input.municipio, input.zona]

  // 1) Búsqueda exacta dentro del estado seleccionado (evita homónimos entre estados)
  if (stateKey) {
    for (const raw of placeCandidates) {
      if (!raw) continue
      const placeKey = normalizePlace(String(raw))
      if (!placeKey) continue
      const scoped = STATE_PLACE_COORDS.get(`${stateKey}::${placeKey}`)
      if (scoped) {
        return { point: scoped, key: `${stateKey}:${placeKey}` }
      }
      // Si el texto viene como "Capital (Municipio)", probar también las partes por separado
      const parenMatch = String(raw).match(/^([^(]+)\(([^)]+)\)/)
      if (parenMatch) {
        const partA = normalizePlace(parenMatch[1])
        const partB = normalizePlace(parenMatch[2])
        const scopedA = partA ? STATE_PLACE_COORDS.get(`${stateKey}::${partA}`) : undefined
        if (scopedA) return { point: scopedA, key: `${stateKey}:${partA}` }
        const scopedB = partB ? STATE_PLACE_COORDS.get(`${stateKey}::${partB}`) : undefined
        if (scopedB) return { point: scopedB, key: `${stateKey}:${partB}` }
      }
    }
  }

  // 2) Búsqueda por nombre de ciudad/zona cuando no se especificó estado o es una urbanización conocida
  for (const raw of placeCandidates) {
    if (!raw) continue
    const placeKey = normalizePlace(String(raw))
    if (!placeKey) continue
    if (CITY_COORDS[placeKey]) {
      return { point: CITY_COORDS[placeKey], key: `${stateKey || 've'}:${placeKey}` }
    }
  }

  return null
}

/**
 * Devuelve el punto del inmueble: primero las coordenadas exactas y, si no
 * existen, el centro de su ciudad/municipio (acotado a su estado) o el estado.
 */
export function resolveListingGeo(input: ListingGeoInput): ResolvedGeo {
  const lat = toNumber(input.latitud)
  const lng = toNumber(input.longitud)

  if (lat !== null && lng !== null) {
    const exact = { lat, lng }
    if (isValid(exact)) return { point: exact, approximate: false }
  }

  const cityMatch = resolveCityOrMunicipioPoint(input)
  if (cityMatch) {
    return { point: cityMatch.point, approximate: true }
  }

  if (input.estado) {
    const stateKey = normalizePlace(String(input.estado))
    if (STATE_COORDS[stateKey]) return { point: STATE_COORDS[stateKey], approximate: true }
  }

  return { point: null, approximate: true }
}

/**
 * Calcula el encuadre y nivel de zoom óptimos del mapa según qué tan específica
 * sea la ubicación seleccionada (país -> estado -> ciudad/municipio -> pin exacto).
 */
export function resolveLocationViewport(input: ListingGeoInput): LocationViewport {
  const lat = toNumber(input.latitud)
  const lng = toNumber(input.longitud)

  if (lat !== null && lng !== null) {
    const exact = { lat, lng }
    if (isValid(exact)) {
      return {
        center: exact,
        zoom: VE_PIN_ZOOM,
        level: 'pin',
        key: `pin:${exact.lat.toFixed(5)},${exact.lng.toFixed(5)}`,
      }
    }
  }

  const cityMatch = resolveCityOrMunicipioPoint(input)
  if (cityMatch) {
    return {
      center: cityMatch.point,
      zoom: VE_CITY_ZOOM,
      level: 'city',
      key: `city:${cityMatch.key}`,
    }
  }

  if (input.estado) {
    const stateKey = normalizePlace(String(input.estado))
    if (STATE_COORDS[stateKey]) {
      return {
        center: STATE_COORDS[stateKey],
        zoom: VE_STATE_ZOOM,
        level: 'state',
        key: `state:${stateKey}`,
      }
    }
  }

  return {
    center: VE_CENTER,
    zoom: VE_ZOOM,
    level: 'country',
    key: 'country:ve',
  }
}

/**
 * Desplaza ligeramente los puntos aproximados para que varias fichas de la
 * misma ciudad no queden superpuestas. Determinista: el mismo inmueble cae
 * siempre en el mismo sitio.
 */
export function jitterPoint(point: GeoPoint, seed: string, radius = 0.016): GeoPoint {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000
  }
  const angle = ((hash % 360) * Math.PI) / 180
  const magnitude = radius * (0.35 + ((hash % 100) / 100) * 0.65)
  return {
    lat: point.lat + Math.sin(angle) * magnitude,
    lng: point.lng + Math.cos(angle) * magnitude,
  }
}
