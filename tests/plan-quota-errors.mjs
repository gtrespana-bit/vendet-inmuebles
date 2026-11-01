import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isPlanQuotaError, planQuotaResponse, PLAN_QUOTA_CODE } from '../src/lib/quota-errors.ts'

const quotaMessage = 'Límite de publicaciones alcanzado para el plan gratuita'

test('el trigger 012 se convierte en 409 con el motivo legible y un código estable', () => {
  const error = { code: '23514', message: quotaMessage }
  assert.equal(isPlanQuotaError(error), true)
  assert.deepEqual(planQuotaResponse(error.message), {
    status: 409,
    body: { error: quotaMessage, code: PLAN_QUOTA_CODE },
  })
  assert.equal(planQuotaResponse(null).status, 409)
  assert.equal(planQuotaResponse('   ').body.error, 'Límite del plan alcanzado')
  assert.equal(planQuotaResponse('El plan gratuita permite 8 fotos').body.error, 'El plan gratuita permite 8 fotos')
})

test('los fallos que no son de cupo conservan su comportamiento anterior', () => {
  for (const error of [{ code: '42501', message: 'permission denied' }, { code: undefined }, null, undefined]) {
    assert.equal(isPlanQuotaError(error), false)
  }
  // 23503 (cuenta sin perfil) y 23505 (duplicado) no son límites de plan.
  assert.equal(isPlanQuotaError({ code: '23503' }), false)
  assert.equal(isPlanQuotaError({ code: '23505' }), false)
})

test('todas las rutas que pueden tocar los triggers responden con el código de cupo', () => {
  const writers = [
    'src/app/api/properties/route.ts',
    'src/app/api/publicar/route.ts',
    'src/app/api/admin/moderar-producto/route.ts',
    'src/app/api/admin/toggle-activo/route.ts',
  ]
  for (const file of writers) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /isPlanQuotaError/, `${file} debe usar el mapeo compartido`)
    assert.doesNotMatch(source, /'23514'/, `${file} no debe repetir el SQLSTATE`)
  }
})

test('la aplicación y la base de datos desempatan el plan efectivo igual', () => {
  const migration = readFileSync('supabase/migrations/012_limites_publicacion_en_bd.sql', 'utf8')
  assert.match(migration, /ORDER BY s\.created_at DESC, s\.id DESC/)
  const plans = readFileSync('src/lib/plans.ts', 'utf8')
  assert.match(plans, /\.order\('created_at', \{ ascending: false \}\)\s*\n\s*\.order\('id', \{ ascending: false \}\)/)
})
