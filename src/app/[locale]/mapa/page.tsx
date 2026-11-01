import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { supabase } from '@/lib/supabase'
import MapaClient from './MapaClient'

const SITE_URL = 'https://venezuela-inmuebles.online'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'map' })
  const english = locale === 'en'

  return {
    title: `${t('title')} | Venezuela Inmuebles`,
    description: english
      ? 'Explore properties for sale and rent in Venezuela on a map. Filter by city and area with OpenStreetMap.'
      : 'Explora inmuebles en venta y alquiler en Venezuela sobre un mapa. Filtra por ciudad y zona con OpenStreetMap.',
    alternates: {
      canonical: `${SITE_URL}${english ? '/en' : ''}/mapa`,
      languages: {
        'es-VE': `${SITE_URL}/mapa`,
        'en-US': `${SITE_URL}/en/mapa`,
      },
    },
  }
}

export type MapPageRecord = {
  id: string
  slug: string | null
  titulo: string
  precio: number
  moneda: string
  main_image_url: string | null
  ciudad: string | null
  estado: string | null
  municipio: string | null
  zona: string | null
  latitud: number | null
  longitud: number | null
  operacion_nombre: string | null
  operacion_slug: string | null
  tipo_nombre: string | null
  tipo_slug: string | null
  destacado: boolean
  habitaciones: number | null
  banos: number | null
  area_total: number | null
}

const MAP_COLUMNS =
  'id, slug, titulo, precio, moneda, main_image_url, ciudad, estado, municipio, zona, latitud, longitud, operacion_nombre, operacion_slug, tipo_nombre, tipo_slug, destacado, habitaciones, banos, area_total'

async function getMapProducts(): Promise<MapPageRecord[]> {
  try {
    const { data, error } = await supabase
      .from('vw_propiedades_publicas')
      .select(MAP_COLUMNS)
      .eq('activo', true)
      .order('destacado', { ascending: false })
      .order('creado_en', { ascending: false })
      .limit(300)

    if (error || !data) return []

    return data.map((row: any) => ({
      id: String(row.id),
      slug: row.slug || null,
      titulo: row.titulo || '',
      precio: Number(row.precio) || 0,
      moneda: row.moneda || 'USD',
      main_image_url: row.main_image_url || null,
      ciudad: row.ciudad || null,
      estado: row.estado || null,
      municipio: row.municipio || null,
      zona: row.zona || null,
      latitud: row.latitud == null ? null : Number(row.latitud),
      longitud: row.longitud == null ? null : Number(row.longitud),
      operacion_nombre: row.operacion_nombre || null,
      operacion_slug: row.operacion_slug || null,
      tipo_nombre: row.tipo_nombre || null,
      tipo_slug: row.tipo_slug || null,
      destacado: Boolean(row.destacado),
      habitaciones: row.habitaciones == null ? null : Number(row.habitaciones),
      banos: row.banos == null ? null : Number(row.banos),
      area_total: row.area_total == null ? null : Number(row.area_total),
    }))
  } catch {
    return []
  }
}

export default async function MapaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const products = await getMapProducts()

  return (
    <Suspense>
      <MapaClient products={products} locale={locale} />
    </Suspense>
  )
}

export const revalidate = 600
