import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
import fs from 'fs'
import path from 'path'
import { ArrowLeft, Calendar, Clock, Tag, ArrowRight, ChevronRight } from 'lucide-react'
import { routing } from '@/i18n/routing'
import { buildPageAlternates, SITE_URL } from '@/lib/seo-metadata'

interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  readTime: string
  tags: string[]
  category: string
  content: string
  ogImage?: string
}

function cleanFrontmatterValue(raw: string | undefined, fallback = ''): string {
  if (!raw) return fallback
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

function getPostBySlug(slug: string): Post | null {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null
  const filePath = path.join(process.cwd(), 'src/content/blog', `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const parts = raw.split('---\n')
  if (parts.length < 3) return null
  const frontmatterRaw = parts[1]
  const contentRaw = parts.slice(2).join('---\n').trim()

  const lines = frontmatterRaw.split('\n').filter(l => !l.startsWith('#'))
  const frontmatter: Record<string, string> = {}
  lines.forEach(line => {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim()
      const value = cleanFrontmatterValue(line.substring(colonIndex + 1))
      frontmatter[key] = value
    }
  })

  return {
    slug,
    title: frontmatter.title || slug,
    excerpt: frontmatter.excerpt || '',
    date: frontmatter.date || '',
    readTime: frontmatter.readTime || '6 min',
    tags: frontmatter.tags ? frontmatter.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    category: frontmatter.category || 'Guía Inmobiliaria',
    content: contentRaw,
    ogImage: frontmatter.ogImage,
  }
}

function getAllSlugs(): string[] {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
}

export const dynamicParams = false

export function generateStaticParams(): Array<{ locale: string; slug: string }> {
  const slugs = getAllSlugs()
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })))
}

export async function generateMetadata(props: { params: Promise<{ slug: string; locale: string }> }): Promise<Metadata> {
  const { slug, locale } = await props.params
  const post = getPostBySlug(slug)
  if (!post) {
    return {
      title: locale === 'en' ? 'Article not found' : 'Artículo no encontrado',
      robots: { index: false, follow: false },
    }
  }

  const alternates = buildPageAlternates(locale, `/blog/${post.slug}`)
  const imageUrl = post.ogImage || `${SITE_URL}/og-image.png`

  return {
    title: post.title,
    description: post.excerpt,
    alternates,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: String(alternates.canonical),
      siteName: 'Venezuela Inmuebles',
      type: 'article',
      publishedTime: post.date || undefined,
      locale: locale === 'en' ? 'en_US' : 'es_VE',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: post.title }],
    },
  }
}

function generateArticleSchema(post: Post, locale: string) {
  const prefix = locale === 'en' ? '/en' : ''
  const articleUrl = `${SITE_URL}${prefix}/blog/${post.slug}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt,
        image: [post.ogImage || `${SITE_URL}/og-image.png`],
        datePublished: post.date,
        dateModified: post.date,
        author: {
          '@type': 'Organization',
          name: 'Venezuela Inmuebles',
          url: SITE_URL,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Venezuela Inmuebles',
          url: SITE_URL,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_URL}/logo-venezuela-inmuebles.png`,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': articleUrl,
        },
        articleSection: post.category,
        keywords: post.tags.join(', '),
        inLanguage: 'es-VE',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: locale === 'en' ? 'Home' : 'Inicio',
            item: `${SITE_URL}${prefix || ''}`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${SITE_URL}${prefix}/blog`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: post.title,
            item: articleUrl,
          },
        ],
      },
    ],
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|\/|#|mailto:)/i.test(url) && !/^\s*javascript:/i.test(url)
}

function inlineFormat(rawText: string, locale: string): string {
  let text = escapeHtml(rawText)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
  text = text.replace(/_(.+?)_/g, '<em>$1</em>')
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const clean = url.trim()
    if (!isSafeUrl(clean)) return label
    const localizedUrl = locale === 'en' && clean.startsWith('/') && !clean.startsWith('/en/')
      ? `/en${clean}`
      : clean
    const isExternal = /^https?:\/\//i.test(localizedUrl)
    return `<a href="${localizedUrl}" class="text-brand-primary font-semibold hover:underline underline-offset-2"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`
  })
  return text
}

