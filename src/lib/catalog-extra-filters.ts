import { AMENITIES } from './amenities.ts'

/**
 * Amenidades filtrables del catálogo. Se derivan del catálogo compartido para
 * que publicar, editar y filtrar hablen siempre del mismo conjunto.
 */
export const CATALOG_AMENITIES = AMENITIES.map(({ key, name }) => ({ key, name }))

export const EXTRA_FILTER_KEYS = ['habitaciones', 'banos', 'estacionamientos', 'areaMin', 'areaMax', 'condicion', 'amenidades'] as const

/** Apply only recognised, valid filters to the database query (before counting/limiting). */
export function applyCatalogExtraFilters<T extends {
  gte: (column: string, value: number) => T
  lte: (column: string, value: number) => T
  eq: (column: string, value: string) => T
  contains: (column: string, value: string[]) => T
}>(query: T, filters: Record<string, string | undefined>): T {
  for (const [key, column, op] of [
    ['habitaciones', 'habitaciones', 'gte'], ['banos', 'banos', 'gte'],
    ['estacionamientos', 'puestos_estacionamiento', 'gte'],
    ['areaMin', 'area_total', 'gte'], ['areaMax', 'area_total', 'lte'],
  ] as const) {
    const raw = filters[key]
    if (raw && Number.isFinite(Number(raw)) && Number(raw) >= 0) query = query[op](column, Number(raw))
  }
  const conditions = ['Nuevo', 'Usado - buen estado', 'Para remodelar', 'nueva', 'como_nueva', 'buen_estado', 'remodelar']
  if (filters.condicion && conditions.includes(filters.condicion)) query = query.eq('condicion', filters.condicion)
  const selected = new Set((filters.amenidades || '').split(','))
  const names = CATALOG_AMENITIES.filter((item) => selected.has(item.key)).map((item) => item.name)
  if (names.length) query = query.contains('caracteristicas', names)
  return query
}
