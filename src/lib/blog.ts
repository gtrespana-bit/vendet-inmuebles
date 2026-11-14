import 'server-only'
import fs from 'fs'
import path from 'path'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'
import { buildPageAlternates } from './seo-metadata'

/**
 * Carga del blog inmobiliario desde el sistema de archivos, con soporte de idioma real.
 *
 * Cada idioma vive en su propio directorio y tiene sus **propios slugs**, traducidos:
 *
 *   src/content/blog/<slug-en-español>.md      -> español   (/blog/<slug-en-español>)
 *   src/content/blog/en/<slug-en-ingles>.md    -> inglés    (/en/blog/<slug-en-ingles>)
 *
 * El nexo entre ambas versiones es el campo `translationKey` del frontmatter, que debe
 * coincidir en el par. Con él se construyen los hreflang recíprocos (`es-VE` <-> `en-US`)
 * y las redirecciones 308 de los slugs antiguos en inglés (que antes reutilizaban el slug
 * español y servían el artículo en español bajo una URL `/en/blog/...`).
 */
export type BlogLocale = (typeof routing.locales)[number]

const BLOG_ROOT = path.join(process.cwd(), 'src/content/blog')
const BLOG_DIR: Record<BlogLocale, string> = {
  es: BLOG_ROOT,
  en: path.join(BLOG_ROOT, 'en'),
}

const SLUG_PATTERN = /^[a-z0-9-]+$/
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

export function blogDirForLocale(locale: string): string {
  return locale === 'en' ? BLOG_DIR.en : BLOG_DIR.es
}

export interface BlogPostMeta {
  slug: string
  locale: BlogLocale
  /** Identificador compartido por las dos traducciones de un mismo artículo. */
  translationKey: string
  title: string
  excerpt: string
  date: string
  readTime: string
  tags: string[]
  category: string
  icon: string
  featured: boolean
}

export interface BlogPost extends BlogPostMeta {
  content: string
  ogImage?: string
}

function cleanFrontmatterValue(raw: string | undefined, fallback = ''): string {
  if (!raw) return fallback
  return raw.trim().replace(/^["']|["']$/g, '').trim()
}

function parseFrontmatter(raw: string): { fields: Record<string, string>; content: string } | null {
  const match = raw.match(FRONTMATTER_PATTERN)
  if (!match) return null

  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex <= 0) continue
    fields[line.slice(0, colonIndex).trim()] = cleanFrontmatterValue(line.slice(colonIndex + 1))
  }

  return { fields, content: match[2].trim() }
}

