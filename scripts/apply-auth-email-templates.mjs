#!/usr/bin/env node
/**
 * Aplica las plantillas de correo de autenticación a Supabase mediante la
 * Management API.
 *
 * Requisitos:
 *   - Un Personal Access Token de Supabase (https://supabase.com/dashboard/account/tokens)
 *   - Node.js 18+
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-auth-email-templates.mjs --dry-run
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-auth-email-templates.mjs
 *
 * Variables opcionales:
 *   SUPABASE_PROJECT_REF   (por defecto, el proyecto de Venezuela Inmuebles)
 *
 * Flags:
 *   --dry-run            Solo valida los archivos; no llama a la API.
 *   --templates-only     No activa las notificaciones de seguridad.
 *   --no-sender-name     No cambia el nombre del remitente.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'quxbqmqwiacfwbpqioev'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const TEMPLATES_DIR = join(process.cwd(), 'supabase', 'email-templates')
const MAX_CHARS = 5000

const flags = new Set(process.argv.slice(2))
const dryRun = flags.has('--dry-run')
const templatesOnly = flags.has('--templates-only')
const skipSenderName = flags.has('--no-sender-name')

const AUTH_TEMPLATE_KEYS = [
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

const NOTIFICATION_KEYS = [
  'password_changed',
  'email_changed',
  'phone_changed',
  'mfa_factor_enrolled',
  'mfa_factor_unenrolled',
  'identity_linked',
  'identity_unlinked',
]

function fail(message) {
  console.error(`\n❌ ${message}\n`)
  process.exit(1)
}

function readTemplates() {
  if (!existsSync(TEMPLATES_DIR)) {
    fail(`No existe ${TEMPLATES_DIR}. Ejecuta: node scripts/generate-auth-email-templates.mjs`)
  }

  const subjectsPath = join(TEMPLATES_DIR, 'subjects.json')
  if (!existsSync(subjectsPath)) fail(`Falta ${subjectsPath}`)

  const subjects = JSON.parse(readFileSync(subjectsPath, 'utf8'))
  const templates = {}

  for (const key of AUTH_TEMPLATE_KEYS) {
    const filePath = join(TEMPLATES_DIR, `${key}.html`)
    if (!existsSync(filePath)) fail(`Falta la plantilla ${key}.html`)
    const html = readFileSync(filePath, 'utf8')
    const chars = [...html].length
    if (chars > MAX_CHARS) {
      fail(`${key}.html tiene ${chars} caracteres; Supabase acepta como máximo ${MAX_CHARS}.`)
    }
    if (!subjects[key]) fail(`Falta el asunto de ${key} en subjects.json`)
    templates[key] = { html, subject: subjects[key], chars }
  }

  const extra = readdirSync(TEMPLATES_DIR).filter(
    (file) =>
      file.endsWith('.html') &&
      file !== 'preview.html' &&
      !AUTH_TEMPLATE_KEYS.includes(file.replace(/\.html$/, '')),
  )
  if (extra.length) console.warn(`⚠️  Archivos no usados (se ignoran): ${extra.join(', ')}`)

  return templates
}

function buildTemplatePayload(templates) {
  const payload = {}
  for (const [key, { html, subject }] of Object.entries(templates)) {
    payload[`mailer_templates_${key}_content`] = html
    payload[`mailer_subjects_${key}`] = subject
  }
  return payload
}

async function patchAuthConfig(payload, { label }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${text.slice(0, 600)}`)
  }
  console.log(`✅ ${label}`)
}

const templates = readTemplates()

console.log(`\nProyecto: ${PROJECT_REF}`)
console.log(`Plantillas: ${Object.keys(templates).length} (máximo ${Math.max(...Object.values(templates).map((t) => t.chars))} caracteres)\n`)
for (const [key, { subject, chars }] of Object.entries(templates)) {
  console.log(`  ${key.padEnd(38)} ${String(chars).padStart(5)} car.  ${subject}`)
}

if (dryRun) {
  console.log('\n🔍 Dry run: archivos válidos. No se llamó a la API.\n')
  process.exit(0)
}

if (!ACCESS_TOKEN) {
  fail(
    'Falta SUPABASE_ACCESS_TOKEN. Crea un token en https://supabase.com/dashboard/account/tokens y ejecuta:\n' +
      '   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-auth-email-templates.mjs',
  )
}

try {
  await patchAuthConfig(buildTemplatePayload(templates), {
    label: 'Plantillas y asuntos aplicados',
  })
} catch (error) {
  fail(error.message)
}

if (!templatesOnly) {
  const notificationPayload = {}
  for (const key of NOTIFICATION_KEYS) {
    notificationPayload[`mailer_notifications_${key}_enabled`] = true
  }
  try {
    await patchAuthConfig(notificationPayload, {
      label: 'Notificaciones de seguridad activadas',
    })
  } catch (error) {
    console.warn(`⚠️  No se pudieron activar las notificaciones de seguridad: ${error.message}`)
    console.warn('   Actívalas en Dashboard → Authentication → Emails → Security notifications.\n')
  }
}

if (!skipSenderName) {
  try {
    await patchAuthConfig(
      { smtp_sender_name: 'Venezuela Inmuebles' },
      { label: 'Nombre del remitente: Venezuela Inmuebles' },
    )
  } catch (error) {
    console.warn(`⚠️  No se pudo cambiar el nombre del remitente: ${error.message}\n`)
  }
}

console.log('\n🎉 Listo. Envía un correo de prueba desde Authentication → Emails.\n')
