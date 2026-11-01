// Datos SEO optimizados para ciudades de Venezuela
// Genera metadata única para cada ciudad sin slugs duplicados

import { MUNICIPIOS_POR_ESTADO, ESTADOS } from './ubicaciones.ts'

export interface CiudadSEO {
  slug: string
  nombre: string
  estado: string
  descripcion: string
  keywords: string[]
  titulo: string
}

export function slugifySeoSegment(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Priorizamos las principales ciudades inmobiliarias cuando un nombre de capital
// se repite en otro municipio menor del país, evitando slugs duplicados.
const PREFERRED_STATE_BY_SLUG: Record<string, string> = {
  caracas: 'Distrito Capital',
  valencia: 'Carabobo',
  'san-diego': 'Carabobo',
  barcelona: 'Anzoátegui',
  merida: 'Mérida',
  miranda: 'Carabobo',
}

const rawCities: CiudadSEO[] = []

ESTADOS.forEach((estado) => {
  const municipios = MUNICIPIOS_POR_ESTADO[estado] || []
  municipios.forEach((municipio) => {
    const slug = slugifySeoSegment(municipio.capital)
    if (!slug) return

    rawCities.push({
      slug,
      nombre: municipio.capital,
      estado,
      titulo: `Inmuebles en ${municipio.capital}, ${estado} | Venezuela Inmuebles`,
      descripcion: `Encuentra casas, apartamentos, terrenos y otros inmuebles en venta o alquiler en ${municipio.capital}, ${estado}.`,
      keywords: [
        `inmuebles en ${municipio.capital}`,
        `casas en venta ${municipio.capital} ${estado}`,
        `apartamentos en venta ${municipio.capital}`,
        `apartamentos en alquiler ${municipio.capital}`,
        `terrenos en venta ${municipio.capital} ${estado}`,
        `locales comerciales ${municipio.capital}`,
        `bienes raices ${municipio.capital} ${estado}`,
        `propiedades ${municipio.capital} ${estado} venezuela`,
        `inmobiliaria ${municipio.capital}`,
      ],
    })
  })
})

const dedupedBySlug = new Map<string, CiudadSEO>()
for (const city of rawCities) {
  const existing = dedupedBySlug.get(city.slug)
  if (!existing) {
    dedupedBySlug.set(city.slug, city)
    continue
  }
  if (PREFERRED_STATE_BY_SLUG[city.slug] === city.estado) {
    dedupedBySlug.set(city.slug, city)
  }
}

export const CIUDADES_SEO: CiudadSEO[] = Array.from(dedupedBySlug.values())

export function getCiudadBySlug(slug: string): CiudadSEO | undefined {
  return dedupedBySlug.get(slug.toLowerCase())
}

export function getCiudadesPorEstado(estado: string): CiudadSEO[] {
  return CIUDADES_SEO.filter((c) => c.estado === estado)
}

export function generateCityParams() {
  return CIUDADES_SEO.map((ciudad) => ({
    ciudad: ciudad.slug,
  }))
}
