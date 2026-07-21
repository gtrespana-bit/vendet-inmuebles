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
      titulo: `Clasificados en ${municipio.capital}, ${estado} | VendeT.online`,
      descripcion: `Compra y vende en ${municipio.capital}, ${estado}. Miles de anuncios clasificados: carros, casas, celulares, empleo y más. Publica gratis en VendeT.online.`,
      keywords: [
        `clasificados ${municipio.capital}`,
        `compra venta ${municipio.capital}`,
        `marketplace ${estado}`,
        `anuncios ${municipio.capital}`,
        `vender en ${municipio.capital}`,
        `productos usados ${municipio.capital}`,
        `${municipio.capital} ${estado}`
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
    city: ciudad.slug
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
