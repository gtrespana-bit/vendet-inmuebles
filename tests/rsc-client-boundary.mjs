import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { isOptimizableImageSrc } from '../src/lib/image-src.ts'
import { diagnosticarCausaProbable } from '../src/lib/error-diagnostics.ts'

function walkTsFiles(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walkTsFiles(full, out)
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(full)
  }
  return out
}

function hasUseClientDirective(source) {
  const stripped = source.replace(/^\s*(\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*/, '')
  return /^['"]use client['"]/.test(stripped)
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

test('RSC Guard: ningún Server Component ni módulo de servidor invoca funciones exportadas desde archivos "use client"', () => {
  const files = walkTsFiles('src')
  const clientMap = new Map()

  for (const f of files) {
    clientMap.set(path.resolve(f), hasUseClientDirective(readFileSync(f, 'utf8')))
  }

  function resolveModule(fromFile, spec) {
    let base
    if (spec.startsWith('@/')) {
      base = path.resolve('src', spec.slice(2))
    } else if (spec.startsWith('.')) {
      base = path.resolve(path.dirname(fromFile), spec)
    } else {
      return null
    }
    for (const cand of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
    ]) {
      if (clientMap.has(cand)) return cand
    }
    return null
  }

  const violations = []

  for (const f of files) {
    const abs = path.resolve(f)
    if (clientMap.get(abs)) continue // El módulo llamador ya es Client Component / hook cliente

    const raw = readFileSync(f, 'utf8')
    const code = stripComments(raw)
    const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(code)) !== null) {
      const clause = match[1].trim()
      if (clause.startsWith('type ')) continue

      const target = resolveModule(f, match[2])
      if (!target || !clientMap.get(target)) continue

      const importedIdentifiers = []
      const defaultPart = clause.split('{')[0].replace(/,\s*$/, '').trim()
      if (defaultPart && !defaultPart.startsWith('*') && !defaultPart.startsWith('type ')) {
        importedIdentifiers.push(defaultPart)
      }

      const namedMatch = clause.match(/\{([\s\S]*?)\}/)
      if (namedMatch) {
        for (const item of namedMatch[1].split(',')) {
          const trimmed = item.trim()
          if (!trimmed || trimmed.startsWith('type ')) continue
          const localName = trimmed.split(/\s+as\s+/).pop().trim()
          if (localName) importedIdentifiers.push(localName)
        }
      }

      const bodyWithoutImports = code.replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?/g, '')
      for (const ident of importedIdentifiers) {
        const callPattern = new RegExp(`(?<!<)\\b${ident}\\s*\\(`)
        if (callPattern.test(bodyWithoutImports)) {
          violations.push(
            `${f} invoca ${ident}() exportado desde el módulo cliente ${path.relative('.', target)}`,
          )
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Violaciones RSC detectadas (causarían crash 500 en SSR):\n${violations.join('\n')}`,
  )
})

test('image-src: es isomórfico (sin "use client") y valida estrictamente dominios de next/image', () => {
  const imageSrcSource = readFileSync('src/lib/image-src.ts', 'utf8')
  assert.equal(hasUseClientDirective(imageSrcSource), false)

  assert.equal(isOptimizableImageSrc('/sinimagen.webp'), true)
  assert.equal(isOptimizableImageSrc('/brand-mark.svg'), false)
  assert.equal(isOptimizableImageSrc('//evil.example.com/a.jpg'), false)
  assert.equal(isOptimizableImageSrc('https://pub-d212837165c545e3956251da001fa37a.r2.dev/propiedades/foto.webp'), true)
  assert.equal(isOptimizableImageSrc('https://quxbqmqwiacfwbpqioev.supabase.co/storage/v1/object/public/inmuebles/a.jpg'), true)
  assert.equal(isOptimizableImageSrc('https://quxbqmqwiacfwbpqioev.supabase.co/rest/v1/productos'), false)
  assert.equal(isOptimizableImageSrc('https://otro-proyecto.supabase.co/storage/v1/object/public/a.jpg'), false)
  assert.equal(isOptimizableImageSrc('https://images.unsplash.com/photo-1234?w=800'), true)
  assert.equal(isOptimizableImageSrc('https://cdn.externo-no-autorizado.com/casa.jpg'), false)
  assert.equal(isOptimizableImageSrc('http://images.unsplash.com/photo-1234'), false)
  assert.equal(isOptimizableImageSrc('data:image/png;base64,AAAA'), false)
  assert.equal(isOptimizableImageSrc('blob:https://venezuela-inmuebles.online/123'), false)
  assert.equal(isOptimizableImageSrc(''), false)
  assert.equal(isOptimizableImageSrc(null), false)
  assert.equal(isOptimizableImageSrc(undefined), false)

  const propertyCard = readFileSync('src/components/PropertyCard.tsx', 'utf8')
  const landingCiudad = readFileSync('src/app/[locale]/[ciudad]/LandingCiudad.tsx', 'utf8')
  assert.match(propertyCard, /from '@\/lib\/image-src'/)
  assert.doesNotMatch(propertyCard, /from '@\/components\/PropertyGallery'/)
  assert.match(landingCiudad, /from '@\/lib\/image-src'/)
  assert.doesNotMatch(landingCiudad, /from '@\/components\/PropertyGallery'/)
})

test('error-diagnostics: clasifica errores de frontera RSC y dominios de next/image', () => {
  const diagRsc = diagnosticarCausaProbable({
    origen: 'servidor',
    nombre: 'Error',
    mensaje:
      "Attempted to call isOptimizableImageSrc() from the server but isOptimizableImageSrc is on the client. It's not possible to invoke a client function from the server.",
    codigo_error: 'DIGEST:296716795',
  })
  assert.match(diagRsc.titulo, /Frontera Servidor\/Cliente de React \(RSC\)/)

  const diagImg = diagnosticarCausaProbable({
    origen: 'servidor',
    nombre: 'Error',
    mensaje: 'Invalid src prop (https://example.org/x.jpg) on `next/image`, hostname "example.org" is not configured under images in your `next.config.js`',
  })
  assert.match(diagImg.titulo, /Dominio de imagen externo/)
})
