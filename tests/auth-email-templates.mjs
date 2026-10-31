import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const DIR = 'supabase/email-templates'

const TEMPLATE_KEYS = [
  'confirmation',
  'email_change',
  'invite',
  'magic_link',
  'reauthentication',
  'recovery',
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
]

const LINK_TEMPLATES = ['confirmation', 'email_change', 'invite', 'magic_link', 'recovery']

test('existen las 13 plantillas de auth y su asunto en español', () => {
  const subjects = JSON.parse(readFileSync(`${DIR}/subjects.json`, 'utf8'))
  assert.deepEqual(Object.keys(subjects).sort(), [...TEMPLATE_KEYS].sort())

  for (const key of TEMPLATE_KEYS) {
    assert.ok(existsSync(`${DIR}/${key}.html`), `falta ${key}.html`)
    assert.match(subjects[key], /Venezuela Inmuebles|código de verificación/)
  }
})

test('cada plantilla respeta el límite de 5000 caracteres de Supabase', () => {
  for (const key of TEMPLATE_KEYS) {
    const html = readFileSync(`${DIR}/${key}.html`, 'utf8')
    assert.ok([...html].length < 5000, `${key}.html supera los 5000 caracteres`)
  }
})

test('las plantillas usan la identidad visual y el logotipo del sitio', () => {
  for (const key of TEMPLATE_KEYS) {
    const html = readFileSync(`${DIR}/${key}.html`, 'utf8')
    assert.match(html, /logo-venezuela-inmuebles\.png/)
    assert.match(html, /#16294B/)
    assert.match(html, /#B08542/)
    assert.match(html, /Venezuela Inmuebles/)
    assert.match(html, /contacto@venezuela-inmuebles\.online/)
  }
})

test('los enlaces de confirmación y el código de reautenticación usan variables de Supabase', () => {
  for (const key of LINK_TEMPLATES) {
    const html = readFileSync(`${DIR}/${key}.html`, 'utf8')
    assert.match(html, /href="\{\{ \.ConfirmationURL \}\}"/, `${key} debe enlazar a ConfirmationURL`)
  }

  const reauth = readFileSync(`${DIR}/reauthentication.html`, 'utf8')
  assert.match(reauth, /\{\{ \.Token \}\}/)

  const emailChange = readFileSync(`${DIR}/email_change.html`, 'utf8')
  assert.match(emailChange, /\{\{ \.NewEmail \}\}/)

  const emailChanged = readFileSync(`${DIR}/email_changed_notification.html`, 'utf8')
  assert.match(emailChanged, /\{\{ \.OldEmail \}\}/)
  assert.match(emailChanged, /\{\{ \.Email \}\}/)

  const phoneChanged = readFileSync(`${DIR}/phone_changed_notification.html`, 'utf8')
  assert.match(phoneChanged, /\{\{ \.OldPhone \}\}/)
  assert.match(phoneChanged, /\{\{ \.Phone \}\}/)

  const mfa = readFileSync(`${DIR}/mfa_factor_enrolled_notification.html`, 'utf8')
  assert.match(mfa, /\{\{ \.FactorType \}\}/)

  const identity = readFileSync(`${DIR}/identity_linked_notification.html`, 'utf8')
  assert.match(identity, /\{\{ \.Provider \}\}/)
})

test('solo se usan variables de plantilla admitidas por Supabase', () => {
  const allowed = new Set([
    'ConfirmationURL',
    'Token',
    'SiteURL',
    'Email',
    'NewEmail',
    'OldEmail',
    'Phone',
    'OldPhone',
    'Provider',
    'FactorType',
  ])

  for (const key of TEMPLATE_KEYS) {
    const html = readFileSync(`${DIR}/${key}.html`, 'utf8')
    for (const match of html.matchAll(/\{\{\s*\.([A-Za-z0-9_]+)\s*\}\}/g)) {
      assert.ok(allowed.has(match[1]), `${key}.html usa una variable no admitida: ${match[1]}`)
    }
  }
})

test('las plantillas publicadas no contienen datos de la vista previa', () => {
  for (const key of TEMPLATE_KEYS) {
    const html = readFileSync(`${DIR}/${key}.html`, 'utf8')
    assert.doesNotMatch(html, /example\.com/)
    assert.doesNotMatch(html, /preview-token/)
    assert.doesNotMatch(html, /48291375/)
  }
})

test('el script de aplicación cubre las plantillas, asuntos y avisos de seguridad', () => {
  const script = readFileSync('scripts/apply-auth-email-templates.mjs', 'utf8')
  assert.match(script, /mailer_templates_\$\{key\}_content/)
  assert.match(script, /mailer_subjects_\$\{key\}/)
  assert.match(script, /mailer_notifications_\$\{key\}_enabled/)
  assert.match(script, /api\.supabase\.com\/v1\/projects/)
  assert.match(script, /--dry-run/)
})
