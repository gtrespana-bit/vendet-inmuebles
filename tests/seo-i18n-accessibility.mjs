import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { buildPageAlternates, NOINDEX_ROBOTS } from '../src/lib/seo-metadata.ts'
import robots from '../src/app/robots.ts'

test('F11/F12/F23: Planes es bilingüe, explica la conservación de anuncios y no promete equipos multiusuario inexistentes', () => {
  const planes = readFileSync('src/app/[locale]/planes/page.tsx', 'utf8')
  assert.doesNotMatch(planes, /5 usuarios incluidos/i)
  assert.doesNotMatch(planes, /créditos al mes \(compartidos\)/i)
  assert.doesNotMatch(planes, /Publicación y edición masiva/i)
  assert.doesNotMatch(planes, /los anuncios adicionales serán pausados/i)
  assert.match(planes, /se conservan publicados y editables/)
  assert.match(planes, /Plans & Pricing/)
  assert.match(planes, /generateMetadata/)

  const esHome = JSON.parse(readFileSync('src/i18n/dictionaries/es.json', 'utf8')).homePage
  const enHome = JSON.parse(readFileSync('src/i18n/dictionaries/en.json', 'utf8')).homePage
  assert.doesNotMatch(esHome.planAgencyFeature3, /5 usuarios/i)
  assert.doesNotMatch(enHome.planAgencyFeature3, /5 users/i)
})

test('F20: buildPageAlternates genera canonicals propios por ruta/idioma y el layout no fuerza canonical a portada', () => {
  const esPlanes = buildPageAlternates('es', '/planes')
  assert.equal(esPlanes.canonical, 'https://venezuela-inmuebles.online/planes')
  assert.deepEqual(esPlanes.languages, {
    'es-VE': 'https://venezuela-inmuebles.online/planes',
    'en-US': 'https://venezuela-inmuebles.online/en/planes',
    'x-default': 'https://venezuela-inmuebles.online/planes',
  })

  const enPlanes = buildPageAlternates('en', '/planes')
  assert.equal(enPlanes.canonical, 'https://venezuela-inmuebles.online/en/planes')

  const esRoot = buildPageAlternates('es', '/')
  assert.equal(esRoot.canonical, 'https://venezuela-inmuebles.online')
  const enRoot = buildPageAlternates('en', '/')
  assert.equal(enRoot.canonical, 'https://venezuela-inmuebles.online/en')

  const localeLayout = readFileSync('src/app/[locale]/layout.tsx', 'utf8')
  assert.doesNotMatch(localeLayout, /alternates:\s*\{/)

  for (const file of [
    'src/app/[locale]/planes/page.tsx',
    'src/app/[locale]/creditos/layout.tsx',
    'src/app/[locale]/contacto/page.tsx',
    'src/app/[locale]/como-funciona/page.tsx',
    'src/app/[locale]/faq/page.tsx',
    'src/app/[locale]/sobre-nosotros/page.tsx',
    'src/app/[locale]/terminos-y-condiciones/page.tsx',
    'src/app/[locale]/politica-de-privacidad/page.tsx',
    'src/app/[locale]/como-instalar-app/page.tsx',
  ]) {
    const src = readFileSync(file, 'utf8')
    assert.match(src, /buildPageAlternates/, `${file} debe definir canonical/hreflang propios`)
    assert.doesNotMatch(src, /title:.*Venezuela Inmuebles/, `${file} no debe duplicar la marca en title`)
  }
})

test('F21/F22: páginas privadas/pagos/búsqueda tienen noindex, robots cubre /en y sitemap excluye /buscar', () => {
  assert.equal(NOINDEX_ROBOTS.index, false)
  assert.equal(NOINDEX_ROBOTS.follow, false)

  for (const file of [
    'src/app/[locale]/(auth)/layout.tsx',
    'src/app/[locale]/pagos/layout.tsx',
    'src/app/[locale]/dashboard/layout.tsx',
    'src/app/[locale]/admin/layout.tsx',
    'src/app/[locale]/chat/layout.tsx',
    'src/app/[locale]/mi-perfil/layout.tsx',
    'src/app/[locale]/reset-password/layout.tsx',
    'src/app/[locale]/confirm/layout.tsx',
    'src/app/[locale]/offline/layout.tsx',
  ]) {
    assert.ok(existsSync(file), `falta ${file}`)
    assert.match(readFileSync(file, 'utf8'), /NOINDEX_ROBOTS/)
  }

  const buscarMeta = readFileSync('src/app/[locale]/buscar/metadata.ts', 'utf8')
  assert.match(buscarMeta, /index:\s*false/)

  const rules = robots().rules
  const disallow = Array.isArray(rules) ? rules[0].disallow : rules.disallow
  for (const path of ['/pagos', '/en/pagos', '/en/login', '/en/register', '/en/dashboard', '/en/admin', '/buscar', '/en/buscar']) {
    assert.ok(disallow.includes(path), `robots debe bloquear ${path}`)
  }

  const sitemapSrc = readFileSync('src/app/sitemap.ts', 'utf8')
  assert.doesNotMatch(sitemapSrc, /\['\/buscar'/)
  assert.doesNotMatch(sitemapSrc, /lastModified:\s*Date\s*=\s*new Date\(\)/)
})

test('F23/F24/F25: html lang dinámico, LocalLink preserva query/hash, pagos preserva redirect, sin <main> anidado y ficha memoizada', () => {
  const rootLayout = readFileSync('src/app/layout.tsx', 'utf8')
  assert.match(rootLayout, /getLocale/)
  assert.match(rootLayout, /<html lang=\{lang\}>/)

  const localLink = readFileSync('src/components/LocalLink.tsx', 'utf8')
  assert.match(localLink, /serializeQuery/)
  assert.match(localLink, /obj\.hash/)

  const pagos = readFileSync('src/app/[locale]/pagos/page.tsx', 'utf8')
  assert.match(pagos, /params\.toString\(\)/)
  assert.match(pagos, /encodeURIComponent\(returnTo\)/)
  assert.doesNotMatch(pagos, /<main[\s>]/)

  const contacto = readFileSync('src/app/[locale]/contacto/ContactForm.tsx', 'utf8')
  assert.doesNotMatch(contacto, /<main[\s>]/)

  const ficha = readFileSync('src/app/[locale]/inmueble/[id]/page.tsx', 'utf8')
  assert.match(ficha, /cache\(async function getPublicProperty/)
  assert.match(ficha, /isValidUUID\(identifier\)/)
})

test('F26/F27/F29: política de retención veraz, reserva atómica en cola de correo y workflow CI activo', () => {
  const esKept = JSON.parse(readFileSync('src/i18n/dictionaries/es.json', 'utf8')).deleteAccount.keptText
  const enKept = JSON.parse(readFileSync('src/i18n/dictionaries/en.json', 'utf8')).deleteAccount.keptText
  assert.doesNotMatch(esKept, /30 días/i)
  assert.doesNotMatch(enKept, /30 days/i)

  const notif = readFileSync('src/lib/notificaciones-email.ts', 'utf8')
  assert.match(notif, /leaseHasta/)
  assert.match(notif, /\.lte\('programado_para',\s*claimAhora\)/)

  const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
  assert.match(ci, /npm test/)
  assert.match(ci, /npx tsc --noEmit/)
  assert.match(ci, /npm run lint/)
  assert.match(ci, /npm run build/)
})
