import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import robots from '../src/app/robots.ts'
import { CIUDADES_SEO } from '../src/lib/ubicaciones-seo.ts'
import { buildSitemapEntries } from '../src/lib/seo-sitemap.ts'

test('CIUDADES_SEO no contiene slugs duplicados', () => {
  const slugs = CIUDADES_SEO.map((c) => c.slug)
  const unique = new Set(slugs)
  assert.equal(unique.size, slugs.length, 'Cada slug de CIUDADES_SEO debe ser único')
  assert.ok(unique.has('caracas'))
  assert.ok(unique.has('valencia'))
  assert.ok(unique.has('san-diego'))
})

test('Sitemap es autoactualizable (ISR 1h), libre de bloqueos robots.txt, redirecciones, duplicados y ciudades vacías', () => {
  const sitemapRoute = readFileSync('src/app/sitemap.ts', 'utf8')
  assert.match(sitemapRoute, /export const revalidate = 3600/)

  const entries = buildSitemapEntries({
    properties: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'apartamento-en-venta-valencia-el-parral',
        estado: 'Carabobo',
        ciudad: 'Valencia',
        operacion_slug: 'venta',
        actualizado_en: '2026-10-30T12:00:00Z',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        slug: 'townhouse-alquiler-san-diego',
        estado: 'Carabobo',
        ciudad: 'San Diego',
        operacion_slug: 'alquiler',
        creado_en: '2026-10-29T10:00:00Z',
      },
    ],
    sellers: [
      { id: '38b802d2-7f26-4c88-a105-5df28473df1f', slug: 'inmobiliaria-avila', creado_en: '2026-10-01T00:00:00Z' },
    ],
    blogPosts: [
      { slug: 'requisitos-legales-comprar-inmueble-venezuela-saren', lastModified: new Date('2026-10-28') },
    ],
  })

  const urls = entries.map((e) => e.url)
  assert.equal(new Set(urls).size, urls.length, 'No debe haber <loc> duplicados en sitemap.xml')

  // Verificar que ninguna URL del sitemap coincida con un prefijo Disallow de robots.txt
  const rules = robots().rules
  const disallows = Array.isArray(rules) ? rules[0].disallow : rules.disallow
  for (const url of urls) {
    assert.match(url, /^https:\/\/venezuela-inmuebles\.online(\/.*)?$/)
    if (url !== 'https://venezuela-inmuebles.online') {
      assert.doesNotMatch(url, /\/$/, `URL no debe terminar en barra: ${url}`)
    }
    const pathname = new URL(url).pathname
    for (const prefix of disallows) {
      assert.ok(
        !pathname.startsWith(prefix),
        `URL del sitemap ${pathname} está bloqueada por Disallow: ${prefix} en robots.txt`
      )
    }
  }

  // Rutas con redirección o login gate excluidas
  assert.ok(!urls.includes('https://venezuela-inmuebles.online/propiedades'))
  assert.ok(!urls.includes('https://venezuela-inmuebles.online/publicar-inmueble'))

  // Ciudades/estados activos incluidos automáticamente; ciudades vacías excluidas hasta tener inventario
  assert.ok(urls.includes('https://venezuela-inmuebles.online/valencia'))
  assert.ok(urls.includes('https://venezuela-inmuebles.online/en/valencia'))
  assert.ok(urls.includes('https://venezuela-inmuebles.online/san-diego'))
  assert.ok(urls.includes('https://venezuela-inmuebles.online/propiedades/venta/carabobo'))
  assert.ok(urls.includes('https://venezuela-inmuebles.online/propiedades/venta/carabobo/valencia'))
  assert.ok(urls.includes('https://venezuela-inmuebles.online/propiedades/alquiler/carabobo/san-diego'))
  assert.ok(urls.includes('https://venezuela-inmuebles.online/inmueble/apartamento-en-venta-valencia-el-parral'))
  assert.ok(urls.includes('https://venezuela-inmuebles.online/vendedor/inmobiliaria-avila'))
  assert.ok(!urls.includes('https://venezuela-inmuebles.online/maroa'), 'Ciudad sin anuncios no debe inflar el sitemap')

  // Hreflang recíproco con x-default en todas las entradas
  for (const entry of entries) {
    const langs = entry.alternates?.languages
    assert.ok(langs?.['es-VE'], `Falta es-VE en ${entry.url}`)
    assert.ok(langs?.['en-US'], `Falta en-US en ${entry.url}`)
    assert.equal(langs?.['x-default'], langs?.['es-VE'], `x-default debe apuntar a ES en ${entry.url}`)
  }
})

