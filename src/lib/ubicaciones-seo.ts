// Datos SEO optimizados para ciudades de Venezuela
// Genera metadata única para cada combinación ciudad/categoría

import { MUNICIPIOS_POR_ESTADO, ESTADOS } from './ubicaciones'

export interface CiudadSEO {
  slug: string
  nombre: string
  estado: string
  descripcion: string
  keywords: string[]
  titulo: string
}

// Generar todas las ciudades con su información SEO
export const CIUDADES_SEO: CiudadSEO[] = []

ESTADOS.forEach((estado) => {
  const municipios = MUNICIPIOS_POR_ESTADO[estado] || []
  municipios.forEach((municipio) => {
    const slug = municipio.capital.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    
    CIUDADES_SEO.push({
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
      ]
    })
  })
})

// Helper para buscar ciudad por slug
export function getCiudadBySlug(slug: string): CiudadSEO | undefined {
  return CIUDADES_SEO.find(c => c.slug === slug)
}

// Helper para obtener todas las ciudades de un estado
export function getCiudadesPorEstado(estado: string): CiudadSEO[] {
  return CIUDADES_SEO.filter(c => c.estado === estado)
}

// Helper para generar rutas estáticas
export function generateCityParams() {
  return CIUDADES_SEO.map(ciudad => ({
    ciudad: ciudad.slug
  }))
}

// Helper para categorías populares por ciudad
export const CATEGORIAS_POPULARES = [
  'vehiculos',
  'inmuebles', 
  'electronicos',
  'hogar',
  'moda',
  'deportes',
  'empleo',
  'servicios'
]

// Generar combinaciones ciudad-categoría para SEO programático
export function generateCityCategoryParams(): Array<{ city: string; category: string }> {
  const params: Array<{ city: string; category: string }> = []
  for (const ciudad of CIUDADES_SEO) {
    for (const categoria of CATEGORIAS_POPULARES) {
      params.push({
        city: ciudad.slug,
        category: categoria
      })
    }
  }
  return params
}
