#!/usr/bin/env node
/**
 * Suite de humo E2E sobre el servidor compilado de Next.js (`output: 'standalone'`) — F29.
 * Verifica cabeceras de seguridad, SSR bilingüe (`html lang`, canonicals, hreflang, landmark `<main>`),
 * directivas `noindex`, `robots.txt`, `sitemap.xml`, protección de rutas privadas/API y `/api/health`.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STANDALONE_SERVER = path.join(ROOT, '.next', 'standalone', 'server.js')
const PORT = Number(process.env.SMOKE_PORT || 4019)
const BASE = `http://localhost:${PORT}`

if (!existsSync(STANDALONE_SERVER)) {
  console.error('Falta `.next/standalone/server.js`. Ejecuta `npm run build` antes de `npm run test:smoke`.')
  process.exit(1)
}

// Garantizar que static y public estén disponibles en standalone (idéntico al empaquetado de producción)
const standaloneNextStatic = path.join(ROOT, '.next', 'standalone', '.next', 'static')
if (!existsSync(standaloneNextStatic) && existsSync(path.join(ROOT, '.next', 'static'))) {
  cpSync(path.join(ROOT, '.next', 'static'), standaloneNextStatic, { recursive: true })
}
const standalonePublic = path.join(ROOT, '.next', 'standalone', 'public')
if (!existsSync(standalonePublic) && existsSync(path.join(ROOT, 'public'))) {
  cpSync(path.join(ROOT, 'public'), standalonePublic, { recursive: true })
}

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status > 0) return
    } catch {
      // esperando arranque
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`El servidor standalone no respondió en ${timeoutMs}ms`)
}

const server = spawn(process.execPath, [STANDALONE_SERVER], {
  cwd: path.join(ROOT, '.next', 'standalone'),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: '0.0.0.0',
    PORT: String(PORT),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'ci-service-role-placeholder',
    CRON_SECRET: process.env.CRON_SECRET || 'smoke-cron-secret-long-value',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let serverStderr = ''
server.stderr.on('data', (chunk) => {
  serverStderr += chunk.toString()
})

try {
  await waitForServer(`${BASE}/robots.txt`)

  // 1. Cabeceras de seguridad + SSR Español (/planes)
  {
    const res = await fetch(`${BASE}/planes`)
    assert.equal(res.status, 200, 'GET /planes debe devolver 200')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('x-frame-options'), 'DENY')
    const cspHeader = res.headers.get('content-security-policy') || ''
    assert.match(cspHeader, /default-src 'self'/)
    assert.match(cspHeader, /script-src[^;]*https:\/\/www\.googletagmanager\.com/, 'CSP script-src debe permitir GTM para GA4')
    assert.match(cspHeader, /connect-src[^;]*https:\/\/www\.google-analytics\.com/, 'CSP connect-src debe permitir Google Analytics 4')
    const html = await res.text()
    assert.match(html, /<html[^>]*\blang="es"/, '/planes debe emitir <html lang="es">')
    assert.match(
      html,
      /\/api\/ga\/js\?id=G-BSE60G6TX4/,
      'El HTML SSR debe cargar GA4 first-party (/api/ga/js?id=G-BSE60G6TX4) para evitar timeouts de ISP'
    )
    assert.match(html, /gtag\('consent','default'/, 'El HTML SSR debe inicializar Google Consent Mode v2')

    // Verificar endpoints first-party de GA4 en el servidor compilado
    const gaScriptOk = await fetch(`${BASE}/api/ga/js?id=G-BSE60G6TX4`)
    assert.equal(gaScriptOk.status, 200, 'GET /api/ga/js?id=G-BSE60G6TX4 debe devolver 200')
    assert.match(gaScriptOk.headers.get('content-type') || '', /javascript/)

    const gaScriptForeign = await fetch(`${BASE}/api/ga/js?id=G-OTHER99999`)
    assert.equal(gaScriptForeign.status, 400, 'GET /api/ga/js con otro ID debe rechazarse (evita open-proxy)')

    const gaCollectRes = await fetch(`${BASE}/api/ga/g/collect?v=2&tid=G-BSE60G6TX4&en=page_view`, {
      method: 'POST',
      body: 'en=page_view',
    })
    assert.equal(gaCollectRes.status, 204, 'POST /api/ga/g/collect debe responder 204')
    assert.match(html, /href="https:\/\/venezuela-inmuebles\.online\/planes"/, '/planes debe tener canonical propio')
    assert.match(html, /Escaparate con URL personalizada/)
    const mainMatches = html.match(/<main\b/g) || []
    assert.equal(mainMatches.length, 1, '/planes debe renderizar exactamente un <main>')
  }

  // 2. SSR Inglés (/en/planes)
  {
    const res = await fetch(`${BASE}/en/planes`)
    assert.equal(res.status, 200, 'GET /en/planes debe devolver 200')
    const html = await res.text()
    assert.match(html, /<html[^>]*\blang="en"/, '/en/planes debe emitir <html lang="en">')
    assert.match(html, /href="https:\/\/venezuela-inmuebles\.online\/en\/planes"/)
    assert.match(html, /Plans &amp; Pricing|Plans & Pricing/)
    assert.match(html, /Custom storefront URL/)
  }

  // 3. Directivas noindex en páginas transaccionales/autenticación (/login, /pagos, /confirm, /confirmacion)
  for (const route of ['/login', '/pagos', '/confirm', '/confirmacion']) {
    const res = await fetch(`${BASE}${route}`)
    assert.equal(res.status, 200, `GET ${route} debe devolver 200`)
    const html = await res.text()
    assert.match(html, /noindex/i, `${route} debe incluir meta robots noindex`)
  }

  // 4. robots.txt, sitemap.xml sin bloqueos ni duplicados, portada y blog SEO
  {
    const robotsRes = await fetch(`${BASE}/robots.txt`)
    assert.equal(robotsRes.status, 200)
    const robotsTxt = await robotsRes.text()
    assert.match(robotsTxt, /Disallow: \/en\/admin/)
    assert.match(robotsTxt, /Disallow: \/buscar/)
    const disallowPrefixes = robotsTxt
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.toLowerCase().startsWith('disallow:'))
      .map((l) => l.slice('disallow:'.length).trim())
      .filter(Boolean)

    const sitemapRes = await fetch(`${BASE}/sitemap.xml`)
    assert.equal(sitemapRes.status, 200)
    const sitemapXml = await sitemapRes.text()
    assert.match(sitemapXml, /<urlset/)
    assert.match(sitemapXml, /hreflang="x-default"/)
    assert.doesNotMatch(sitemapXml, /\/buscar</)
    assert.doesNotMatch(sitemapXml, /\/propiedades</)
    assert.doesNotMatch(sitemapXml, /\/publicar-inmueble</)

    const locs = Array.from(sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1])
    assert.ok(locs.length >= 40, `sitemap.xml debe contener rutas base y blog, recibido ${locs.length}`)
    assert.equal(new Set(locs).size, locs.length, 'sitemap.xml no debe tener <loc> duplicados')
    for (const loc of locs) {
      const p = new URL(loc).pathname
      for (const dis of disallowPrefixes) {
        assert.ok(!p.startsWith(dis), `URL ${p} en sitemap.xml choca con Disallow: ${dis}`)
      }
    }

    // Los artículos del blog deben aparecer en el sitemap servido por HTTP, **cada idioma
    // con su propio slug**: `/blog/<slug-es>` y `/en/blog/<slug-en>`.
    // AVISO: esta comprobación por sí sola NO acredita la corrección del rastreo de archivos.
    // El servidor standalone arranca con cwd `.next/standalone`, donde los Markdown también
    // acaban copiados por el rastreo global del servidor (las páginas del blog los leen al
    // compilar), así que el fallo de empaquetado de la función aislada queda enmascarado en
    // local. La prueba concluyente de ese punto es `scripts/verify-sitemap-tracing.mjs`, que
    // inspecciona el `.nft.json` propio de `/sitemap.xml`.
    const blogRoot = path.join(ROOT, 'src', 'content', 'blog')
    const blogEnDir = path.join(blogRoot, 'en')

    const esSlugs = readdirSync(blogRoot).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort()
    const enSlugs = readdirSync(blogEnDir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort()

    assert.ok(esSlugs.length >= 6, `Se esperaban al menos 6 guías en español, encontradas ${esSlugs.length}`)
    assert.equal(enSlugs.length, esSlugs.length, 'Cada guía en español debe tener su traducción al inglés')

    for (const slug of esSlugs) {
      assert.ok(
        locs.includes(`https://venezuela-inmuebles.online/blog/${slug}`),
        `sitemap.xml debe incluir /blog/${slug} (español)`
      )
    }
    for (const slug of enSlugs) {
      assert.ok(
        locs.includes(`https://venezuela-inmuebles.online/en/blog/${slug}`),
        `sitemap.xml debe incluir /en/blog/${slug} (inglés, slug traducido)`
      )
      assert.ok(
        !locs.includes(`https://venezuela-inmuebles.online/blog/${slug}`),
        `El slug inglés ${slug} no debe publicarse bajo /blog/ (español)`
      )
    }

    // Emparejar es/en por `translationKey` para verificar contenido y redirecciones.
    const frontmatterValue = (file, field) =>
      readFileSync(file, 'utf8').match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? ''

    const blogPairs = esSlugs.map((esSlug) => {
      const esFile = path.join(blogRoot, `${esSlug}.md`)
      const key = frontmatterValue(esFile, 'translationKey')
      const enSlug = enSlugs.find(
        (candidate) => frontmatterValue(path.join(blogEnDir, `${candidate}.md`), 'translationKey') === key
      )
      return {
        key,
        esSlug,
        enSlug,
        esTitle: frontmatterValue(esFile, 'title'),
        enTitle: frontmatterValue(path.join(blogEnDir, `${enSlug}.md`), 'title'),
      }
    })

    for (const pair of blogPairs) {
      assert.ok(pair.enSlug, `La guía "${pair.esSlug}" no tiene traducción al inglés`)
      assert.notEqual(pair.enSlug, pair.esSlug, `La traducción de "${pair.esSlug}" reutiliza el slug español`)
    }

    // Portada: sin doble "| Venezuela Inmuebles | Venezuela Inmuebles" y canonical exacto sin barra final
    const homeRes = await fetch(`${BASE}/`)
    assert.equal(homeRes.status, 200)
    const homeHtml = await homeRes.text()
    assert.doesNotMatch(homeHtml, /Venezuela Inmuebles\s*\|\s*Venezuela Inmuebles/)
    assert.match(homeHtml, /rel="canonical"[^>]*href="https:\/\/venezuela-inmuebles\.online"/)
    assert.match(homeHtml, /\/catalogo\?q=\{search_term_string\}/)

    // Blog inmobiliario: canonical propio + JSON-LD Article + 404 real en artículo inexistente
    const postRes = await fetch(`${BASE}/blog/requisitos-legales-comprar-inmueble-venezuela-saren`)
    assert.equal(postRes.status, 200)
    const postHtml = await postRes.text()
    assert.match(postHtml, /rel="canonical"[^>]*href="https:\/\/venezuela-inmuebles\.online\/blog\/requisitos-legales-comprar-inmueble-venezuela-saren"/)
    assert.match(postHtml, /"@type":"Article"/)

    const missingPostRes = await fetch(`${BASE}/blog/articulo-inexistente-auditoria-seo`)
    assert.equal(missingPostRes.status, 404, 'Artículo de blog inexistente debe devolver 404 real (no soft-404)')

    // Cada guía se sirve íntegramente en su idioma, con su propio slug, y la URL antigua
    // en inglés (que reutilizaba el slug español) redirige 308 a la traducida.
    for (const pair of blogPairs) {
      const esRes = await fetch(`${BASE}/blog/${pair.esSlug}`)
      assert.equal(esRes.status, 200, `GET /blog/${pair.esSlug} debe devolver 200`)
      const esHtml = await esRes.text()
      assert.match(esHtml, /<html[^>]*\blang="es"/, `/blog/${pair.esSlug} debe servirse en español`)
      assert.ok(esHtml.includes(pair.esTitle), `/blog/${pair.esSlug} debe mostrar su título en español`)

      const enRes = await fetch(`${BASE}/en/blog/${pair.enSlug}`)
      assert.equal(enRes.status, 200, `GET /en/blog/${pair.enSlug} debe devolver 200`)
      const enHtml = await enRes.text()
      assert.match(enHtml, /<html[^>]*\blang="en"/, `/en/blog/${pair.enSlug} debe servirse en inglés`)
      assert.ok(enHtml.includes(pair.enTitle), `/en/blog/${pair.enSlug} debe mostrar su título en inglés`)
      assert.ok(
        !enHtml.includes(pair.esTitle),
        `/en/blog/${pair.enSlug} no debe incluir el título en español: "${pair.esTitle}"`
      )
      assert.match(
        enHtml,
        /"inLanguage":"en-US"/,
        `El JSON-LD de /en/blog/${pair.enSlug} debe declarar "inLanguage":"en-US"`
      )

      const legacyRes = await fetch(`${BASE}/en/blog/${pair.esSlug}`, { redirect: 'manual' })
      assert.equal(legacyRes.status, 308, `GET /en/blog/${pair.esSlug} (slug antiguo) debe devolver 308`)
      assert.match(
        legacyRes.headers.get('location') || '',
        new RegExp(`/en/blog/${pair.enSlug}$`),
        `El slug antiguo /en/blog/${pair.esSlug} debe redirigir a /en/blog/${pair.enSlug}`
      )
    }

    // /propiedades redirige permanentemente (308) a /propiedades/venta
    const propRedirect = await fetch(`${BASE}/propiedades`, { redirect: 'manual' })
    assert.equal(propRedirect.status, 308)
    assert.match(propRedirect.headers.get('location') || '', /\/propiedades\/venta$/)
  }

  // 5. 404 real en slugs inválidos, redirección de rutas privadas y bloqueo 401 en APIs autenticadas/admin/cron
  {
    const unknownSlug = await fetch(`${BASE}/xyz-slug-inexistente-auditoria`, { redirect: 'manual' })
    assert.equal(unknownSlug.status, 404, 'Slug desconocido de un segmento debe devolver 404 real')

    const dashEs = await fetch(`${BASE}/dashboard`, { redirect: 'manual' })
    const dashHtml = await dashEs.text()
    assert.ok(
      dashEs.status === 307 || (dashHtml.includes('NEXT_REDIRECT') && dashHtml.includes('/login')),
      '/dashboard sin sesión debe redirigir a /login'
    )
    assert.ok(!dashHtml.includes('dashboard-tabs'), '/dashboard no debe filtrar contenido privado sin sesión')

    const adminEn = await fetch(`${BASE}/en/admin`, { redirect: 'manual' })
    const adminHtml = await adminEn.text()
    assert.ok(
      adminEn.status === 307 || (adminHtml.includes('NEXT_REDIRECT') && adminHtml.includes('/en/login')),
      '/en/admin sin sesión debe redirigir a /en/login'
    )

    const escaparateUnauth = await fetch(`${BASE}/api/perfil/escaparate`)
    assert.equal(escaparateUnauth.status, 401)

    const adminApiUnauth = await fetch(`${BASE}/api/admin/auditoria`)
    assert.equal(adminApiUnauth.status, 401)

    const creditsUnauth = await fetch(`${BASE}/api/comprar-creditos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paquete: '5' }),
    })
    assert.equal(creditsUnauth.status, 401)

    // F09: query param ?secret=... jamás debe autorizar el cron
    const cronQueryLeak = await fetch(`${BASE}/api/cron/notificaciones-email?secret=smoke-cron-secret-long-value`)
    assert.equal(cronQueryLeak.status, 401)
  }

  // 6. Health check (/api/health) sin exposición de secretos y con Cache-Control: no-store
  {
    const healthRes = await fetch(`${BASE}/api/health`)
    assert.ok(
      healthRes.status === 200 || healthRes.status === 503,
      `GET /api/health debe responder 200 o 503, recibido ${healthRes.status}`
    )
    assert.equal(healthRes.headers.get('cache-control'), 'no-store')
    const body = await healthRes.json()
    assert.equal(body?.checks?.app, 'up')
    assert.ok(typeof body?.timestamp === 'string')
  }

  console.log('Smoke suite E2E (standalone server): OK (todas las verificaciones superadas)')
} catch (err) {
  console.error('Fallo en smoke suite E2E:', err)
  if (serverStderr) console.error('stderr del servidor:\n', serverStderr.slice(-2000))
  process.exitCode = 1
} finally {
  server.kill('SIGTERM')
}
