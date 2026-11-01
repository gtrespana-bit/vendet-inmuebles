/**
 * Ordenamiento canónico del catálogo inmobiliario (servidor + cliente).
 *
 * Compatible con `node --experimental-strip-types` (sin imports `@/`).
 */

import { calculatePricePerM2 } from './urbanizaciones.ts'

export const CATALOG_SORT_KEYS = [
  'relevancia',
  'recientes',
  'precio_asc',
  'precio_desc',
  'precio_m2_asc',
  'area_desc',
] as const

export type CatalogSortKey = (typeof CATALOG_SORT_KEYS)[number]

export function normalizeCatalogSort(raw?: string | null): CatalogSortKey {
  if (!raw) return 'relevancia'
  const clean = raw.trim().toLowerCase()
  return (CATALOG_SORT_KEYS as readonly string[]).includes(clean)
    ? (clean as CatalogSortKey)
    : 'relevancia'
}

function numericPriceOf(item: Record<string, any>): number {
  const n = Number(item.precio_usd ?? item.precio ?? item.price ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function numericAreaOf(item: Record<string, any>): number {
  const built = Number(item.area_construida ?? 0)
  if (Number.isFinite(built) && built > 0) return built
  const total = Number(item.area_total ?? item.area_size ?? item.area ?? 0)
  return Number.isFinite(total) && total > 0 ? total : 0
}

function timestampOf(value: unknown): number {
  if (typeof value !== 'string' || !value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

function isActivelyFeatured(item: Record<string, any>, nowMs: number): boolean {
  if (typeof item._isFeatured === 'boolean') return item._isFeatured
  if (!item.destacado) return false
  if (!item.destacado_hasta) return true
  const untilMs = timestampOf(item.destacado_hasta)
  return untilMs > nowMs
}

/**
 * Aplica el `ORDER BY` inicial en la consulta de Supabase para que la ventana traída
 * ya venga alineada con el criterio elegido antes del refinamiento final en memoria.
 */
export function applyCatalogServerOrder<
  T extends {
    order: (column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => T
  }
>(query: T, sortKey: CatalogSortKey): T {
  switch (sortKey) {
    case 'precio_asc':
      return query
        .order('precio', { ascending: true, nullsFirst: false })
        .order('creado_en', { ascending: false })
    case 'precio_desc':
      return query
        .order('precio', { ascending: false, nullsFirst: false })
        .order('creado_en', { ascending: false })
    case 'area_desc':
      return query
        .order('area_total', { ascending: false, nullsFirst: false })
        .order('creado_en', { ascending: false })
    case 'recientes':
      return query.order('creado_en', { ascending: false })
    case 'precio_m2_asc':
    case 'relevancia':
    default:
      return query
        .order('destacado', { ascending: false })
        .order('creado_en', { ascending: false })
  }
}

/**
 * Ordena de forma determinista y sin mutar el arreglo original.
 * - En `precio_asc` y `precio_m2_asc`, los inmuebles sin precio o sin m² van siempre al final.
 */
export function sortCatalogProperties<T extends Record<string, any>>(
  items: readonly T[],
  sortKey: CatalogSortKey,
  nowMs: number = Date.now()
): T[] {
  const copy = [...items]

  copy.sort((a, b) => {
    if (sortKey === 'relevancia') {
      const featA = isActivelyFeatured(a, nowMs) ? 1 : 0
      const featB = isActivelyFeatured(b, nowMs) ? 1 : 0
      if (featA !== featB) return featB - featA

      const boostA = timestampOf(a.boosteado_en)
      const boostB = timestampOf(b.boosteado_en)
      if (boostA !== boostB) return boostB - boostA

      return timestampOf(b.creado_en) - timestampOf(a.creado_en)
    }

    if (sortKey === 'recientes') {
      return timestampOf(b.creado_en) - timestampOf(a.creado_en)
    }

    if (sortKey === 'precio_asc') {
      const pA = numericPriceOf(a)
      const pB = numericPriceOf(b)
      if (pA <= 0 && pB <= 0) return timestampOf(b.creado_en) - timestampOf(a.creado_en)
      if (pA <= 0) return 1
      if (pB <= 0) return -1
      if (pA !== pB) return pA - pB
      return timestampOf(b.creado_en) - timestampOf(a.creado_en)
    }

    if (sortKey === 'precio_desc') {
      const pA = numericPriceOf(a)
      const pB = numericPriceOf(b)
      if (pA !== pB) return pB - pA
      return timestampOf(b.creado_en) - timestampOf(a.creado_en)
    }

    if (sortKey === 'precio_m2_asc') {
      const m2A = calculatePricePerM2(numericPriceOf(a), a.area_construida, a.area_total ?? a.area_size)
      const m2B = calculatePricePerM2(numericPriceOf(b), b.area_construida, b.area_total ?? b.area_size)
      if (m2A == null && m2B == null) return timestampOf(b.creado_en) - timestampOf(a.creado_en)
      if (m2A == null) return 1
      if (m2B == null) return -1
      if (m2A !== m2B) return m2A - m2B
      return timestampOf(b.creado_en) - timestampOf(a.creado_en)
    }

    if (sortKey === 'area_desc') {
      const arA = numericAreaOf(a)
      const arB = numericAreaOf(b)
      if (arA !== arB) return arB - arA
      return timestampOf(b.creado_en) - timestampOf(a.creado_en)
    }

    return 0
  })

  return copy
}