function renderMarkdown(content: string, locale: string): string {
  const blocks = content.split(/\n\n+/)
  const htmlParts: string[] = []

  for (const rawBlock of blocks) {
    const lines = rawBlock.trim().split('\n')

    if (lines.length >= 2 && lines[0].startsWith('|') && lines[1].startsWith('|')) {
      const headerCells = lines[0].split('|').filter(c => c.trim() !== '')
      const dataLines = lines.slice(2).filter(l => l.trim().startsWith('|'))

      htmlParts.push('<div class="overflow-x-auto my-6 rounded-xl border border-gray-200 shadow-sm">')
      htmlParts.push('<table class="w-full text-sm">')
      htmlParts.push('<thead class="bg-brand-primary text-white"><tr>')
      for (const cell of headerCells) {
        htmlParts.push(`<th class="px-4 py-3 font-bold text-left whitespace-nowrap">${inlineFormat(cell.trim(), locale)}</th>`)
      }
      htmlParts.push('</tr></thead><tbody class="divide-y divide-gray-100">')
      for (const dl of dataLines) {
        const cells = dl.split('|').filter(c => c.trim() !== '')
        htmlParts.push('<tr class="hover:bg-gray-50/50">')
        for (const cell of cells) {
          htmlParts.push(`<td class="px-4 py-3 text-gray-700">${inlineFormat(cell.trim(), locale)}</td>`)
        }
        htmlParts.push('</tr>')
      }
      htmlParts.push('</tbody></table></div>')
      continue
    }

    if (lines.length === 1 && lines[0].startsWith('### ')) {
      htmlParts.push(`<h3 class="text-lg font-bold text-gray-900 mt-8 mb-3">${inlineFormat(lines[0].slice(4), locale)}</h3>`)
      continue
    }

    if (lines.length === 1 && lines[0].startsWith('## ')) {
      htmlParts.push(`<h2 class="text-2xl font-black text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-100">${inlineFormat(lines[0].slice(3), locale)}</h2>`)
      continue
    }

    if (lines.every(l => /^-\s+/.test(l.trim()))) {
      htmlParts.push('<ul class="my-4 space-y-2 list-disc pl-6 text-gray-700 leading-relaxed">')
      for (const l of lines) {
        htmlParts.push(`<li>${inlineFormat(l.trim().replace(/^-\s+/, ''), locale)}</li>`)
      }
      htmlParts.push('</ul>')
      continue
    }

    if (lines.every(l => /^\d+\.\s+/.test(l.trim()))) {
      htmlParts.push('<ol class="my-4 space-y-2 list-decimal pl-6 text-gray-700 leading-relaxed">')
      for (const l of lines) {
        htmlParts.push(`<li>${inlineFormat(l.trim().replace(/^\d+\.\s+/, ''), locale)}</li>`)
      }
      htmlParts.push('</ol>')
      continue
    }

    htmlParts.push(`<p class="text-gray-700 leading-relaxed my-4">${inlineFormat(lines.join(' '), locale)}</p>`)
  }

  return htmlParts.join('\n')
}

const categoryIcons: Record<string, string> = {
  'Compra y Legal': '⚖️',
  'Alquiler': '🔑',
  'Tasación y Precios': '📐',
  'Inversión y Zonas': '📍',
  'Guía para Propietarios': '🏠',
  'Seguridad Inmobiliaria': '🛡️',
}

export default async function BlogPost(props: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await props.params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const t = await getTranslations('blog')
  const htmlContent = renderMarkdown(post.content, locale)
  const articleSchema = generateArticleSchema(post, locale)

  return (
    <article className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, '\\u003c') }}
      />

      <div className="bg-gray-50 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500">
            <LocalLink href="/" className="hover:text-brand-primary">{t('home')}</LocalLink>
            <ChevronRight size={14} aria-hidden="true" />
            <LocalLink href="/blog" className="hover:text-brand-primary">Blog</LocalLink>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="text-gray-800 truncate">{post.title}</span>
          </nav>
        </div>
      </div>

      <section className="bg-gradient-to-br from-brand-primary to-brand-dark py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <LocalLink href="/blog" className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-6 transition">
            <ArrowLeft size={16} aria-hidden="true" /> {t('backToBlog')}
          </LocalLink>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg" aria-hidden="true">{categoryIcons[post.category] || '🏠'}</span>
            <span className="text-sm font-semibold text-[var(--gold-text)] bg-brand-accent/20 px-3 py-1 rounded-full">{post.category}</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white mb-4 leading-tight">{post.title}</h1>
          <p className="text-lg text-blue-200 mb-6">{post.excerpt}</p>
          <div className="flex items-center gap-6 text-sm text-white/60">
            <span className="flex items-center gap-2"><Calendar size={14} aria-hidden="true" /> {post.date}</span>
            <span className="flex items-center gap-2"><Clock size={14} aria-hidden="true" /> {post.readTime}</span>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {post.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              {post.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  <Tag size={12} aria-hidden="true" /> {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <section className="bg-brand-dark py-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-2xl font-black mb-3">{t('ctaTitle')}</h2>
          <p className="text-blue-200 mb-6 max-w-xl mx-auto">{t('ctaSubtitle')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <LocalLink
              href="/catalogo"
              className="inline-flex items-center gap-2 bg-white text-brand-primary font-bold px-6 py-3 rounded-xl hover:bg-gray-100 transition"
            >
              {locale === 'en' ? 'Browse properties' : 'Ver propiedades'} <ArrowRight size={16} aria-hidden="true" />
            </LocalLink>
            <LocalLink
              href="/publicar-inmueble"
              className="inline-flex items-center gap-2 bg-brand-accent text-[var(--on-gold)] font-bold px-6 py-3 rounded-xl hover:brightness-105 transition"
            >
              {t('ctaButton')}
            </LocalLink>
          </div>
        </div>
      </section>
    </article>
  )
}
