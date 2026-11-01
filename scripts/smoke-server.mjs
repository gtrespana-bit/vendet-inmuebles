#!/usr/bin/env node
/**
 * Suite de humo E2E sobre el servidor compilado de Next.js (`output: 'standalone'`) — F29.
 * Verifica cabeceras de seguridad, SSR bilingüe (`html lang`, canonicals, hreflang, landmark `<main>`),
 * directivas `noindex`, `robots.txt`, `sitemap.xml`, protección de rutas privadas/API y `/api/health`.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
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
    assert.match(res.headers.get('content-security-policy') || '', /default-src 'self'/)
    const html = await res.text()
    assert.match(html, /<html[^>]*\blang="es"/, '/planes debe emitir <html lang="es">')
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

  // 3. Directivas noindex en páginas transaccionales/autenticación (/login, /pagos)
  for (const route of ['/login', '/pagos']) {
    const res = await fetch(`${BASE}${route}`)
    assert.equal(res.status, 200, `GET ${route} debe devolver 200`)
    const html = await res.text()
    assert.match(html, /noindex/i, `${route} debe incluir meta robots noindex`)
  }

  // 4. robots.txt y sitemap.xml
  {
    const robotsRes = await fetch(`${BASE}/robots.txt`)
    assert.equal(robotsRes.status, 200)
    const robotsTxt = await robotsRes.text()
    assert.match(robotsTxt, /Disallow: \/en\/admin/)
    assert.match(robotsTxt, /Disallow: \/buscar/)

    const sitemapRes = await fetch(`${BASE}/sitemap.xml`)
    assert.equal(sitemapRes.status, 200)
    const sitemapXml = await sitemapRes.text()
    assert.match(sitemapXml, /<urlset/)
    assert.doesNotMatch(sitemapXml, /\/buscar</)
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
