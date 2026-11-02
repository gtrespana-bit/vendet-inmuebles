import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ACCOUNT_TYPES,
  PLAN_LIMITS,
  PLAN_NAMES,
  TRIAL_DAYS,
  UNLIMITED_LISTINGS,
  accountTypeForPlan,
  formatListingLimit,
  isPlanName,
  isUnlimited,
  planForAccountType,
} from '../src/lib/plan-catalog.ts'
import {
  EMPTY_DRAFT,
  applyAccountType,
  buildSignupMetadata,
  displayName,
  offersLicense,
  requiresCompany,
  trialEndsAt,
  usesSurname,
  validateAccountStep,
  validateDetailsStep,
  validatePlanStep,
} from '../src/lib/registration.ts'

function draft(overrides = {}) {
  return { ...EMPTY_DRAFT, nombre: 'Ana', apellido: 'Pérez', email: 'ana@ejemplo.com', password: 'Secreta1', repeatPassword: 'Secreta1', ...overrides }
}

test('los límites de los planes son 3, 10, 35 e ilimitados con 30 días de prueba', () => {
  assert.equal(PLAN_LIMITS.gratuita.maxAnuncios, 3)
  assert.equal(PLAN_LIMITS.profesional.maxAnuncios, 10)
  assert.equal(PLAN_LIMITS.profesional_plus.maxAnuncios, 35)
  assert.equal(PLAN_LIMITS.profesional_plus.maxFotos, 30)
  assert.equal(PLAN_LIMITS.profesional_plus.creditosMes, 12)
  assert.ok(isUnlimited(PLAN_LIMITS.agencia.maxAnuncios))
  assert.equal(PLAN_LIMITS.agencia.maxAnuncios, UNLIMITED_LISTINGS)
  assert.equal(TRIAL_DAYS, 30)
  assert.equal(formatListingLimit(3), '3')
  assert.equal(formatListingLimit(10), '10')
  assert.equal(formatListingLimit(35), '35')
  assert.equal(formatListingLimit(UNLIMITED_LISTINGS), '∞')
  assert.deepEqual([...PLAN_NAMES], ['gratuita', 'profesional', 'profesional_plus', 'agencia'])
  assert.deepEqual([...ACCOUNT_TYPES], ['particular', 'profesional', 'agencia'])
  assert.equal(accountTypeForPlan('profesional_plus'), 'profesional')
})

test('cada tipo de cuenta tiene un plan por defecto y viceversa', () => {
  assert.equal(planForAccountType('particular'), 'gratuita')
  assert.equal(planForAccountType('profesional'), 'profesional')
  assert.equal(planForAccountType('agencia'), 'agencia')
  for (const tipo of ACCOUNT_TYPES) {
    assert.equal(accountTypeForPlan(planForAccountType(tipo)), tipo)
  }
  assert.equal(isPlanName('agencia'), true)
  assert.equal(isPlanName('premium'), false)
})

test('cada tipo de cuenta pide solo los campos que le corresponden', () => {
  // Particular: nombre y apellido, sin empresa ni licencia.
  assert.equal(usesSurname('particular'), true)
  assert.equal(requiresCompany('particular'), false)
  assert.equal(offersLicense('particular'), false)

  // Agencia: nombre del responsable + nombre de la agencia, sin apellido.
  assert.equal(usesSurname('agencia'), false)
  assert.equal(requiresCompany('agencia'), true)
  assert.equal(offersLicense('agencia'), true)

  // Profesional: persona con licencia, sin empresa.
  assert.equal(usesSurname('profesional'), true)
  assert.equal(requiresCompany('profesional'), false)
  assert.equal(offersLicense('profesional'), true)
})

