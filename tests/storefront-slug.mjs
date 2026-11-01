import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  canPlanUseCustomStorefront,
  isUuidIdentifier,
  normalizeStorefrontSlug,
  validateStorefrontSlug,
} from '../src/lib/storefront-slug.ts'

test('F12: normalizeStorefrontSlug y validateStorefrontSlug aplican reglas seguras de URL personalizada', () => {
  assert.equal(normalizeStorefrontSlug('  Inmobiliaria Ávila C.A. '), 'inmobiliaria-avila-c-a')
  assert.deepEqual(validateStorefrontSlug('Inmobiliaria Ávila'), {
    valid: true,
    normalized: 'inmobiliaria-avila',
  })

  // Reservados, muy cortos y UUIDs son rechazados
  assert.equal(validateStorefrontSlug('admin').valid, false)
  assert.equal(validateStorefrontSlug('admin').reason, 'reserved')
  assert.equal(validateStorefrontSlug('ab').valid, false)
  assert.equal(validateStorefrontSlug('ab').reason, 'length')
  assert.equal(validateStorefrontSlug('550e8400-e29b-41d4-a716-446655440000').valid, false)
  assert.equal(validateStorefrontSlug('550e8400-e29b-41d4-a716-446655440000').reason, 'uuid')
  assert.equal(isUuidIdentifier('550e8400-e29b-41d4-a716-446655440000'), true)
  assert.equal(isUuidIdentifier('inmobiliaria-avila'), false)
})

test('F12: URL personalizada solo se habilita en planes Profesional e Inmobiliaria y está conectada a BD, API, Dashboard y escaparate', () => {
  assert.equal(canPlanUseCustomStorefront('gratuita'), false)
  assert.equal(canPlanUseCustomStorefront('profesional'), true)
  assert.equal(canPlanUseCustomStorefront('agencia'), true)

  const migration = readFileSync('supabase/migrations/017_escaparate_slug_profesional.sql', 'utf8')
  assert.match(migration, /ADD COLUMN IF NOT EXISTS slug text/)
  assert.match(migration, /idx_perfiles_slug_unique/)
  assert.match(migration, /CREATE OR REPLACE VIEW public\.vw_perfiles_publicos/)
  assert.match(migration, /telefono_visible_anuncio/)

  const api = readFileSync('src/app/api/perfil/escaparate/route.ts', 'utf8')
  assert.match(api, /canPlanUseCustomStorefront/)
  assert.match(api, /validateStorefrontSlug/)

  const sellerPage = readFileSync('src/app/[locale]/vendedor/[id]/page.tsx', 'utf8')
  assert.match(sellerPage, /profileQuery\.eq\('slug', sellerParam\.toLowerCase\(\)\)/)
  assert.doesNotMatch(sellerPage, /<main className="seller-page"/)
})
