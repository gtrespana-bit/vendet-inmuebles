import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { CIUDADES_SEO, CATEGORIAS_POPULARES } from '@/lib/ubicaciones-seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // URLs estáticas
  const staticUrls: MetadataRoute.Sitemap = [
    { url: 'https://venezuela-inmuebles.online', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://venezuela-inmuebles.online/en', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://venezuela-inmuebles.online/catalogo', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://venezuela-inmuebles.online/publicar', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://venezuela-inmuebles.online/creditos', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://venezuela-inmuebles.online/como-funciona', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://venezuela-inmuebles.online/contacto', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://venezuela-inmuebles.online/faq', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://venezuela-inmuebles.online/sobre-nosotros', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://venezuela-inmuebles.online/terminos-y-condiciones', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://venezuela-inmuebles.online/politica-de-privacidad', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  // URLs de ciudades
  const cityUrls: MetadataRoute.Sitemap = CIUDADES_SEO.map(ciudad => ({
    url: `https://venezuela-inmuebles.online/${ciudad.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // URLs de ciudad + categoría
  const cityCategoryUrls: MetadataRoute.Sitemap = []
  for (const ciudad of CIUDADES_SEO) {
    for (const categoria of CATEGORIAS_POPULARES) {
      cityCategoryUrls.push({
        url: `https://venezuela-inmuebles.online/${ciudad.slug}/${categoria}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })
    }
  }

  // Obtener productos activos
  let productUrls: MetadataRoute.Sitemap = []
  try {
    const { data: productos, error } = await supabase
      .from('vw_propiedades_publicas')
      .select('id, actualizado_en')
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .limit(5000)

    if (!error && productos) {
      productUrls = productos.map(p => ({
        url: `https://venezuela-inmuebles.online/inmueble/${p.id}`,
        lastModified: new Date(p.actualizado_en || Date.now()),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    }
  } catch {
    // Si falla, solo incluir URLs estáticas
  }

  // Obtener artículos del blog
  let blogUrls: MetadataRoute.Sitemap = []
  try {
    const { data: posts, error } = await supabase
      .from('blog_posts')
      .select('slug, actualizado_en')
      .eq('publicado', true)
      .limit(100)

    if (!error && posts) {
      blogUrls = posts.map(post => ({
        url: `https://venezuela-inmuebles.online/blog/${post.slug}`,
        lastModified: new Date(post.actualizado_en || Date.now()),
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }))
    }
  } catch {
    // Si falla, continuar sin blog
  }

  return [...staticUrls, ...cityUrls, ...cityCategoryUrls, ...productUrls, ...blogUrls]
}