test('cambiar de tipo de cuenta recoloca el plan y limpia campos ajenos', () => {
  const agencia = applyAccountType({ ...EMPTY_DRAFT, empresa: 'Inmobiliaria X', licencia: 'L-1', apellido: 'Pérez' }, 'agencia')
  assert.equal(agencia.plan, 'agencia')
  assert.equal(agencia.empresa, 'Inmobiliaria X')
  assert.equal(agencia.apellido, '')

  const particular = applyAccountType(agencia, 'particular')
  assert.equal(particular.plan, 'gratuita')
  assert.equal(particular.empresa, '')
  assert.equal(particular.licencia, '')
})

test('el paso 1 exige elegir el tipo de cuenta antes de seguir', () => {
  assert.equal(validateAccountStep(null), 'type')
  assert.equal(validateAccountStep(''), 'type')
  assert.equal(validateAccountStep('empresa'), 'type')
  assert.equal(validateAccountStep('agencia'), null)
  assert.equal(validatePlanStep('profesional'), null)
  assert.equal(validatePlanStep('oro'), 'type')
})

test('los datos se validan según el tipo de cuenta y la contraseña', () => {
  assert.equal(validateDetailsStep(draft()), null)
  assert.equal(validateDetailsStep(draft({ nombre: 'A' })), 'name')
  assert.equal(validateDetailsStep(draft({ apellido: '' })), 'surname')
  assert.equal(validateDetailsStep(draft({ tipoCuenta: 'agencia' })), 'empresa')
  assert.equal(validateDetailsStep(draft({ tipoCuenta: 'agencia', empresa: 'Inmobiliaria X' })), null)
  assert.equal(validateDetailsStep(draft({ email: 'sin-arroba' })), 'email')
  assert.equal(validateDetailsStep(draft({ password: 'corta1A', repeatPassword: 'corta1A' })), 'password')
  assert.equal(validateDetailsStep(draft({ password: 'sinmayus1', repeatPassword: 'sinmayus1' })), 'passwordUpper')
  assert.equal(validateDetailsStep(draft({ password: 'SinNumeros', repeatPassword: 'SinNumeros' })), 'passwordNumber')
  assert.equal(validateDetailsStep(draft({ repeatPassword: 'Otra12345' })), 'passwordMismatch')
})

test('los metadatos del registro llevan tipo de cuenta, plan y prueba de 30 días', () => {
  const agencia = buildSignupMetadata(draft({
    tipoCuenta: 'agencia',
    plan: 'agencia',
    empresa: 'Inmobiliaria X',
    telefono: '+58 412 1234567',
    estado: 'Miranda',
    ciudad: 'Chacao',
  }))
  assert.equal(agencia.tipo_cuenta, 'agencia')
  assert.equal(agencia.plan, 'agencia')
  assert.equal(agencia.empresa_nombre, 'Inmobiliaria X')
  assert.equal(agencia.nombre_completo, 'Ana')
  assert.equal(agencia.telefono, '+58 412 1234567')
  assert.equal(agencia.estado, 'Miranda')
  assert.equal(agencia.ciudad, 'Chacao')
  assert.equal(agencia.trial_dias, '30')
  assert.ok(!('apellido' in agencia))

  const particular = buildSignupMetadata(draft({ tipoCuenta: 'particular', plan: 'gratuita', empresa: 'No aplica', licencia: 'L-9' }))
  assert.equal(particular.nombre_completo, 'Ana Pérez')
  assert.ok(!('empresa_nombre' in particular))
  assert.ok(!('licencia_corredor' in particular))

  const profesional = buildSignupMetadata(draft({ tipoCuenta: 'profesional', plan: 'profesional', licencia: 'L-9' }))
  assert.equal(profesional.licencia_corredor, 'L-9')

  assert.equal(displayName(draft({ tipoCuenta: 'agencia' })), 'Ana')
  const fin = trialEndsAt(new Date('2026-01-01T00:00:00.000Z'))
  assert.equal(fin, '2026-01-31T00:00:00.000Z')
})

