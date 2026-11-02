/**
 * Utilidades isomórficas (seguras en cliente y servidor, sin dependencias de Node)
 * para normalizar búsquedas guardadas, generar su huella canónica, construir
 * etiquetas legibles ES/EN y evaluar coincidencias contra inmuebles publicados.
 */

export interface SavedSearchFilters {
  operacion?: string
  categoria?: string
  subcategoria?: string
  estado?: string
  ciudad?: string
  zona?: string
  precioMin?: number | null
  precioMax?: number | null
  habitaciones?: number | null
  banos?: number | null
  estacionamientos?: number | null
  areaMin?: number | null
  areaMax?: number | null
  condicion?: string
  amenidades?: string[]
  q?: string
}

export type SavedSearchFrequency = 'inmediata' | 'diaria' | 'pausada'

export const MAX_SAVED_SEARCHES_PER_USER = 15

const FILTER_PARAM_KEYS = [
  'operacion',
  'categoria',
  'subcategoria',
  'estado',
  'ciudad',
  'zona',
  'precioMin',
  'precioMax',
  'habitaciones',
  'banos',
  'estacionamientos',
  'areaMin',
  'areaMax',
  'condicion',
  'amenidades',
  'q',
] as const

function foldText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function cleanPositiveNum(raw: unknown, max = 1_000_000_000): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(Math.round(n * 100) / 100, max)
}

function cleanShortText(raw: unknown, maxLen = 100): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen)
  return trimmed || undefined
}

export function normalizeSavedSearchFilters(
  input: Record<string, unknown> | URLSearchParams,
): SavedSearchFilters {
  const get = (key: string): unknown => {
    if (input instanceof URLSearchParams) return input.get(key) ?? undefined
    return input[key]
  }

  const rawOp = cleanShortText(get('operacion'), 30)?.toLowerCase()
  const operacion =
    rawOp === 'venta' || rawOp === 'alquiler'
      ? rawOp
      : rawOp === 'sale'
        ? 'venta'
        : rawOp === 'rent'
          ? 'alquiler'
          : undefined

  const amenidadesRaw = get('amenidades')
  const amenidadesList = Array.isArray(amenidadesRaw)
    ? amenidadesRaw.map((x) => cleanShortText(x, 60)).filter((x): x is string => Boolean(x))
    : typeof amenidadesRaw === 'string'
      ? amenidadesRaw
          .split(',')
          .map((x) => cleanShortText(x, 60))
          .filter((x): x is string => Boolean(x))
      : []

  const uniqueAmenidades = Array.from(new Set(amenidadesList.map((a) => a.toLowerCase()))).sort()

  const precioMin = cleanPositiveNum(get('precioMin'), 100_000_000)
  const precioMax = cleanPositiveNum(get('precioMax'), 100_000_000)
  const areaMin = cleanPositiveNum(get('areaMin'), 10_000_000)
  const areaMax = cleanPositiveNum(get('areaMax'), 10_000_000)

  const normalized: SavedSearchFilters = {}
  if (operacion) normalized.operacion = operacion

  const categoria = cleanShortText(get('categoria'), 60)
  if (categoria) normalized.categoria = categoria

  const subcategoria = cleanShortText(get('subcategoria'), 60)
  if (subcategoria) normalized.subcategoria = subcategoria

  const estado = cleanShortText(get('estado'), 80)
  if (estado) normalized.estado = estado

  const ciudad = cleanShortText(get('ciudad'), 80)
  if (ciudad) normalized.ciudad = ciudad

  const zona = cleanShortText(get('zona'), 100)
  if (zona) normalized.zona = zona

  if (precioMin !== null) normalized.precioMin = precioMin
  if (precioMax !== null && (precioMin === null || precioMax >= precioMin)) {
    normalized.precioMax = precioMax
  }

  const habitaciones = cleanPositiveNum(get('habitaciones'), 50)
  if (habitaciones !== null) normalized.habitaciones = Math.floor(habitaciones)

  const banos = cleanPositiveNum(get('banos'), 50)
  if (banos !== null) normalized.banos = Math.floor(banos)

  const estacionamientos = cleanPositiveNum(get('estacionamientos'), 50)
  if (estacionamientos !== null) normalized.estacionamientos = Math.floor(estacionamientos)

  if (areaMin !== null) normalized.areaMin = areaMin
  if (areaMax !== null && (areaMin === null || areaMax >= areaMin)) {
    normalized.areaMax = areaMax
  }

  const condicion = cleanShortText(get('condicion'), 50)
  if (condicion) normalized.condicion = condicion

  if (uniqueAmenidades.length > 0) normalized.amenidades = uniqueAmenidades

  const q = cleanShortText(get('q'), 100)
  if (q) normalized.q = q

  return normalized
}

