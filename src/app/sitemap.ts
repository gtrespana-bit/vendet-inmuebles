import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import {
  buildSitemapEntries,
  type SitemapBlogInput,
  type SitemapPropertyInput,
  type SitemapSellerInput,
} from '@/lib/seo-sitemap'
import { getBlogTranslationPairs } from '@/lib/blog'

// Revalidación automática cada hora (ISR): los nuevos inmuebles, ciudades, estados
// y escaparates entran solos en `/sitemap.xml` sin tener que reenviarlo a Search Console.
export const revalidate = 3600

/**
 * Pares es/en del blog. Cada idioma tiene su **propio slug traducido**, así que el
 * sitemap emite dos rutas distintas por artículo unidas por hreflang recíproco.
 * Un artículo sin traducción queda fuera para no publicar una URL que daría 404.
 *
 * Nota: `src/content/blog/**\/*.md` debe seguir en `outputFileTracingIncludes`
 * (`next.config.js`); esta lectura es dinámica y el rastreo estático no la detecta.
 */
function readBlogPosts(): SitemapBlogInput[] {
  return getBlogTranslationPairs().map((pair) => ({
    slugEs: pair.es,
    slugEn: pair.en,
    lastModified: pair.lastModified,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogPosts = readBlogPosts()
  const properties: SitemapPropertyInput[] = []
  let sellers: SitemapSellerInput[] = []
  let validCitiesByState: Map<string, Set<string>> | undefined

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('example.supabase.co')) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const pageSize = 1000
      for (let offset = 0; offset < 20000; offset += pageSize) {
        const { data, error } = await supabase
          .from('vw_propiedades_publicas')
          .select('id, slug, estado, ciudad, operacion_slug, operacion_nombre, tipo_operacion, creado_en, actualizado_en')
          .eq('activo', true)
          .order('creado_en', { ascending: false })
          .range(offset, offset + pageSize - 1)

        if (error) {
          console.error('[sitemap] Error consultando vw_propiedades_publicas:', error.message)
          break
        }
        if (!data || data.length === 0) break
        properties.push(...(data as SitemapPropertyInput[]))
        if (data.length < pageSize) break
      }

      const [{ data: cityRows }, { data: sellerRows }] = await Promise.all([
        supabase.from('cities').select('state_id, slug'),
        supabase
          .from('vw_perfiles_publicos')
          .select('id, slug, ultima_actividad, creado_en')
          .limit(2000),
      ])

      if (cityRows && cityRows.length > 0) {
        validCitiesByState = new Map<string, Set<string>>()
        for (const row of cityRows as Array<{ state_id: string; slug: string }>) {
          if (!row.state_id || !row.slug) continue
          const set = validCitiesByState.get(row.state_id) || new Set<string>()
          set.add(row.slug)
          validCitiesByState.set(row.state_id, set)
        }
      }

      if (sellerRows) {
        sellers = sellerRows as SitemapSellerInput[]
      }
    } catch (err) {
      console.error('[sitemap] Excepción consultando datos dinámicos:', err)
    }
  }

  return buildSitemapEntries({
    properties,
    sellers,
    blogPosts,
    validCitiesByState,
  })
}