test('la cabecera invita a registrarse cuando no hay sesión', () => {
  const header = readFileSync('src/components/Header.tsx', 'utf8')
  assert.match(header, /const primaryLabel = user \? t\('header\.publishProperty'\) : t\('header\.signUp'\)/)
  assert.match(header, /registerRedirect = '\/register\?redirect=%2Fpublicar-inmueble'/)
  assert.match(header, /primaryHref/)
})

test('el registro pide el tipo de cuenta antes que los datos', () => {
  const page = readFileSync('src/app/[locale]/(auth)/register/page.tsx', 'utf8')
  const stepType = page.indexOf("step === 1")
  const stepPlan = page.indexOf("step === 2")
  const stepDetails = page.indexOf("step === 3")
  assert.ok(stepType > -1 && stepType < stepPlan && stepPlan < stepDetails, 'el orden de pasos debe ser tipo → plan → datos')
  assert.match(page, /buildSignupMetadata/)
  assert.match(page, /requiresCompany\(draft\.tipoCuenta\)/)
  assert.match(page, /trialBanner/)
})

test('las etiquetas ES/EN del nuevo registro existen y coinciden', () => {
  const walk = (value, prefix = '') => Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return item && typeof item === 'object' ? walk(item, path) : [path]
  })
  const diccionarios = ['es', 'en'].map((locale) => JSON.parse(readFileSync(`src/i18n/dictionaries/${locale}.json`, 'utf8')))
  const [es, en] = diccionarios
  assert.deepEqual(walk(es.auth.register).sort(), walk(en.auth.register).sort())
  for (const key of ['stepTypeTitle', 'stepPlanTitle', 'stepDetailsTitle', 'continue', 'back', 'submit']) {
    assert.equal(typeof es.auth.register[key], 'string', `falta auth.register.${key}`)
  }
  for (const tipo of ACCOUNT_TYPES) {
    assert.equal(typeof es.auth.register.types[tipo].name, 'string')
    assert.equal(typeof en.auth.register.types[tipo].name, 'string')
  }
  for (const plan of PLAN_NAMES) {
    assert.equal(typeof es.auth.register.planNames[plan], 'string')
  }
  for (const key of ['type', 'name', 'surname', 'empresa', 'email', 'password', 'passwordMismatch', 'accountExists']) {
    assert.equal(typeof es.auth.register.errors[key], 'string', `falta auth.register.errors.${key}`)
    assert.equal(typeof en.auth.register.errors[key], 'string', `falta auth.register.errors.${key}`)
  }
  for (const key of ['trialTitle', 'trialPlan', 'trialUntil', 'trialNote']) {
    assert.equal(typeof es.auth.confirmacion[key], 'string', `falta auth.confirmacion.${key}`)
    assert.equal(typeof en.auth.confirmacion[key], 'string', `falta auth.confirmacion.${key}`)
  }
})

test('la página de planes muestra los nuevos límites y la prueba en los cuatro planes', () => {
  const planes = readFileSync('src/app/[locale]/planes/page.tsx', 'utf8')
  assert.match(planes, /'3 anuncios activos'/)
  assert.match(planes, /'10 anuncios activos'/)
  assert.match(planes, /'35 anuncios activos \(alta capacidad\)'/)
  assert.match(planes, /'Anuncios activos sin límite'/)
  assert.equal((planes.match(/trial: true/g) || []).length, 4)
  assert.doesNotMatch(planes, /'1 anuncio activo'/)
  assert.doesNotMatch(planes, /'5 anuncios activos'/)
})

test('el trigger de alta guarda el tipo de cuenta y crea la prueba de 30 días', () => {
  const sql = readFileSync('supabase/migrations/009_registro_por_tipo_de_cuenta.sql', 'utf8')
  assert.match(sql, /tipo_cuenta/)
  assert.match(sql, /make_interval\(days => v_trial_dias\)/)
  assert.match(sql, /v_trial_dias integer := 30/)
  assert.match(sql, /INSERT INTO public\.suscripciones/)
  assert.match(sql, /'trial'/)
  assert.match(sql, /empresa_nombre/)
  assert.match(sql, /licencia_corredor/)
})
