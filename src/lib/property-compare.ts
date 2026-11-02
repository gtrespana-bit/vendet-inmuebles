/**
 * Utilidades isomórficas para el Comparador de Inmuebles lado a lado (`/comparar`).
 */

import { calculatePricePerM2 } from './urbanizaciones.ts'

export const MAX_COMPARE_ITEMS = 4
export const COMPARE_STORAGE_KEY = 'vi_compare_properties_v1'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ComparePreviewItem {
  id: string
  slug?: string | null
  title: string
  price?: number | null
  image?: string | null
  location?: string | null
  operation?: string | null
}

export interface ComparableProperty {
  id: string
  slug?: string | null
  title: string
  price: number
  currency: string
  operation: 'venta' | 'alquiler'
  propertyType?: string | null
  state?: string | null
  city?: string | null
  zone?: string | null
  image?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  parking?: number | null
  builtArea?: number | null
  totalArea?: number | null
  condition?: string | null
  ageYears?: number | null
  hasVideo: boolean
  hasTour: boolean
  hasFloorPlan: boolean
  verifiedSeller: boolean
  amenities: string[]
}

export interface ComparisonHighlights {
  lowestPriceId: string | null
  lowestPricePerM2Id: string | null
  largestAreaId: string | null
  mostBedroomsId: string | null
  allAmenities: string[]
}

export function isValidCompareId(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id.trim())
}

export function parseCompareIds(raw: string | string[] | null | undefined): string[] {
  if (!raw) return []
  const chunks = Array.isArray(raw) ? raw.join(',').split(',') : String(raw).split(',')
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of chunks) {
    const clean = item.trim().toLowerCase()
    if (isValidCompareId(clean) && !seen.has(clean)) {
      seen.add(clean)
      out.push(clean)
      if (out.length >= MAX_COMPARE_ITEMS) break
    }
  }
  return out
}

export function toggleCompareItem(
  current: ComparePreviewItem[],
  candidate: ComparePreviewItem,
): { next: ComparePreviewItem[]; action: 'added' | 'removed' | 'limit_reached' } {
  const id = candidate.id.trim().toLowerCase()
  const exists = current.some((item) => item.id.toLowerCase() === id)
  if (exists) {
    return {
      next: current.filter((item) => item.id.toLowerCase() !== id),
      action: 'removed',
    }
  }
  if (current.length >= MAX_COMPARE_ITEMS) {
    return { next: current, action: 'limit_reached' }
  }
  return {
    next: [...current, { ...candidate, id }],
    action: 'added',
  }
}

export function computeComparisonHighlights(items: ComparableProperty[]): ComparisonHighlights {
  if (items.length < 2) {
    const singleAmenities = Array.from(new Set(items.flatMap((i) => i.amenities))).sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
    return {
      lowestPriceId: null,
      lowestPricePerM2Id: null,
      largestAreaId: null,
      mostBedroomsId: null,
      allAmenities: singleAmenities,
    }
  }

  let lowestPrice = Infinity
  let lowestPriceId: string | null = null

  let lowestPpm2 = Infinity
  let lowestPricePerM2Id: string | null = null

  let largestArea = 0
  let largestAreaId: string | null = null

  let mostBedrooms = 0
  let mostBedroomsId: string | null = null

  const amenitySet = new Set<string>()

  for (const item of items) {
    for (const am of item.amenities) {
      if (am && am.trim()) amenitySet.add(am.trim())
    }

    if (item.price > 0 && item.price < lowestPrice) {
      lowestPrice = item.price
      lowestPriceId = item.id
    }

    if (item.operation === 'venta') {
      const ppm2 = calculatePricePerM2(item.price, item.builtArea, item.totalArea)
      if (ppm2 !== null && ppm2 > 0 && ppm2 < lowestPpm2) {
        lowestPpm2 = ppm2
        lowestPricePerM2Id = item.id
      }
    }

    const area = Number(item.builtArea || item.totalArea || 0)
    if (area > largestArea) {
      largestArea = area
      largestAreaId = item.id
    }

    const beds = Number(item.bedrooms || 0)
    if (beds > mostBedrooms) {
      mostBedrooms = beds
      mostBedroomsId = item.id
    }
  }

  return {
    lowestPriceId,
    lowestPricePerM2Id,
    largestAreaId,
    mostBedroomsId,
    allAmenities: Array.from(amenitySet).sort((a, b) => a.localeCompare(b, 'es')),
  }
}