test('Autoridad temática del blog: 100% inmobiliario, metadata exportada y 404 real en slugs inexistentes', () => {
  const blogDir = 'src/content/blog'
  const enDir = path.join(blogDir, 'en')
  const esFiles = readdirSync(blogDir).filter((f) => f.endsWith('.md')).map((f) => path.join(blogDir, f))
  const enFiles = readdirSync(enDir).filter((f) => f.endsWith('.md')).map((f) => path.join(enDir, f))
  const files = [...esFiles, ...enFiles]

  assert.ok(esFiles.length >= 6, 'Deben existir guías inmobiliarias en español')
  assert.ok(enFiles.length >= 6, 'Deben existir las guías traducidas al inglés')

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    assert.doesNotMatch(content, /\b(iphone|laptop|smartwatch|ropa usada|side hustle)\b/i, `Contenido ajeno al sector en ${file}`)
    assert.match(content, /^title:\s*.+/m)
    assert.match(content, /^excerpt:\s*.+/m)
    assert.match(content, /^date:\s*\d{4}-\d{2}-\d{2}/m)
  }

  const blogSlugPage = readFileSync('src/app/[locale]/blog/[slug]/page.tsx', 'utf8')
  assert.match(blogSlugPage, /export function generateStaticParams/)
  assert.match(blogSlugPage, /export async function generateMetadata/)
  assert.match(blogSlugPage, /notFound\(\)/, 'Un slug inexistente debe devolver 404 real')
})

