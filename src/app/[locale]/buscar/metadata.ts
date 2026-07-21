import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams
  const q = (searchParams.q as string) || ''
  const categoria = (searchParams.categoria as string) || ''
  const ciudad = (searchParams.ciudad as string) || ''
  const estado = (searchParams.estado as string) || ''
  
  let title = 'Buscar productos — VendeT.online Venezuela'
  let description = 'Busca y encuentra los mejores clasificados en Venezuela. Compra y vende productos nuevos y usados.'
  
  if (q) {
    title = `${q} en Venezuela — Clasificados VendeT.online`
    description = `Resultados de búsqueda para "${q}". Encuentra los mejores productos y clasificados en Venezuela.`
  } else if (categoria) {
    const categoriaNombre = categoria.charAt(0).toUpperCase() + categoria.slice(1)
    title = `${categoriaNombre} en Venezuela — Clasificados VendeT.online`
    description = `Explora ${categoriaNombre.toLowerCase()} en venta. Los mejores clasificados de ${categoriaNombre.toLowerCase()} en Venezuela.`
  } else if (ciudad || estado) {
    const ubicacion = ciudad || estado
    const ubicacionCapitalizada = ubicacion.charAt(0).toUpperCase() + ubicacion.slice(1)
    title = `Clasificados en ${ubicacionCapitalizada}, Venezuela — VendeT.online`
    description = `Compra y vende en ${ubicacionCapitalizada}. Encuentra los mejores clasificados y productos en ${ubicacionCapitalizada}, Venezuela.`
  }
  
  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
  }
}