export function readBlogPost(slug: string, locale: string): BlogPost | null {
  if (!slug || !SLUG_PATTERN.test(slug)) return null

  const filePath = path.join(blogDirForLocale(locale), `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  let parsed: ReturnType<typeof parseFrontmatter>
  try {
    parsed = parseFrontmatter(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
  if (!parsed) return null

  const { fields, content } = parsed
  const english = locale === 'en'

  return {
    slug,
    locale: english ? 'en' : 'es',
    translationKey: fields.translationKey || slug,
    title: fields.title || slug,
    excerpt: fields.excerpt || '',
    date: fields.date || '',
    readTime: fields.readTime || (english ? '6 min read' : '6 min'),
    tags: fields.tags ? fields.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    category: fields.category || (english ? 'Real Estate Guide' : 'Guía Inmobiliaria'),
    icon: fields.icon || '🏠',
    featured: fields.featured === 'true',
    content,
    ...(fields.ogImage ? { ogImage: fields.ogImage } : {}),
  }
}

/** Slugs publicados en un idioma (orden alfabético, estable entre builds). */
export function listBlogSlugs(locale: string): string[] {
  const dir = blogDirForLocale(locale)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.replace(/\.md$/, ''))
    .sort()
}

/** Artículos de un idioma: destacados primero y, después, del más reciente al más antiguo. */
export function listBlogPosts(locale: string): BlogPostMeta[] {
  return listBlogSlugs(locale)
    .map((slug) => readBlogPost(slug, locale))
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      return b.date.localeCompare(a.date)
    })
}

export interface BlogTranslationPair {
  translationKey: string
  es: string
  en: string
  lastModified?: Date
}

function parseDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * Pares es/en completos, indexados por `translationKey`.
 * Un artículo sin traducción queda fuera: así el sitemap nunca emite un hreflang
 * roto ni una URL `/en/blog/...` que devolvería 404.
 */
export function getBlogTranslationPairs(): BlogTranslationPair[] {
  const byKey = new Map<string, BlogTranslationPair>()

  for (const locale of ['es', 'en'] as const) {
    for (const slug of listBlogSlugs(locale)) {
      const post = readBlogPost(slug, locale)
      if (!post) continue
      const pair = byKey.get(post.translationKey) ?? {
        translationKey: post.translationKey,
        es: '',
        en: '',
      }
      pair[locale] = post.slug
      const modified = parseDate(post.date)
      if (modified && (!pair.lastModified || modified > pair.lastModified)) {
        pair.lastModified = modified
      }
      byKey.set(post.translationKey, pair)
    }
  }

  return Array.from(byKey.values())
    .filter((pair) => Boolean(pair.es) && Boolean(pair.en))
    .sort((a, b) => a.translationKey.localeCompare(b.translationKey))
}

/** Artículos publicados en un idioma que aún no tienen traducción (debería ser siempre 0). */
export function listUntranslatedSlugs(): string[] {
  const paired = new Set(getBlogTranslationPairs().flatMap((pair) => [pair.es, pair.en]))
  return routing.locales.flatMap((locale) =>
    listBlogSlugs(locale).filter((slug) => !paired.has(slug))
  )
}

/**
 * Slugs que deben generarse de forma estática para un idioma.
 *
 * En inglés se añaden además los slugs antiguos (heredados del español) para que sigan
 * existiendo como rutas estáticas y poder servir una redirección 308 permanente a la nueva
 * URL en inglés, en lugar de un 404 que perdería la indexación conseguida.
 */
export function listBlogStaticSlugs(locale: string): string[] {
  const own = listBlogSlugs(locale)
  if (locale !== 'en') return own

  const legacy = getBlogTranslationPairs().map((pair) => pair.es)
  return Array.from(new Set([...own, ...legacy])).sort()
}

/**
 * Si `slug` es un slug antiguo del blog en inglés, devuelve el slug inglés actual.
 * Se usa para redirigir de forma permanente las URL ya indexadas.
 */
export function resolveLegacyBlogSlug(slug: string, locale: string): string | null {
  if (locale !== 'en') return null
  const pair = getBlogTranslationPairs().find((candidate) => candidate.es === slug)
  return pair?.en && pair.en !== slug ? pair.en : null
}

/** Prefijo de idioma para rutas internas (`''` en español, `'/en'` en inglés). */
export function localePrefix(locale: string): string {
  return locale === 'en' ? '/en' : ''
}

/**
 * Canonical y hreflang de un artículo, usando el slug **de cada idioma**.
 *
 * Antes el inglés reutilizaba el slug español, así que `/en/blog/<slug-es>` anunciaba
 * `en-US` sobre contenido en español. Ahora `es-VE` y `en-US` apuntan cada uno a su URL
 * real y `x-default` a la española. Si un artículo aún no tiene traducción solo se
 * declara su propio idioma, en lugar de inventar un par que no existe.
 */
export function buildBlogPostAlternates(
  post: BlogPostMeta,
  locale: string
): NonNullable<Metadata['alternates']> {
  const pair = getBlogTranslationPairs().find((candidate) => candidate.translationKey === post.translationKey)
  if (!pair) {
    const own = buildPageAlternates(locale, `/blog/${post.slug}`)
    const ownUrl = String(own.canonical)
    return { canonical: ownUrl, languages: { [locale === 'en' ? 'en-US' : 'es-VE']: ownUrl } }
  }

  const esAlt = buildPageAlternates('es', `/blog/${pair.es}`)
  const enAlt = buildPageAlternates('en', `/blog/${pair.en}`)
  const esUrl = String(esAlt.canonical)
  const enUrl = String(enAlt.canonical)

  return {
    canonical: locale === 'en' ? enUrl : esUrl,
    languages: {
      'es-VE': esUrl,
      'en-US': enUrl,
      'x-default': esUrl,
    },
  }
}