test('Rastreo de archivos: la función aislada de /sitemap.xml se publica con los Markdown del blog', () => {
  const config = readFileSync('next.config.js', 'utf8')
  assert.match(config, /outputFileTracingIncludes\s*:/, 'next.config.js debe declarar `outputFileTracingIncludes`')
  assert.match(
    config,
    /['"]\/sitemap\.xml['"]\s*:\s*\[[^\]]*['"](?:\.\/)?src\/content\/blog\/\*\*?\/\*\.md['"]/s,
    "next.config.js debe incluir el glob de `src/content/blog` (recursivo, para cubrir `en/`) en `outputFileTracingIncludes`"
  )

  // El sitemap resuelve los artículos en tiempo de ejecución vía `src/lib/blog.ts`, así que
  // sin la entrada anterior el rastreo estático no los detecta y desaparecen de producción.
  const blogLib = readFileSync('src/lib/blog.ts', 'utf8')
  assert.match(blogLib, /readdirSync/, '`src/lib/blog.ts` lee el directorio en tiempo de ejecución')

  // Coherencia: cada par es/en produce sus dos URLs, cada una con su propio slug.
  const pairs = buildSitemapEntries({
    properties: [],
    blogPosts: [{ slugEs: 'guia-en-espanol', slugEn: 'english-guide' }],
  })
  const urls = pairs.map((e) => e.url)
  assert.ok(urls.includes('https://venezuela-inmuebles.online/blog/guia-en-espanol'), 'Falta la URL en español')
  assert.ok(urls.includes('https://venezuela-inmuebles.online/en/blog/english-guide'), 'Falta la URL en inglés')

  // Reciprocidad hreflang con slugs distintos por idioma.
  const englishEntry = pairs.find((e) => e.url.endsWith('/en/blog/english-guide'))
  assert.equal(englishEntry.alternates.languages['es-VE'], 'https://venezuela-inmuebles.online/blog/guia-en-espanol')
  assert.equal(englishEntry.alternates.languages['en-US'], 'https://venezuela-inmuebles.online/en/blog/english-guide')
  assert.equal(englishEntry.alternates.languages['x-default'], 'https://venezuela-inmuebles.online/blog/guia-en-espanol')
})

test('Blog bilingüe real: cada guía tiene par es/en, con slug y contenido traducidos', () => {
  const blogDir = 'src/content/blog'
  const enDir = path.join(blogDir, 'en')

  const esFiles = readdirSync(blogDir).filter((f) => f.endsWith('.md')).sort()
  const enFiles = readdirSync(enDir).filter((f) => f.endsWith('.md')).sort()

  assert.ok(esFiles.length >= 6, `Se esperaban al menos 6 guías en español, encontradas ${esFiles.length}`)
  assert.equal(
    enFiles.length,
    esFiles.length,
    'Cada guía en español debe tener su traducción al inglés (mismo número de artículos)'
  )

  const keysOf = (dir, files) =>
    files.map((file) => {
      const raw = readFileSync(path.join(dir, file), 'utf8')
      const key = raw.match(/^translationKey:\s*(.+)$/m)
      assert.ok(key, `Falta translationKey en ${dir}/${file}`)
      return key[1].trim()
    })

  const esKeys = keysOf(blogDir, esFiles)
  const enKeys = keysOf(enDir, enFiles)

  assert.equal(new Set(esKeys).size, esKeys.length, 'Hay `translationKey` duplicados en español')
  assert.equal(new Set(enKeys).size, enKeys.length, 'Hay `translationKey` duplicados en inglés')
  assert.deepEqual([...enKeys].sort(), [...esKeys].sort(), 'Las claves de traducción es/en no coinciden')

  // La URL en inglés debe ser inglesa: no puede reutilizar el slug español.
  for (const file of enFiles) {
    assert.ok(!esFiles.includes(file), `La traducción reutiliza el slug español: ${file}`)
    assert.match(file.replace(/\.md$/, ''), /^[a-z0-9-]+$/, `Slug inválido: ${file}`)
  }

  // Vocabulario inequívocamente español que no debe quedar en la versión inglesa.
  const SPANISH_LEFTOVERS = [
    'inmueble',
    'apartamento',
    'urbanizaci',
    'habitaciones',
    'baños',
    'precio',
    'propietario',
    'arrendamiento',
    'vivienda',
    'inmobiliari',
    'dormitorio',
  ]

  for (const file of enFiles) {
    const raw = readFileSync(path.join(enDir, file), 'utf8')
    const title = raw.match(/^title:\s*(.+)$/m)?.[1] ?? ''
    const excerpt = raw.match(/^excerpt:\s*(.+)$/m)?.[1] ?? ''
    const body = raw.split(/^---\s*$/m).slice(2).join('\n')

    for (const word of SPANISH_LEFTOVERS) {
      // Sensible a mayúsculas a propósito: "Venezuela Inmuebles" es el nombre de la marca.
      assert.doesNotMatch(title, new RegExp(word), `Título sin traducir (${word}) en ${file}`)
      assert.doesNotMatch(excerpt, new RegExp(word), `Entradilla sin traducir (${word}) en ${file}`)
      assert.doesNotMatch(body, new RegExp(word), `Cuerpo sin traducir (${word}) en ${file}`)
    }
  }

  // El JSON-LD debe declarar el idioma real de la página, no `es-VE` fijo.
  const slugPage = readFileSync('src/app/[locale]/blog/[slug]/page.tsx', 'utf8')
  assert.doesNotMatch(slugPage, /inLanguage:\s*'es-VE'/, '`inLanguage` no debe estar fijo en español')
  assert.match(slugPage, /inLanguage:\s*locale === 'en' \? 'en-US' : 'es-VE'/)
})

test('Higiene SEO global: sin títulos duplicados de marca, sin /es/ forzado en tarjetas, JSON-LD en fichas y redirecciones 308', () => {
  const home = readFileSync('src/app/[locale]/page.tsx', 'utf8')
  assert.match(home, /title:\s*\{\s*absolute:\s*t\('metaTitle'\)\s*\}/)
  assert.doesNotMatch(home, /\/buscar\?q=\{search_term_string\}/)
  assert.match(home, /\/catalogo\?q=\{search_term_string\}/)

  const catalogo = readFileSync('src/app/[locale]/catalogo/page.tsx', 'utf8')
  assert.doesNotMatch(catalogo, /\|\s*Venezuela Inmuebles/)

  const mapa = readFileSync('src/app/[locale]/mapa/page.tsx', 'utf8')
  assert.doesNotMatch(mapa, /\|\s*Venezuela Inmuebles/)

  const card = readFileSync('src/components/PropertyCard.tsx', 'utf8')
  assert.doesNotMatch(card, /`\/\$\{locale\}\/inmueble\//)

  const ficha = readFileSync('src/app/[locale]/inmueble/[id]/page.tsx', 'utf8')
  assert.match(ficha, /'@type':\s*'RealEstateListing'/)
  assert.match(ficha, /permanentRedirect\(/)
  assert.doesNotMatch(ficha, /<main[\s>]/)

  const propRoot = readFileSync('src/app/[locale]/propiedades/page.tsx', 'utf8')
  assert.match(propRoot, /permanentRedirect/)
})
