import type { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const SITE_URL = 'https://venezuela-inmuebles.online'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sharedPaths = [
    ['', 1],
    ['/catalogo', 0.9],
    ['/propiedades/venta', 0.8],
    ['/propiedades/alquiler', 0.8],
    ['/publicar-inmueble', 0.7],
    ['/blog', 0.7],
    ['/como-funciona', 0.6],
    ['/faq', 0.5],
    ['/sobre-nosotros', 0.5],
    ['/contacto', 0.5],
    ['/terminos-y-condiciones', 0.3],
    ['/politica-de-privacidad', 0.3],
  ] as const

  const staticPages: MetadataRoute.Sitemap = sharedPaths.flatMap(([pathname, priority]) => {
    const esPath = pathname || '/'
    const enPath = `/en${pathname}`
    return [
      { url: `${SITE_URL}${esPath}`, lastModified: new Date(), changeFrequency: pathname === '' ? 'daily' : 'monthly', priority },
      { url: `${SITE_URL}${enPath}`, lastModified: new Date(), changeFrequency: pathname === '' ? 'daily' : 'monthly', priority: pathname === '' ? 0.8 : priority },
    ]
  })

  const blogDirectory = path.join(process.cwd(), 'src/content/blog')
  const blogPages: MetadataRoute.Sitemap = fs.existsSync(blogDirectory)
    ? fs.readdirSync(blogDirectory)
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.replace('.md', ''))
        .flatMap((slug) => [
          { url: `${SITE_URL}/blog/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
          { url: `${SITE_URL}/en/blog/${slug}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        ])
    : []

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
        return [
          { url: `${SITE_URL}/inmueble/${slug}`, lastModified: modified, changeFrequency: 'weekly', priority: 0.6 },
          { url: `${SITE_URL}/en/inmueble/${slug}`, lastModified: modified, changeFrequency: 'weekly', priority: 0.6 },
        ]
      })
    } catch {
      // Si Supabase no está configurado o no responde, conservar el sitemap estático.
    }
  }

  return [...staticPages, ...blogPages, ...propertyPages]
}
