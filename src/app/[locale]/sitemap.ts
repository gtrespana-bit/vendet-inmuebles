import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://venezuela-inmuebles.online'

function getBlogPostDate(slug: string): Date {
  const filePath = path.join(process.cwd(), 'src/content/blog', `${slug}.md`)
  if (!fs.existsSync(filePath)) return new Date()
  const raw = fs.readFileSync(filePath, 'utf-8')
  const dateMatch = raw.match(/^date:\s*(.+)$/m)
  if (dateMatch) {
    const date = new Date(dateMatch[1].trim())
    if (!Number.isNaN(date.getTime())) return date
  }
  return new Date()
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/catalogo`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/propiedades/venta`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/propiedades/alquiler`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/publicar-inmueble`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.7 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/como-funciona`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/sobre-nosotros`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contacto`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE_URL}/terminos-y-condiciones`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/politica-de-privacidad`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  const blogDirectory = path.join(process.cwd(), 'src/content/blog')
  const blogSlugs = fs.existsSync(blogDirectory)
    ? fs.readdirSync(blogDirectory).filter((file) => file.endsWith('.md')).map((file) => file.replace('.md', ''))
    : []
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: getBlogPostDate(slug),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  let propertyPages: MetadataRoute.Sitemap = []
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from('vw_propiedades_publicas')
        .select('id, slug, creado_en, actualizado_en')
        .eq('activo', true)
        .limit(5000)

      propertyPages = (data || []).map((property: any) => ({
        url: `${BASE_URL}/inmueble/${property.slug || property.id}`,
        lastModified: new Date(property.actualizado_en || property.creado_en || Date.now()),
        changeFrequency: 'weekly',
        priority: 0.6,
      }))
    } catch {
      // El sitemap sigue disponible con las páginas públicas aunque Supabase no esté configurado.
    }
  }

  return [...staticPages, ...blogPages, ...propertyPages]
}