export function hasMeaningfulSavedSearchFilters(filters: SavedSearchFilters): boolean {
  return FILTER_PARAM_KEYS.some((key) => {
    const val = filters[key]
    if (Array.isArray(val)) return val.length > 0
    return val !== undefined && val !== null && val !== ''
  })
}

export function buildSavedSearchQueryString(filters: SavedSearchFilters): string {
  const params = new URLSearchParams()
  if (filters.operacion) params.set('operacion', filters.operacion)
  if (filters.categoria) params.set('categoria', filters.categoria)
  if (filters.subcategoria) params.set('subcategoria', filters.subcategoria)
  if (filters.estado) params.set('estado', filters.estado)
  if (filters.ciudad) params.set('ciudad', filters.ciudad)
  if (filters.zona) params.set('zona', filters.zona)
  if (filters.precioMin != null) params.set('precioMin', String(filters.precioMin))
  if (filters.precioMax != null) params.set('precioMax', String(filters.precioMax))
  if (filters.habitaciones != null) params.set('habitaciones', String(filters.habitaciones))
  if (filters.banos != null) params.set('banos', String(filters.banos))
  if (filters.estacionamientos != null) params.set('estacionamientos', String(filters.estacionamientos))
  if (filters.areaMin != null) params.set('areaMin', String(filters.areaMin))
  if (filters.areaMax != null) params.set('areaMax', String(filters.areaMax))
  if (filters.condicion) params.set('condicion', filters.condicion)
  if (filters.amenidades && filters.amenidades.length > 0) {
    params.set('amenidades', filters.amenidades.join(','))
  }
  if (filters.q) params.set('q', filters.q)
  return params.toString()
}

/**
 * Hash FNV-1a doble de 64 bits (16 hex) determinista e isomórfico.
 */
export function computeSavedSearchFingerprint(filters: SavedSearchFilters): string {
  const canonical = JSON.stringify({
    op: foldText(filters.operacion),
    cat: foldText(filters.categoria),
    sub: foldText(filters.subcategoria),
    est: foldText(filters.estado),
    ciu: foldText(filters.ciudad),
    zon: foldText(filters.zona),
    pMin: filters.precioMin ?? null,
    pMax: filters.precioMax ?? null,
    hab: filters.habitaciones ?? null,
    ban: filters.banos ?? null,
    estac: filters.estacionamientos ?? null,
    aMin: filters.areaMin ?? null,
    aMax: filters.areaMax ?? null,
    cond: foldText(filters.condicion),
    amen: (filters.amenidades ?? []).map(foldText).sort(),
    q: foldText(filters.q),
  })

  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i)
    h1 ^= ch
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= ch ^ (i & 0xff)
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return `srch_${hex1}${hex2}`
}

export function buildSavedSearchLabel(
  filters: SavedSearchFilters,
  locale: 'es' | 'en' = 'es',
): string {
  const parts: string[] = []
  const isEn = locale === 'en'

  if (filters.operacion === 'alquiler') parts.push(isEn ? 'Rent' : 'Alquiler')
  else if (filters.operacion === 'venta') parts.push(isEn ? 'Sale' : 'Venta')

  if (filters.subcategoria) parts.push(filters.subcategoria)
  else if (filters.categoria) parts.push(filters.categoria)

  const locParts = [filters.zona, filters.ciudad, !filters.ciudad ? filters.estado : undefined].filter(Boolean)
  if (locParts.length > 0) parts.push(locParts.join(', '))

  const fmtUsd = (n: number) =>
    `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`

  if (filters.precioMin != null && filters.precioMax != null) {
    parts.push(`${fmtUsd(filters.precioMin)} – ${fmtUsd(filters.precioMax)}`)
  } else if (filters.precioMax != null) {
    parts.push(isEn ? `Up to ${fmtUsd(filters.precioMax)}` : `Hasta ${fmtUsd(filters.precioMax)}`)
  } else if (filters.precioMin != null) {
    parts.push(isEn ? `From ${fmtUsd(filters.precioMin)}` : `Desde ${fmtUsd(filters.precioMin)}`)
  }

  if (filters.habitaciones != null) {
    parts.push(`${filters.habitaciones}+ ${isEn ? 'bd' : 'hab.'}`)
  }

  if (filters.q) {
    parts.push(`"${filters.q}"`)
  }

  if (parts.length === 0) {
    return isEn ? 'Saved property alert' : 'Alerta de inmuebles'
  }

  return parts.join(' · ').slice(0, 140)
}

