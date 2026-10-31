import type { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { CIUDADES_SEO } from '@/lib/ubicaciones-seo'
import { ESTADOS } from '@/lib/ubicaciones'

const SITE_URL = 'https://venezuela-inmuebles.online'

function slugifyEstado(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Par es/en con sus hreflang correspondientes
function localized(
  pathname: string,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  lastModified: Date = new Date()
): MetadataRoute.Sitemap {
  const esPath = pathname || '/'
  const enPath = `/en${pathname}`
  return [
    {
      url: `${SITE_URL}${esPath}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages: { 'es-VE': `${SITE_URL}${esPath}`, 'en-US': `${SITE_URL}${enPath}`, 'x-default': `${SITE_URL}${esPath}` } },
    },
    {
      url: `${SITE_URL}${enPath}`,
      lastModified,
      changeFrequency,
      priority: priority === 1 ? 0.8 : priority,
      alternates: { languages: { 'es-VE': `${SITE_URL}${esPath}`, 'en-US': `${SITE_URL}${enPath}`, 'x-default': `${SITE_URL}${esPath}` } },
    },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sharedPaths: Array<[string, number, MetadataRoute.Sitemap[number]['changeFrequency']]> = [
    ['', 1, 'daily'],
    ['/catalogo', 0.9, 'daily'],
    ['/mapa', 0.9, 'daily'],
    ['/propiedades', 0.8, 'daily'],
    ['/propiedades/venta', 0.9, 'daily'],
    ['/propiedades/alquiler', 0.9, 'daily'],
    ['/buscar', 0.5, 'weekly'],
    ['/publicar-inmueble', 0.7, 'monthly'],
    ['/blog', 0.8, 'weekly'],
    ['/como-funciona', 0.6, 'monthly'],
    ['/planes', 0.6, 'monthly'],
    ['/creditos', 0.6, 'monthly'],
    ['/faq', 0.5, 'monthly'],
    ['/sobre-nosotros', 0.5, 'monthly'],
    ['/contacto', 0.5, 'monthly'],
    ['/como-instalar-app', 0.4, 'yearly'],
    ['/terminos-y-condiciones', 0.3, 'yearly'],
    ['/politica-de-privacidad', 0.3, 'yearly'],
  ]

  const staticPages: MetadataRoute.Sitemap = sharedPaths.flatMap(([p, priority, cf]) => localized(p, priority, cf))

  // Páginas SEO por estado y operación: /propiedades/{venta|alquiler}/{estado}
  const estadoPages: MetadataRoute.Sitemap = (['venta', 'alquiler'] as const).flatMap((op) =>
    ESTADOS.flatMap((estado) => localized(`/propiedades/${op}/${slugifyEstado(estado)}`, 0.7, 'daily'))
  )

  // Landings SEO por ciudad (toda Venezuela): /{ciudad}
  const cityPages: MetadataRoute.Sitemap = CIUDADES_SEO.flatMap((ciudad) =>
    localized(`/${ciudad.slug}`, 0.7, 'daily')
  )

  // Blog (fecha real desde el frontmatter)
  const blogDirectory = path.join(process.cwd(), 'src/content/blog')
  const blogPages: MetadataRoute.Sitemap = fs.existsSync(blogDirectory)
    ? fs.readdirSync(blogDirectory)
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.replace('.md', ''))
        .flatMap((slug) => {
          const filePath = path.join(blogDirectory, `${slug}.md`)
          let lastModified = new Date()
          try {
            const raw = fs.readFileSync(filePath, 'utf-8')
            const dateMatch = raw.match(/^date:\s*(.+)$/m)
            if (dateMatch) {
              const date = new Date(dateMatch[1].trim())
              if (!Number.isNaN(date.getTime())) lastModified = date
            }
          } catch { /* fecha por defecto */ }
          return localized(`/blog/${slug}`, 0.6, 'monthly', lastModified)
        })
    : []

  // Inmuebles activos (dinámico, desde la vista pública)
  let propertyPages: MetadataRoute.Sitemap = []
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('vw_propiedades_publicas')
        .select('id, slug, creado_en, actualizado_en')
        .eq('activo', true)
        .limit(5000)

      propertyPages = (data || []).flatMap((property: any) => {
        const slug = property.slug || property.id
        const modified = new Date(property.actualizado_en || property.creado_en || Date.now())
        return localized(`/inmueble/${slug}`, 0.8, 'weekly', modified)
      })
    } catch {
      // Si Supabase no responde, el sitemap se sirve igualmente con las páginas estáticas.
    }
  }

  return [...staticPages, ...estadoPages, ...cityPages, ...blogPages, ...propertyPages]
}
