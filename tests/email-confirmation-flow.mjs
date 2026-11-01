import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildEmailConfirmRedirectUrl,
  parseConfirmationCallback,
  resolveRootAuthCallbackRedirect,
} from '../src/lib/auth-confirm.ts'
import { htmlToPlainText } from '../src/lib/plain-text-email.ts'

test('buildEmailConfirmRedirectUrl construye URL limpia hacia /confirm y /en/confirm', () => {
  assert.equal(
    buildEmailConfirmRedirectUrl('https://venezuela-inmuebles.online/', 'es'),
    'https://venezuela-inmuebles.online/confirm'
  )
  assert.equal(
    buildEmailConfirmRedirectUrl('https://venezuela-inmuebles.online', 'en'),
    'https://venezuela-inmuebles.online/en/confirm'
  )
})

test('parseConfirmationCallback cubre token_hash, PKCE code, hash implícito, bandera confirmed y errores', () => {
  assert.deepEqual(
    parseConfirmationCallback('?token_hash=abc123&type=signup', ''),
    { kind: 'token_hash', tokenHash: 'abc123', type: 'signup' }
  )

  assert.deepEqual(
    parseConfirmationCallback('?code=pkce-uuid-999', ''),
    { kind: 'pkce', code: 'pkce-uuid-999', type: 'signup' }
  )

  assert.deepEqual(
    parseConfirmationCallback('', '#access_token=jwt1&refresh_token=ref1&type=signup'),
    { kind: 'implicit', accessToken: 'jwt1', refreshToken: 'ref1', type: 'signup' }
  )

  assert.deepEqual(
    parseConfirmationCallback('?confirmed=1', ''),
    { kind: 'confirmed_flag' }
  )

  const expired = parseConfirmationCallback(
    '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    ''
  )
  assert.equal(expired.kind, 'error')
  assert.equal(expired.isExpiredOrUsed, true)

  assert.deepEqual(parseConfirmationCallback('', ''), { kind: 'none' })
})

test('resolveRootAuthCallbackRedirect redirige callbacks en portada a /confirm o /reset-password sin afectar tráfico normal', () => {
  assert.equal(resolveRootAuthCallbackRedirect('/', '', ''), null)
  assert.equal(resolveRootAuthCallbackRedirect('/', '?utm_source=google', ''), null)
  assert.equal(resolveRootAuthCallbackRedirect('/catalogo', '?code=abc', ''), null)

  assert.equal(
    resolveRootAuthCallbackRedirect('/', '?code=pkce-123', ''),
    '/confirm?code=pkce-123'
  )
  assert.equal(
    resolveRootAuthCallbackRedirect('/en', '?code=pkce-123', ''),
    '/en/confirm?code=pkce-123'
  )
  assert.equal(
    resolveRootAuthCallbackRedirect('/', '', '#access_token=tok&refresh_token=ref&type=signup'),
    '/confirm#access_token=tok&refresh_token=ref&type=signup'
  )
  assert.equal(
    resolveRootAuthCallbackRedirect('/', '?token_hash=rec1&type=recovery', ''),
    '/reset-password?token_hash=rec1&type=recovery'
  )
})

test('htmlToPlainText genera alternativa texto plano limpia con URLs explícitas', () => {
  const html = `
    <html><head><style>body{color:red}</style></head>
    <body>
      <h1>Confirma tu correo</h1>
      <p>Hola <strong>María</strong>, activa tu cuenta:</p>
      <a href="https://venezuela-inmuebles.online/confirm?token_hash=xyz&amp;type=signup">Confirmar mi correo</a>
    </body></html>
  `
  const text = htmlToPlainText(html)
  assert.match(text, /Confirma tu correo/)
  assert.match(text, /Hola María, activa tu cuenta:/)
  assert.match(
    text,
    /Confirmar mi correo \(https:\/\/venezuela-inmuebles\.online\/confirm\?token_hash=xyz&type=signup\)/
  )
  assert.doesNotMatch(text, /<[^>]+>/)
})

test('registro, reenvío, /confirm, /login y correo multipart están cableados de extremo a extremo', () => {
  for (const file of [
    'src/app/[locale]/(auth)/register/page.tsx',
    'src/app/[locale]/(auth)/confirmacion/page.tsx',
    'src/app/[locale]/(auth)/login/page.tsx',
  ]) {
    const src = readFileSync(file, 'utf8')
    assert.match(src, /buildEmailConfirmRedirectUrl/, `${file} debe configurar emailRedirectTo hacia /confirm`)
    assert.match(src, /emailRedirectTo/, `${file} debe pasar emailRedirectTo a Supabase Auth`)
  }

  const confirmPage = readFileSync('src/app/[locale]/confirm/page.tsx', 'utf8')
  assert.match(confirmPage, /useTranslations\('confirmEmail'\)/)
  assert.match(confirmPage, /parseConfirmationCallback/)

  const loginPage = readFileSync('src/app/[locale]/(auth)/login/page.tsx', 'utf8')
  assert.match(loginPage, /confirmed_banner_title/)

  const localeLayout = readFileSync('src/app/[locale]/layout.tsx', 'utf8')
  assert.match(localeLayout, /<EmailConfirmationRedirect\s*\/>/)

  for (const mailer of [
    'src/lib/server-email.ts',
    'src/lib/email.ts',
    'src/email/server-email.ts',
  ]) {
    const src = readFileSync(mailer, 'utf8')
    assert.match(src, /htmlToPlainText/, `${mailer} debe enviar alternativa text/plain`)
    assert.match(src, /replyTo/, `${mailer} debe definir Reply-To`)
  }
})
