/**
 * Geodatos abiertos de Venezuela (centroides de estados y ciudades).
 *
 * Se usan como respaldo cuando un inmueble no tiene `latitud`/`longitud`
 * exactas: el marcador se dibuja en el centro de su ciudad y la interfaz lo
 * señala como "ubicación aproximada". No requiere ningún servicio de pago ni
 * clave de API, y los datos se mantienen en el bundle del cliente.
 */

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

/** Centro geográfico de Venezuela (para el encuadre inicial). */
export const VE_CENTER: GeoPoint = { lat: 8.6, lng: -66.2 }
export const VE_ZOOM = 6

export function normalizePlace(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Capitales y ciudades principales (centro aproximado del casco urbano). */
const CITY_COORDS: Record<string, GeoPoint> = {
  // Distrito Capital / Miranda
  caracas: { lat: 10.4806, lng: -66.9036 },
  'distrito capital': { lat: 10.4806, lng: -66.9036 },
  chacao: { lat: 10.4961, lng: -66.8517 },
  baruta: { lat: 10.4335, lng: -66.8753 },
  'el hatillo': { lat: 10.4244, lng: -66.8244 },
  petare: { lat: 10.4779, lng: -66.8092 },
  'los chorros': { lat: 10.4952, lng: -66.8237 },
  'los teques': { lat: 10.3445, lng: -67.0433 },
  guarenas: { lat: 10.4700, lng: -66.5400 },
  guatire: { lat: 10.4764, lng: -66.5428 },
  // La Guaira
  'la guaira': { lat: 10.5990, lng: -66.9346 },
  'catia la mar': { lat: 10.5953, lng: -67.0297 },

  // Centro / occidente
  valencia: { lat: 10.1620, lng: -68.0077 },
  maracay: { lat: 10.2469, lng: -67.5958 },
  barquisimeto: { lat: 10.0678, lng: -69.3475 },
  'san felipe': { lat: 10.3399, lng: -68.7425 },
  'san carlos': { lat: 9.6612, lng: -68.5827 },
  guanare: { lat: 9.0436, lng: -69.7486 },
  'puerto cabello': { lat: 10.4731, lng: -68.0125 },
  coro: { lat: 11.4045, lng: -69.6734 },
  'punto fijo': { lat: 11.7167, lng: -70.1833 },
  barinas: { lat: 8.6226, lng: -70.2075 },
  merida: { lat: 8.5897, lng: -71.1561 },
  'el vigia': { lat: 8.6136, lng: -71.6575 },
  trujillo: { lat: 9.3667, lng: -70.4333 },
  'san cristobal': { lat: 7.7669, lng: -72.2250 },
  'la grita': { lat: 7.9833, lng: -71.8833 },
  tachira: { lat: 7.7669, lng: -72.2250 },

  // Oriente / sur
  maracaibo: { lat: 10.6427, lng: -71.6125 },
  cabimas: { lat: 10.3991, lng: -71.4456 },
  'ciudad ojeda': { lat: 10.2000, lng: -71.3167 },
  barcelona: { lat: 10.1333, lng: -64.6833 },
  'puerto la cruz': { lat: 10.2167, lng: -64.6333 },
  lecheria: { lat: 10.1833, lng: -64.6833 },
  'el tigre': { lat: 8.8833, lng: -64.2500 },
  cumana: { lat: 10.4639, lng: -64.1786 },
  maturin: { lat: 9.7457, lng: -63.1837 },
  'ciudad bolivar': { lat: 8.1167, lng: -63.5500 },
  'puerto ordaz': { lat: 8.3000, lng: -62.7167 },
  'ciudad guayana': { lat: 8.3512, lng: -62.6411 },
  porlamar: { lat: 10.9577, lng: -63.8697 },
  pampatar: { lat: 11.0000, lng: -63.8000 },
  'la asuncion': { lat: 11.0333, lng: -63.8628 },
  'juan griego': { lat: 11.0333, lng: -63.9500 },
  'san fernando de apure': { lat: 7.8878, lng: -67.4723 },
  'san juan de los morros': { lat: 9.9115, lng: -67.3587 },
  'valle de la pascua': { lat: 9.2167, lng: -65.7333 },
  tucupita: { lat: 9.0581, lng: -62.0500 },
  'puerto ayacucho': { lat: 5.6631, lng: -67.6236 },
  'santa elena de uairen': { lat: 4.6000, lng: -61.1167 },
  'los guayos': { lat: 10.1833, lng: -67.9333 },
  guacara: { lat: 10.2333, lng: -67.8667 },
  cagua: { lat: 10.1833, lng: -67.4500 },
  'la victoria': { lat: 10.2333, lng: -67.3333 },
  turmero: { lat: 10.2333, lng: -67.4667 },
  'acaragua': { lat: 10.2500, lng: -69.1833 },
  yaritagua: { lat: 10.0833, lng: -69.1500 },
  'santa teresa del tuy': { lat: 10.2333, lng: -66.6667 },
  cua: { lat: 10.1667, lng: -66.8833 },
  charallave: { lat: 10.2333, lng: -66.8667 },
  'san antonio de los altos': { lat: 10.3667, lng: -66.9500 },
}

/** Centroides de los 24 estados (respaldo de respaldo). */
const STATE_COORDS: Record<string, GeoPoint> = {
  'distrito capital': { lat: 10.4806, lng: -66.9036 },
  amazonas: { lat: 5.6631, lng: -67.6236 },
  anzoategui: { lat: 10.1333, lng: -64.6833 },
  apure: { lat: 7.8878, lng: -67.4723 },
  aragua: { lat: 10.2469, lng: -67.5958 },
  barinas: { lat: 8.6226, lng: -70.2075 },
  bolivar: { lat: 8.1167, lng: -63.5500 },
  carabobo: { lat: 10.1620, lng: -68.0077 },
  cojedes: { lat: 9.6612, lng: -68.5827 },
  'delta amacuro': { lat: 9.0581, lng: -62.0500 },
  falcon: { lat: 11.4045, lng: -69.6734 },
  guarico: { lat: 9.9115, lng: -67.3587 },
  lara: { lat: 10.0678, lng: -69.3475 },
  merida: { lat: 8.5897, lng: -71.1561 },
  miranda: { lat: 10.3445, lng: -67.0433 },
  monagas: { lat: 9.7457, lng: -63.1837 },
  'nueva esparta': { lat: 11.0333, lng: -63.8628 },
  portuguesa: { lat: 9.0436, lng: -69.7486 },
  sucre: { lat: 10.4639, lng: -64.1786 },
  tachira: { lat: 7.7669, lng: -72.2250 },
  trujillo: { lat: 9.3667, lng: -70.4333 },
  vargas: { lat: 10.5990, lng: -66.9346 },
  'la guaira': { lat: 10.5990, lng: -66.9346 },
  yaracuy: { lat: 10.3399, lng: -68.7425 },
  zulia: { lat: 10.6427, lng: -71.6125 },
}

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

/**
 * Devuelve el punto del inmueble: primero las coordenadas exactas y, si no
 * existen, el centro de su ciudad/estado (marcado como aproximado).
 */
export function resolveListingGeo(input: ListingGeoInput): ResolvedGeo {
  const lat = toNumber(input.latitud)
  const lng = toNumber(input.longitud)

  if (lat !== null && lng !== null) {
    const exact = { lat, lng }
    if (isValid(exact)) return { point: exact, approximate: false }
  }

  const candidates = [input.ciudad, input.municipio, input.zona, input.estado]
  for (const candidate of candidates) {
    if (!candidate) continue
    const key = normalizePlace(String(candidate))
    if (CITY_COORDS[key]) return { point: CITY_COORDS[key], approximate: true }
  }

  if (input.estado) {
    const stateKey = normalizePlace(String(input.estado))
    if (STATE_COORDS[stateKey]) return { point: STATE_COORDS[stateKey], approximate: true }
  }

  return { point: null, approximate: true }
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
