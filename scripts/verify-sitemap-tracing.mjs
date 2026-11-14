#!/usr/bin/env node
/**
 * Verifica que la función aislada de `/sitemap.xml` se publique con los Markdown
 * del blog incluidos en su rastreo de archivos (output file tracing).
 *
 * Contexto
 * --------
 * `src/app/sitemap.ts` construye las entradas del blog leyendo el directorio en
 * tiempo de ejecución con `fs.readdirSync(path.join(process.cwd(), 'src/content/blog'))`.
 * Esa dependencia es dinámica: el rastreador de Next no la detecta de forma
 * estática, así que la función serverless se empaquetaba sin `src/content/blog/*.md`,
 * `readBlogPosts()` devolvía `[]` y las guías desaparecían de `sitemap.xml` en
 * producción (comprobado en https://venezuela-inmuebles.online/sitemap.xml).
 *
 * La solución es declarar `'/sitemap.xml': ['./src/content/blog/*.md']` en
 * `outputFileTracingIncludes` (next.config.js). Este script demuestra, sobre el
 * build real, que los Markdown acaban dentro del paquete de la ruta.
 *
 * Uso: `npm run build && node scripts/verify-sitemap-tracing.mjs`
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const NEXT_DIR = path.join(ROOT, '.next')
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog')
const CONFIG_FILE = path.join(ROOT, 'next.config.js')

/** Directorio de salida standalone (`output: 'standalone'`), si se generó. */
const STANDALONE_DIR = path.join(NEXT_DIR, 'standalone')

function fail(message) {
  console.error(`\n✗ verify-sitemap-tracing: ${message}\n`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 1. Inventario real de artículos del blog
// ---------------------------------------------------------------------------
if (!existsSync(BLOG_DIR)) {
  fail(`No existe el directorio del blog: ${BLOG_DIR}`)
}

const blogFiles = readdirSync(BLOG_DIR)
  .filter((file) => file.endsWith('.md'))
  .sort()

if (blogFiles.length === 0) {
  fail(`No hay Markdown en ${BLOG_DIR}; nada que verificar.`)
}

const blogSlugs = blogFiles.map((file) => file.replace(/\.md$/, ''))

// ---------------------------------------------------------------------------
// 2. La declaración en next.config.js debe seguir presente
// ---------------------------------------------------------------------------
if (!existsSync(CONFIG_FILE)) {
  fail(`No se encontró ${CONFIG_FILE}`)
}
const configSource = readFileSync(CONFIG_FILE, 'utf8')
assert.match(
  configSource,
  /outputFileTracingIncludes\s*:/,
  'next.config.js debe declarar `outputFileTracingIncludes`'
)
assert.match(
  configSource,
  /['"]\/sitemap\.xml['"]\s*:\s*\[[^\]]*['"](?:\.\/)?src\/content\/blog\/\*\.md['"]/s,
  "next.config.js debe declarar `'/sitemap.xml': ['./src/content/blog/*.md']` en `outputFileTracingIncludes`"
)

// ---------------------------------------------------------------------------
// 3. El build debe existir
// ---------------------------------------------------------------------------
if (!existsSync(NEXT_DIR)) {
  fail('No existe `.next`. Ejecuta `npm run build` antes de este verificador.')
}

/**
 * Recorre un directorio devolviendo las rutas absolutas que cumplan `predicate`.
 * Se limita la profundidad para no arrastrarse por `node_modules` del build.
 */
function walk(dir, predicate, depth = 0, found = []) {
  if (depth > 6 || !existsSync(dir)) return found
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    let stats
    try {
      stats = statSync(full)
    } catch {
      continue
    }
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'cache') continue
      walk(full, predicate, depth + 1, found)
    } else if (predicate(full)) {
      found.push(full)
    }
  }
  return found
}

/**
 * Rutas absolutas de los archivos rastreados. El rastreador escribe rutas relativas
 * al propio `.nft.json` (p. ej. `../../../../src/content/blog/x.md`), así que hay que
 * resolverlas contra el directorio del manifiesto antes de compararlas.
 */