export interface MatchablePropertyRecord {
  id: string
  titulo?: string | null
  descripcion?: string | null
  operacion_slug?: string | null
  operacion_nombre?: string | null
  operation_type?: string | null
  tipo_slug?: string | null
  tipo_nombre?: string | null
  property_type?: string | null
  subcategoria?: string | null
  estado?: string | null
  ciudad?: string | null
  municipio?: string | null
  zona?: string | null
  precio?: number | null
  precio_usd?: number | null
  habitaciones?: number | null
  banos?: number | null
  puestos_estacionamiento?: number | null
  area_construida?: number | null
  area_total?: number | null
  condicion?: string | null
  caracteristicas?: string[] | null
}

/**
 * Comprueba si un inmueble publicado coincide con todos los filtros activos de una búsqueda guardada.
 */
export function matchesSavedSearch(
  property: MatchablePropertyRecord,
  filters: SavedSearchFilters,
): boolean {
  if (filters.operacion) {
    const propOp = foldText(
      property.operacion_slug || property.operation_type || property.operacion_nombre || '',
    )
    const isRent = propOp.includes('alquiler') || propOp.includes('rent')
    if (filters.operacion === 'alquiler' && !isRent) return false
    if (filters.operacion === 'venta' && isRent) return false
  }

  const targetType = foldText(filters.subcategoria || filters.categoria || '')
  if (targetType && targetType !== 'inmuebles') {
    const propType = foldText(
      [
        property.tipo_slug,
        property.tipo_nombre,
        property.property_type,
        property.subcategoria,
      ]
        .filter(Boolean)
        .join(' '),
    )
    const singularTarget = targetType.replace(/s$/, '')
    if (!propType.includes(singularTarget)) return false
  }

  if (filters.estado) {
    const est = foldText(property.estado || '')
    if (!est.includes(foldText(filters.estado))) return false
  }

  if (filters.ciudad) {
    const needle = foldText(filters.ciudad)
    const hay = foldText([property.ciudad, property.municipio, property.zona].filter(Boolean).join(' '))
    if (!hay.includes(needle)) return false
  }

  if (filters.zona) {
    const needle = foldText(filters.zona)
    const hay = foldText(
      [property.zona, property.titulo, property.descripcion, property.ciudad].filter(Boolean).join(' '),
    )
    if (!hay.includes(needle)) return false
  }

  const price = Number(property.precio_usd ?? property.precio ?? 0)
  if (filters.precioMin != null && (!Number.isFinite(price) || price < filters.precioMin)) {
    return false
  }
  if (filters.precioMax != null && (!Number.isFinite(price) || price <= 0 || price > filters.precioMax)) {
    return false
  }

  if (filters.habitaciones != null) {
    const hab = Number(property.habitaciones ?? 0)
    if (!Number.isFinite(hab) || hab < filters.habitaciones) return false
  }

  if (filters.banos != null) {
    const ban = Number(property.banos ?? 0)
    if (!Number.isFinite(ban) || ban < filters.banos) return false
  }

  if (filters.estacionamientos != null) {
    const est = Number(property.puestos_estacionamiento ?? 0)
    if (!Number.isFinite(est) || est < filters.estacionamientos) return false
  }

  const area = Number(property.area_construida || property.area_total || 0)
  if (filters.areaMin != null && (!Number.isFinite(area) || area < filters.areaMin)) {
    return false
  }
  if (filters.areaMax != null && (!Number.isFinite(area) || area <= 0 || area > filters.areaMax)) {
    return false
  }

  if (filters.condicion) {
    if (foldText(property.condicion || '') !== foldText(filters.condicion)) return false
  }

  if (filters.q) {
    const terms = foldText(filters.q).split(/\s+/).filter(Boolean)
    const hay = foldText(
      [
        property.titulo,
        property.descripcion,
        property.zona,
        property.ciudad,
        property.municipio,
        property.estado,
      ]
        .filter(Boolean)
        .join(' '),
    )
    for (const term of terms) {
      if (!hay.includes(term)) return false
    }
  }

  return true
}
