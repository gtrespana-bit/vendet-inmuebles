import { supabase } from '@/lib/supabase'
import { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://vendet.online'

// Blog post dates helper
function getBlogPostDate(slug: string): Date {
  const filePath = path.join(process.cwd(), 'src/content/blog', `${slug}.md`)
  if (!fs.existsSync(filePath)) return new Date()
  const raw = fs.readFileSync(filePath, 'utf-8')
  const dateMatch = raw.match(/^date:\s*(.+)$/m)
  if (dateMatch) {
    const d = new Date(dateMatch[1].trim())
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const staticPages = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 1 },
    { url: `${BASE_URL}/catalogo`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${BASE_URL}/publicar`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.8 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.7 },
    { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.7 },
    { url: `${BASE_URL}/dashboard`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.6 },
    { url: `${BASE_URL}/creditos`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.6 },
    { url: `${BASE_URL}/como-funciona`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE_URL}/sobre-nosotros`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${BASE_URL}/contacto`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.5 },
    { url: `${BASE_URL}/terminos-y-condiciones`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${BASE_URL}/politica-de-privacidad`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
  ]

  // Páginas de ciudad (SEO local)
  const ciudades = [
    'caracas', 'maracaibo', 'valencia', 'barquisimeto', 'maracay',
    'ciudad-guayana', 'cumana', 'merida', 'san-cristobal', 'petare',
  ]
  const categorySlugs = [
    'vehiculos', 'tecnologia', 'moda', 'hogar', 'herramientas',
    'materiales', 'repuestos', 'otros',
  ]

  const ciudadPages = ciudades.map(c => ({
    url: `${BASE_URL}/${c}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const ciudadCategoriaPages = ciudades.flatMap(c =>
    categorySlugs.map(cat => ({
      url: `${BASE_URL}/${c}/${cat}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  )

  // Blog posts
  const blogDir = path.join(process.cwd(), 'src/content/blog')
  const blogSlugs = fs.existsSync(blogDir)
    ? fs.readdirSync(blogDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
    : []

  const blogPages = blogSlugs.map(slug => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: getBlogPostDate(slug),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Productos activos
  const { data: productos } = await supabase
    .from('productos')
    .select('id, creado_en, actualizado_en')
    .eq('activo', true)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
  
  const productoPages = (productos || []).map((p: any) => ({
    url: `${BASE_URL}/inmueble/${p.id}`,
    lastModified: new Date(p.actualizado_en || p.creado_en),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...ciudadPages, ...ciudadCategoriaPages, ...blogPages, ...productoPages]
}
