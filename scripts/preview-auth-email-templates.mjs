/**
 * Genera una vista previa navegable de las plantillas de correo de auth.
 *
 * Uso: node scripts/preview-auth-email-templates.mjs
 * Salida: supabase/email-templates/preview.html
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TEMPLATES_DIR = join(process.cwd(), 'supabase', 'email-templates')
const SUBJECTS = JSON.parse(readFileSync(join(TEMPLATES_DIR, 'subjects.json'), 'utf8'))

const SAMPLES = {
  '{{ .ConfirmationURL }}':
    'https://venezuela-inmuebles.online/confirm?token_hash=preview_hash_sample&type=email_change',
  '{{ .TokenHash }}': 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  '{{ .Token }}': '48291375',
  '{{ .SiteURL }}': 'https://venezuela-inmuebles.online',
  '{{ .NewEmail }}': 'maria.nueva@example.com',
  '{{ .OldEmail }}': 'maria@example.com',
  '{{ .OldPhone }}': '+58 414 765 4321',
  '{{ .Phone }}': '+58 412 123 4567',
  '{{ .Email }}': 'maria@example.com',
  '{{ .Provider }}': 'Google',
  '{{ .FactorType }}': 'aplicación de autenticación (TOTP)',
}

function render(text) {
  let output = text
  for (const [variable, value] of Object.entries(SAMPLES)) {
    output = output.split(variable).join(value)
  }
  return output
}

const entries = Object.keys(SUBJECTS).map((key) => {
  const html = readFileSync(join(TEMPLATES_DIR, `${key}.html`), 'utf8')
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (!body) throw new Error(`No se encontró <body> en ${key}.html`)
  return { key, subject: SUBJECTS[key], body: render(body[1]) }
})

const page = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vista previa · Correos de autenticación</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #E9E4D9; color: #16294B; font-family: Arial, Helvetica, sans-serif; }
  .preview-header { max-width: 660px; margin: 0 auto; padding: 32px 20px 10px; }
  .preview-header p { margin: 0; color: #4B5563; font-size: 14px; line-height: 1.6; }
  .preview-header h1 { margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: 28px; }
  .preview-item { max-width: 660px; margin: 26px auto 0; }
  .preview-label { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 12px; padding: 0 4px 8px; }
  .preview-label strong { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #B08542; }
  .preview-label code { font-size: 12px; color: #4B5563; background: #F4F1E9; border: 1px solid #DCD3C3; border-radius: 999px; padding: 2px 8px; }
  .preview-label span { font-size: 13px; color: #334155; }
  .preview-frame { border: 1px solid #CFC5B2; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(22, 41, 75, .08); }
  .preview-footer { max-width: 660px; margin: 30px auto 50px; padding: 0 20px; color: #64748B; font-size: 12px; line-height: 1.6; }
</style>
</head>
<body>
<header class="preview-header">
  <h1>Vista previa de correos de autenticación</h1>
  <p>13 plantillas con la identidad visual de Venezuela Inmuebles y datos de ejemplo. Los correos reales se envían desde Supabase Auth; esta página no se sube al proyecto.</p>
</header>
${entries
  .map(
    ({ key, subject, body }) => `<section class="preview-item">
  <div class="preview-label"><strong>${key}</strong><code>${key}.html</code><span>${subject.replace('{{ .Token }}', '48291375')}</span></div>
  <div class="preview-frame">${body}</div>
</section>`,
  )
  .join('\n')}
<footer class="preview-footer">
  <p>Generado con <code>node scripts/preview-auth-email-templates.mjs</code>. Después de editar las plantillas, vuelve a ejecutar el generador y este script.</p>
</footer>
</body>
</html>
`

writeFileSync(join(TEMPLATES_DIR, 'preview.html'), page, 'utf8')
console.log(`✅ Vista previa generada: ${join(TEMPLATES_DIR, 'preview.html')}`)
