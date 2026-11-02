import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase-server'
import { buildPageAlternates } from '@/lib/seo-metadata'
import { claveAmenidad, leerAmenidades, ordenAmenidad } from '@/lib/amenities'
import { parseCompareIds, type ComparableProperty } from '@/lib/property-compare'
import CompararClient from './CompararClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ids?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const isEn = locale === 'en'

  return {
    title: isEn ? 'Compare Properties Side by Side' : 'Comparador de Inmuebles Lado a Lado',
    description: isEn
      ? 'Compare prices, price per square meter, area, bedrooms and amenities across Venezuelan properties.'
      : 'Compara precios, precio por m², superficie, habitaciones y amenidades de inmuebles en Venezuela.',
    alternates: buildPageAlternates(locale, '/comparar'),
    robots: { index: false, follow: true },
  }
}

export default async function CompararPage({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const sp = await searchParams
  const ids = parseCompareIds(sp?.ids)

  let items: ComparableProperty[] = []

  if (ids.length > 0 && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = createServerClient()
      const tAmenity = await getTranslations({ locale, namespace: 'catalog.extra.amenity' })

      const { data } = await supabase
        .from('vw_propiedades_publicas')
        .select('*')
        .in('id', ids)

      if (Array.isArray(data)) {
        const byId = new Map<string, any>()
        for (const row of data) {
          if (row?.id) byId.set(String(row.id).toLowerCase(), row)
        }

        items = ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((row: any): ComparableProperty => {
            const opStr = String(
              row.operacion_slug || row.operation_type || row.operacion_nombre || '',
            ).toLowerCase()
            const isRent = opStr.includes('alquiler') || opStr.includes('rent')

            const translatedAmenities = leerAmenidades(row.caracteristicas)
              .sort((a, b) => ordenAmenidad(a) - ordenAmenidad(b))
              .map((nombre) => {
                const clave = claveAmenidad(nombre)
                if (!clave) return nombre
                try {
                  return tAmenity(clave)
                } catch {
                  return nombre
                }
              })

            return {
              id: String(row.id),
              slug: row.slug ? String(row.slug) : null,
              title: String(row.titulo || row.title || (locale === 'en' ? 'Property' : 'Inmueble')),
              price: Number(row.precio_usd ?? row.precio ?? row.price ?? 0),
              currency: String(row.moneda || row.currency || 'USD'),
              operation: isRent ? 'alquiler' : 'venta',
              propertyType: row.tipo_nombre || row.property_type || row.subcategoria || null,
              state: row.estado || row.state_name || null,
              city: row.ciudad || row.city_name || null,
              zone: row.zona || null,
              image: row.main_image_url || row.imagen_url || '/sinimagen.webp',
              bedrooms: row.habitaciones ?? row.bedrooms ?? null,
              bathrooms: row.banos ?? row.bathrooms ?? null,
              parking: row.puestos_estacionamiento ?? row.parking_spaces ?? null,
              builtArea: row.area_construida != null ? Number(row.area_construida) : null,
              totalArea: row.area_total != null ? Number(row.area_total) : null,
              condition: row.condicion || null,
              ageYears: row.antiguedad_anios != null ? Number(row.antiguedad_anios) : null,
              hasVideo: Boolean(typeof row.video_url === 'string' && row.video_url.trim()),
              hasTour: Boolean(typeof row.virtual_tour_url === 'string' && row.virtual_tour_url.trim()),
              hasFloorPlan: Boolean(typeof row.plano_url === 'string' && row.plano_url.trim()),
              verifiedSeller: Boolean(row.propietario_verificado || row.vendedor_verificado),
              amenities: translatedAmenities,
            }
          })
      }
    } catch (err) {
      console.error('CompararPage load error:', err)
    }
  }

  return <CompararClient locale={locale} requestedIds={ids} initialItems={items} />
}
