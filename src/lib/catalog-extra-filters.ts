/** URL names and catalogue labels are stable across languages. */
export const CATALOG_AMENITIES = [
  { key: 'gas', name: 'Gas doméstico' },
  { key: 'aire', name: 'Aire acondicionado' },
  { key: 'ventiladores', name: 'Ventiladores' },
  { key: 'generador', name: 'Generador eléctrico' },
  { key: 'piscina', name: 'Piscina' },
  { key: 'ascensor', name: 'Ascensor' },
  { key: 'jardin', name: 'Jardín' },
  { key: 'balcon', name: 'Balcón o terraza' },
  { key: 'cisterna', name: 'Cisterna' },
  { key: 'seguridad', name: 'Seguridad 24 horas' },
  { key: 'agua24', name: 'Agua 24 horas' },
  { key: 'electricidad110', name: 'Electricidad 110V' },
  { key: 'electricidad220', name: 'Electricidad 220V' },
  { key: 'amueblado', name: 'Amueblado' },
] as const

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
