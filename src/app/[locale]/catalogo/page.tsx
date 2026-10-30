import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { supabase } from '@/lib/supabase'
import CatalogoClient from './CatalogoPage'
import type { CatalogPropertyRecord } from '@/types/property'

const SITE_URL = 'https://venezuela-inmuebles.online'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale = params.locale
  const t = await getTranslations({ locale, namespace: 'catalog' })
  const english = locale === 'en'

  return {
    title: `${t('title')} | Venezuela Inmuebles`,
    description: english
      ? 'Explore properties for sale and rent in Venezuela. Filter by listing type, property type and location.'
      : 'Explora inmuebles en venta y alquiler en Venezuela. Filtra por operación, tipo de propiedad y ubicación.',
    alternates: {
      canonical: `${SITE_URL}${english ? '/en' : ''}/catalogo`,
      languages: {
        'es-VE': `${SITE_URL}/catalogo`,
        'en-US': `${SITE_URL}/en/catalogo`,
      },
    },
  }
}

async function getInitialProducts(): Promise<{ products: CatalogPropertyRecord[]; count: number }> {
  try {
    const { data, count, error } = await supabase
      .from('vw_propiedades_publicas')
      .select('id, slug, titulo, precio, moneda, main_image_url, ciudad, estado, creado_en, tipo_nombre, tipo_slug, operacion_nombre, operacion_slug, destacado, destacado_hasta, boosteado_en, vendedor_verificado, habitaciones, banos, area_total', { count: 'exact' })
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(24)

    if (error || !data) return { products: [], count: 0 }

    const products: CatalogPropertyRecord[] = data.map((row: any) => ({
      id: row.id,
      slug: row.slug || null,
      titulo: row.titulo || 'Inmueble',
      title: row.titulo || 'Inmueble',
      precio: Number(row.precio) || 0,
      precio_usd: Number(row.precio) || 0,
      price: Number(row.precio) || 0,
      moneda: row.moneda || 'USD',
      currency: row.moneda || 'USD',
      main_image_url: row.main_image_url || null,
      ciudad: row.ciudad || null,
      city: row.ciudad || null,
      estado: row.estado || null,
      state: row.estado || null,
      creado_en: row.creado_en || null,
      tipo_nombre: row.tipo_nombre || null,
      tipo_slug: row.tipo_slug || null,
      property_type: row.tipo_nombre || row.tipo_slug || null,
      operacion_nombre: row.operacion_nombre || null,
      operacion_slug: row.operacion_slug || null,
      operation_type: row.operacion_slug || row.operacion_nombre || null,
      destacado: Boolean(row.destacado),
      destacado_hasta: row.destacado_hasta || null,
      _isFeatured: Boolean(row.destacado && row.destacado_hasta && new Date(row.destacado_hasta).getTime() > Date.now()),
      boosteado_en: row.boosteado_en || null,
      vendedor_verificado: Boolean(row.vendedor_verificado),
      habitaciones: row.habitaciones == null ? null : Number(row.habitaciones),
      banos: row.banos == null ? null : Number(row.banos),
      area_total: row.area_total == null ? null : Number(row.area_total),
    }))

    return { products, count: count ?? products.length }
  } catch {
    return { products: [], count: 0 }
  }
}

export default async function CatalogoPage() {
  const { products: initialProducts, count: initialCount } = await getInitialProducts()

  return (
    <Suspense>
      <CatalogoClient initialProducts={initialProducts} initialCount={initialCount} />
    </Suspense>
  )
}

export const revalidate = 600
