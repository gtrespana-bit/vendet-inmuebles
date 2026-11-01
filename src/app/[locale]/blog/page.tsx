import type { Metadata } from 'next'
import LocalLink from '@/components/LocalLink'
import fs from 'fs'
import path from 'path'
import { Calendar, ArrowRight, Clock, TrendingUp } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { buildPageAlternates } from '@/lib/seo-metadata'

interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  readTime: string
  tags: string[]
  category: string
  featured?: boolean
}

function cleanFrontmatterValue(raw: string | undefined, fallback = ''): string {
  if (!raw) return fallback
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

function getPosts(): Post[] {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8')
    const slug = file.replace('.md', '')

    const titleMatch = content.match(/^title:\s*(.+)$/m)
    const excerptMatch = content.match(/^excerpt:\s*(.+)$/m)
    const dateMatch = content.match(/^date:\s*(.+)$/m)
    const readTimeMatch = content.match(/^readTime:\s*(.+)$/m)
    const tagsMatch = content.match(/^tags:\s*(.+)$/m)
    const categoryMatch = content.match(/^category:\s*(.+)$/m)
    const featuredMatch = content.match(/^featured:\s*(.+)$/m)

    return {
      slug,
      title: cleanFrontmatterValue(titleMatch?.[1], slug),
      excerpt: cleanFrontmatterValue(excerptMatch?.[1]),
      date: cleanFrontmatterValue(dateMatch?.[1]),
      readTime: cleanFrontmatterValue(readTimeMatch?.[1], '6 min'),
      tags: tagsMatch ? cleanFrontmatterValue(tagsMatch[1]).split(',').map(t => t.trim()).filter(Boolean) : [],
      category: cleanFrontmatterValue(categoryMatch?.[1], 'Guía Inmobiliaria'),
      featured: cleanFrontmatterValue(featuredMatch?.[1]) === 'true',
    }
  }).sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return b.date.localeCompare(a.date)
  })
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const en = locale === 'en'
  const alternates = buildPageAlternates(locale, '/blog')
  return {
    title: en ? 'Real Estate Blog & Market Guides in Venezuela' : 'Blog inmobiliario y guías legales en Venezuela',
    description: en
      ? 'Practical guides on buying, renting, valuing and selling houses, apartments and commercial property safely in Venezuela.'
      : 'Guías prácticas sobre requisitos SAREN, alquiler seguro, valoración por m² y zonas para comprar o invertir en inmuebles en Venezuela.',
    alternates,
    openGraph: {
      title: en ? 'Venezuela Inmuebles Blog & Guides' : 'Blog y Guías | Venezuela Inmuebles',
      description: en
        ? 'Real estate legal requirements, valuation guides and market insights in Venezuela.'
        : 'Requisitos legales, valoración por m² y consejos para comprar, vender y alquilar inmuebles en Venezuela.',
      url: String(alternates.canonical),
      siteName: 'Venezuela Inmuebles',
      type: 'website',
      locale: en ? 'en_US' : 'es_VE',
    },
  }
}

const categoryIcons: Record<string, string> = {
  'Compra y Legal': '⚖️',
  'Alquiler': '🔑',
  'Tasación y Precios': '📐',
  'Inversión y Zonas': '📍',
  'Guía para Propietarios': '🏠',
  'Seguridad Inmobiliaria': '🛡️',
}

export default async function BlogPage() {
  const posts = getPosts()
  const t = await getTranslations('blog')
  const featured = posts.filter(p => p.featured)
  const regular = posts.filter(p => !p.featured)

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-brand-primary to-brand-dark py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <span className="inline-block bg-brand-accent/20 text-[var(--gold-text)] text-xs font-bold px-3 py-1 rounded-full mb-4">
            📝 {t('badge')}
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
            {t('title')}
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {featured.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-brand-primary" /> {t('featured')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {featured.map(post => (
                <LocalLink
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="bg-white rounded-2xl shadow-md hover:shadow-xl transition overflow-hidden border border-gray-100 group block"
                >
                  <div className="bg-gradient-to-r from-brand-primary to-brand-dark p-6 text-white">
                    <div className="flex items-center gap-2 text-xs text-blue-200 mb-3">
                      <span className="bg-white/10 px-2 py-0.5 rounded-full">
                        {categoryIcons[post.category] || '🏠'} {post.category}
                      </span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                    </div>
                    <h3 className="text-xl font-black group-hover:text-[var(--gold-text)] transition leading-snug">
                      {post.title}
                    </h3>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{post.excerpt}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={12} /> {post.date}
                      </span>
                      <span className="text-brand-primary font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                        {t('readMore')} <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </LocalLink>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-800 mb-6">{t('allPosts')}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {regular.map(post => (
            <LocalLink
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition p-6 border border-gray-100 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    {categoryIcons[post.category] || '🏠'} {post.category}
                  </span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {post.readTime}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 group-hover:text-brand-primary transition leading-snug">
                  {post.title}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-3 mb-4">{post.excerpt}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">{post.date}</span>
                <span className="text-brand-primary font-semibold text-xs flex items-center gap-1">
                  {t('read')} <ArrowRight size={12} />
                </span>
              </div>
            </LocalLink>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-r from-brand-primary to-brand-dark rounded-2xl p-8 md:p-12 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-black mb-3">{t('ctaTitle')}</h2>
          <p className="text-blue-200 mb-6 max-w-xl mx-auto">
            {t('ctaSubtitle')}
          </p>
          <LocalLink
            href="/publicar-inmueble"
            className="inline-block bg-brand-accent text-[var(--on-gold)] font-bold px-8 py-4 rounded-xl hover:brightness-105 transition shadow-lg text-lg"
          >
            {t('ctaButton')}
          </LocalLink>
        </div>
      </div>
    </div>
  )
}