function readTracedFiles(nftPath) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(nftPath, 'utf8'))
  } catch {
    return []
  }
  const files = Array.isArray(parsed?.files) ? parsed.files : []
  return files
    .map((entry) => (typeof entry === 'string' ? entry : entry?.path || ''))
    .filter(Boolean)
    .map((entry) => path.resolve(path.dirname(nftPath), entry))
}

// 3a. Rastreo de la ruta `/sitemap.xml` (archivos .nft.json generados por Next)
const sitemapTraceFiles = walk(NEXT_DIR, (full) => full.endsWith('.nft.json') && /sitemap/i.test(full))

// Tanto el rastreo del build (`.next/server/...`) como el de la salida standalone
// (`.next/standalone/.next/server/...`) son pruebas válidas de que los Markdown viajan.
const BLOG_PATH_PATTERN = /(?:^|\/)src\/content\/blog\/[^/\\]+\.md$/

const tracedBlogFiles = new Set()
for (const tracePath of sitemapTraceFiles) {
  for (const absolute of readTracedFiles(tracePath)) {
    const relative = path.relative(ROOT, absolute).replace(/\\/g, '/')
    if (BLOG_PATH_PATTERN.test(relative) || BLOG_PATH_PATTERN.test(`/${relative}`)) {
      tracedBlogFiles.add(path.basename(absolute))
    }
  }
}

// 3b. Copia materializada en la salida standalone — SOLO INFORMATIVA.
// No sirve como prueba: los Markdown también llegan ahí a través del rastreo global
// del servidor (`next-server.js.nft.json`), porque las páginas del blog
// (`src/app/[locale]/blog/[slug]/page.tsx`) los leen en tiempo de compilación.
// Se comprobó que `.next/standalone/src/content/blog/` sigue existiendo incluso
// SIN la entrada de `outputFileTracingIncludes`; la prueba concluyente es el rastreo
// propio de la ruta (3a), que es el artefacto que Vercel empaqueta por función.
const standaloneBlogDir = path.join(STANDALONE_DIR, 'src', 'content', 'blog')
const copiedBlogFiles = new Set()
if (existsSync(standaloneBlogDir)) {
  for (const file of readdirSync(standaloneBlogDir)) {
    if (file.endsWith('.md')) copiedBlogFiles.add(file)
  }
}

// ---------------------------------------------------------------------------
// 4. Resultado: cada artículo del blog debe estar en el paquete
// ---------------------------------------------------------------------------
const missingFromTrace = blogFiles.filter((file) => !tracedBlogFiles.has(file))

// El rastreo de la ruta es la fuente de verdad: si el `.nft.json` de `/sitemap.xml` no
// menciona los Markdown, la función aislada se publicará sin ellos aunque quede una
// copia residual en `.next/standalone` procedente del rastreo global del servidor.
if (missingFromTrace.length > 0) {
  fail(
    [
      'El rastreo de archivos de `/sitemap.xml` no menciona todos los Markdown del blog.',
      `  · Faltan: ${missingFromTrace.join(', ')}`,
      `  · Trazas revisadas: ${sitemapTraceFiles.map((p) => path.relative(ROOT, p)).join(', ') || '(ninguna)'}`,
      '',
      'Sin el rastreo correcto, `readBlogPosts()` devolverá `[]` en producción y los',
      'artículos desaparecerán de https://venezuela-inmuebles.online/sitemap.xml.',
    ].join('\n')
  )
}

console.log(
  [
    '✓ verify-sitemap-tracing: los Markdown del blog están incluidos en el paquete de `/sitemap.xml`',
    `  · Artículos verificados (${blogFiles.length}): ${blogSlugs.join(', ')}`,
    `  · Traza(s) revisada(s): ${sitemapTraceFiles.map((p) => path.relative(ROOT, p)).join(', ') || '(ninguna)'}`,
    existsSync(STANDALONE_DIR)
      ? `  · Informativo: .next/standalone/src/content/blog copia ${copiedBlogFiles.size}/${blogFiles.length} (no concluyente por sí solo)`
      : '  · Sin salida standalone: se verificó solo el rastreo (.nft.json)',
  ].join('\n')
)
