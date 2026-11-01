import type { MetadataRoute } from 'next'
import { SITE_URL, buildPageAlternates } from './seo-metadata.ts'
import { CIUDADES_SEO, slugifySeoSegment } from './ubicaciones-seo.ts'

export interface SitemapPropertyInput {
  id: string
  slug?: string | null
  estado?: string | null
  ciudad?: string | null
  operacion_slug?: string | null
  operacion_nombre?: string | null
  tipo_operacion?: string | null
  creado_en?: string | null
  actualizado_en?: string | null
}

export interface SitemapSellerInput {
  id: string
  slug?: string | null
  ultima_actividad?: string | null
  creado_en?: string | null
}

export interface SitemapBlogInput {
  slug: string
  lastModified?: Date
}

function parseValidDate(raw: string | null | undefined): Date | undefined {
  if (!raw) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function maxDate(a: Date | undefined, b: Date | undefined): Date | undefined {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

function resolveOperationSlug(row: SitemapPropertyInput): 'venta' | 'alquiler' {
  const raw = String(row.operacion_slug || row.operacion_nombre || row.tipo_operacion || '').toLowerCase()
  return raw.includes('alquiler') || raw.includes('rent') ? 'alquiler' : 'venta'
}

export function buildLocalizedPair(
  pathname: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  lastModified?: Date
): MetadataRoute.Sitemap {
  const esAlt = buildPageAlternates('es', pathname)
  const enAlt = buildPageAlternates('en', pathname)
  const languages = esAlt.languages as Record<string, string>

  return [
    {
      url: String(esAlt.canonical || SITE_URL),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
      alternates: { languages },
    },
    {
      url: String(enAlt.canonical || `${SITE_URL}/en`),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority: priority === 1 ? 0.9 : Math.round(Math.max(0.2, priority - 0.05) * 100) / 100,
      alternates: { languages },
    },
  ]
}

/**
 * Construye el árbol completo de `sitemap.xml` garantizando:
 * - Cero URLs con redirección (`/propiedades` excluido) ni muros de login (`/publicar-inmueble` excluido)
 * - Cero páginas de ubicación vacías (solo estados/ciudades con inventario activo real; al publicar el primer anuncio en una ciudad/estado, entra sola al sitemap sin reenviar nada a Search Console)
 * - Cero `<loc>` duplicados y reciprocidad exacta `es-VE` / `en-US` / `x-default`
 */
export function buildSitemapEntries({
  properties,
  sellers = [],
  blogPosts = [],
  validCitiesByState,
}: {
  properties: SitemapPropertyInput[]
  sellers?: SitemapSellerInput[]
  blogPosts?: SitemapBlogInput[]
  validCitiesByState?: Map<string, Set<string>>
}): MetadataRoute.Sitemap {
  let latestAnyProperty: Date | undefined
  let latestVenta: Date | undefined
  let latestAlquiler: Date | undefined
  let latestBlog: Date | undefined

  for (const post of blogPosts) {
    latestBlog = maxDate(latestBlog, post.lastModified)
  }

  // Mapas de ubicaciones con inventario activo real (100 % libres de thin content)
  const activeOpStates = new Map<string, Date | undefined>() // `${op}/${stateSlug}`
  const activeOpStateCities = new Map<string, Date | undefined>() // `${op}/${stateSlug}/${citySlug}`
  const activeCityLandings = new Map<string, Date | undefined>() // `${citySlug}` en CIUDADES_SEO
  const seoCitySlugSet = new Set(CIUDADES_SEO.map((c) => c.slug))

  const propertyEntries: MetadataRoute.Sitemap = []

  for (const prop of properties) {
    const modified = parseValidDate(prop.actualizado_en || prop.creado_en)
    latestAnyProperty = maxDate(latestAnyProperty, modified)

    const op = resolveOperationSlug(prop)
    if (op === 'venta') latestVenta = maxDate(latestVenta, modified)
    else latestAlquiler = maxDate(latestAlquiler, modified)

    const identifier = (prop.slug && prop.slug.trim()) || prop.id
    if (identifier) {
      propertyEntries.push(...buildLocalizedPair(`/inmueble/${identifier}`, 0.8, 'weekly', modified))
    }

    const stateSlug = prop.estado ? slugifySeoSegment(prop.estado) : ''
    const citySlug = prop.ciudad ? slugifySeoSegment(prop.ciudad) : ''

    if (stateSlug) {
      const stateKey = `${op}/${stateSlug}`
      activeOpStates.set(stateKey, maxDate(activeOpStates.get(stateKey), modified))

      if (citySlug) {
        const isKnownDbCity = !validCitiesByState || Boolean(validCitiesByState.get(stateSlug)?.has(citySlug))
        if (isKnownDbCity) {
          const stateCityKey = `${op}/${stateSlug}/${citySlug}`
          activeOpStateCities.set(stateCityKey, maxDate(activeOpStateCities.get(stateCityKey), modified))
        }
      }
    }

    if (citySlug && seoCitySlugSet.has(citySlug)) {
      activeCityLandings.set(citySlug, maxDate(activeCityLandings.get(citySlug), modified))
    }
  }

  // 1. Páginas principales indexables (sin redirecciones ni puertas de login)
  const corePages: MetadataRoute.Sitemap = [
    ...buildLocalizedPair('', 1.0, 'daily', latestAnyProperty),
    ...buildLocalizedPair('/catalogo', 0.9, 'daily', latestAnyProperty),
    ...buildLocalizedPair('/mapa', 0.9, 'daily', latestAnyProperty),
    ...buildLocalizedPair('/propiedades/venta', 0.9, 'daily', latestVenta || latestAnyProperty),
    ...buildLocalizedPair('/propiedades/alquiler', 0.9, 'daily', latestAlquiler || latestAnyProperty),
    ...buildLocalizedPair('/blog', 0.8, 'weekly', latestBlog),
    ...buildLocalizedPair('/planes', 0.7, 'monthly'),
    ...buildLocalizedPair('/creditos', 0.6, 'monthly'),
    ...buildLocalizedPair('/como-funciona', 0.6, 'monthly'),
    ...buildLocalizedPair('/faq', 0.6, 'monthly'),
    ...buildLocalizedPair('/sobre-nosotros', 0.5, 'monthly'),
    ...buildLocalizedPair('/contacto', 0.5, 'monthly'),
    ...buildLocalizedPair('/como-instalar-app', 0.4, 'yearly'),
    ...buildLocalizedPair('/terminos-y-condiciones', 0.3, 'yearly'),
    ...buildLocalizedPair('/politica-de-privacidad', 0.3, 'yearly'),
  ]

  // 2. Hubs geográficos con inventario real (crecen solos conforme se publican inmuebles)
  const locationEntries: MetadataRoute.Sitemap = [
    ...Array.from(activeOpStates.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([key, mod]) => buildLocalizedPair(`/propiedades/${key}`, 0.8, 'daily', mod)),
    ...Array.from(activeOpStateCities.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([key, mod]) => buildLocalizedPair(`/propiedades/${key}`, 0.85, 'daily', mod)),
    ...Array.from(activeCityLandings.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([citySlug, mod]) => buildLocalizedPair(`/${citySlug}`, 0.85, 'daily', mod)),
  ]

  // 3. Guías inmobiliarias del blog
  const blogEntries: MetadataRoute.Sitemap = blogPosts.flatMap((post) =>
    buildLocalizedPair(`/blog/${post.slug}`, 0.7, 'monthly', post.lastModified)
  )

  // 4. Escaparates públicos verificados / con cartera activa
  const sellerEntries: MetadataRoute.Sitemap = sellers.flatMap((seller) => {
    const idOrSlug = (seller.slug && seller.slug.trim()) || seller.id
    if (!idOrSlug) return []
    const mod = parseValidDate(seller.ultima_actividad || seller.creado_en)
    return buildLocalizedPair(`/vendedor/${idOrSlug}`, 0.6, 'weekly', mod)
  })

  // Deduplicación estricta por URL exacta
  const seenUrls = new Set<string>()
  const deduped: MetadataRoute.Sitemap = []
  for (const item of [...corePages, ...locationEntries, ...blogEntries, ...propertyEntries, ...sellerEntries]) {
    if (seenUrls.has(item.url)) continue
    seenUrls.add(item.url)
    deduped.push(item)
  }

  return deduped
}
