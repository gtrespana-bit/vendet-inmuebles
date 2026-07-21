import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import CatalogoClient from './CatalogoPage'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Catálogo — Compra y Venta en Venezuela | VendeT-Venezuela',
  description: 'Explora el catálogo de productos en VendeT-Venezuela. Carros, tecnología, moda, hogar, herramientas y más.',
  alternates: {
    canonical: 'https://vendet.online/catalogo',
    languages: {
      es: 'https://vendet.online/catalogo',
      en: 'https://vendet.online/en/catalogo',
    },
  },
}

// ✅ Fetch server-side de productos iniciales
// Replica exactamente la misma query + ordenamiento que usa el cliente
async function getInitialProducts() {
  try {
    // Optimización: Seleccionar solo columnas necesarias para la vista de catálogo
    const { data, count, error } = await supabase
      .from('productos')
      .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado', { count: 'exact' })
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
      .order('creado_en', { ascending: false })
      .limit(12) // Reducir de 48 a 12 para mejor rendimiento inicial

    if (error || !data) return { products: [], count: 0 }

    // Mismo ordenamiento que el cliente: boost > destacado vigente > fecha
    // Pre-computamos flags de estado para evitar hydration mismatch
    const now = new Date().toISOString()
    const sorted = data.sort((a: any, b: any) => {
      const aBoost = a.boosteado_en || null
      const bBoost = b.boosteado_en || null
      if (aBoost && !bBoost) return -1
      if (!aBoost && bBoost) return 1
      if (aBoost && bBoost) return bBoost.localeCompare(aBoost)
      const aDest = a.destacado && a.destacado_hasta && a.destacado_hasta > now
      const bDest = b.destacado && b.destacado_hasta && b.destacado_hasta > now
      if (aDest && !bDest) return -1
      if (!aDest && bDest) return 1
      if (aDest && bDest) return b.destacado_hasta.localeCompare(a.destacado_hasta)
      return b.creado_en.localeCompare(a.creado_en)
    }).map((p: any) => ({
      ...p,
      // Pre-computar flags para evitar hydration mismatch en cliente
      _isFeatured: !!(p.destacado && p.destacado_hasta && p.destacado_hasta > now),
    }))

    return { products: sorted, count: count ?? 0 }
  } catch {
    return { products: [], count: 0 }
  }
}

export default async function CatalogoPage() {
  // Fetch en servidor ANTES de renderizar
  const { products: initialProducts, count: initialCount } = await getInitialProducts()

  // ✅ Suspense boundary necesario para useSearchParams() en Next.js 14
  // Sin esto, la página se desopta de static rendering y causa hydration mismatch
  return (
    <Suspense>
      <CatalogoClient
        initialProducts={initialProducts}
        initialCount={initialCount}
      />
    </Suspense>
  )
}

// ISR: cache catalog for 10 minutes
export const revalidate = 600