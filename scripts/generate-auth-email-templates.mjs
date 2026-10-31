/**
 * Genera las plantillas HTML de los correos de autenticación de Supabase con
 * la identidad visual de Venezuela Inmuebles.
 *
 * Uso: node scripts/generate-auth-email-templates.mjs
 *
 * Las plantillas resultantes se guardan en supabase/email-templates/ y deben
 * tener menos de 5000 caracteres (límite de Supabase).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SITE = 'https://venezuela-inmuebles.online'
const LOGO = `${SITE}/logo-venezuela-inmuebles.png`
const OUT_DIR = join(process.cwd(), 'supabase', 'email-templates')

const SANS = 'font-family:Arial,Helvetica,sans-serif'
const SERIF = "font-family:Georgia,'Times New Roman',serif"

const paragraph = (text) =>
  `<p style="margin:0 0 14px;${SANS};font-size:15px;line-height:1.65;color:#334155;">${text}</p>`

const box = (text) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#F8F5EE;border:1px solid #EDE6DA;border-left:3px solid #B08542;border-radius:8px;"><tr><td style="padding:14px 16px;${SANS};font-size:13px;line-height:1.6;color:#475569;">${text}</td></tr></table>`

const button = (label, url) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 14px;"><tr><td style="background:#16294B;border-radius:8px;"><a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:15px 34px;${SANS};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">${label}</a></td></tr></table>`

const fallback = (url) =>
  `<p style="margin:0 0 18px;${SANS};font-size:12px;line-height:1.6;color:#64748B;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a href="${url}" target="_blank" rel="noopener" style="color:#16294B;word-break:break-all;">${url}</a></p>`

const tokenBox = (token) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:#F4F1E9;border:1px solid #E6DFD3;border-radius:10px;"><tr><td align="center" style="padding:22px 18px;${SANS};font-size:34px;font-weight:700;letter-spacing:8px;color:#16294B;">${token}</td></tr></table>`

function layout({ title, preheader, eyebrow, heading, body, note }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${title}</title></head><body style="margin:0;padding:0;background:#F4F1E9;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1E9;"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E6DFD3;border-radius:14px;overflow:hidden;"><tr><td style="padding:26px 30px 16px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${LOGO}" width="42" height="42" alt="Venezuela Inmuebles" style="display:block;border:0;border-radius:10px;"></td><td style="padding-left:11px;${SERIF};font-size:17px;font-weight:700;color:#16294B;">Venezuela <span style="font-weight:400;color:#1E293B;">Inmuebles</span></td></tr></table></td></tr><tr><td style="height:3px;background:#B08542;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:30px 30px 10px;"><p style="margin:0 0 10px;${SANS};font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8A6430;">${eyebrow}</p><h1 style="margin:0 0 14px;${SERIF};font-size:26px;line-height:1.25;font-weight:400;color:#16294B;">${heading}</h1>${body}</td></tr><tr><td style="padding:0 30px 28px;"><p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #E2E8F0;${SANS};font-size:12px;line-height:1.6;color:#64748B;">${note}</p></td></tr><tr><td style="background:#F4F1E9;border-top:1px solid #E6DFD3;padding:20px 30px;${SANS};font-size:11px;line-height:1.6;color:#64748B;text-align:center;"><p style="margin:0 0 3px;font-weight:700;color:#16294B;">Venezuela Inmuebles</p><p style="margin:0 0 3px;">El marketplace de inmuebles de Venezuela</p><p style="margin:0;"><a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;text-decoration:none;">contacto@venezuela-inmuebles.online</a> · <a href="${SITE}" style="color:#16294B;text-decoration:none;">venezuela-inmuebles.online</a></p></td></tr></table></td></tr></table></body></html>`
}

const templates = {
  confirmation: {
    title: 'Confirma tu correo · Venezuela Inmuebles',
    subject: 'Confirma tu correo · Venezuela Inmuebles',
    preheader: 'Un paso más para activar tu cuenta en Venezuela Inmuebles.',
    eyebrow: 'Tu cuenta',
    heading: 'Confirma tu correo',
    body:
      paragraph('Hola, gracias por unirte a Venezuela Inmuebles. Confirma tu dirección de correo para activar tu cuenta y empezar a publicar o encontrar inmuebles.') +
      button('Confirmar mi correo', '{{ .ConfirmationURL }}') +
      fallback('{{ .ConfirmationURL }}') +
      box('El enlace es personal y de un solo uso. Si no creaste esta cuenta, puedes ignorar este correo.'),
    note: 'Recibes este correo porque se creó una cuenta con {{ .Email }} en Venezuela Inmuebles.',
  },

  email_change: {
    title: 'Confirma tu nuevo correo · Venezuela Inmuebles',
    subject: 'Confirma tu nuevo correo · Venezuela Inmuebles',
    preheader: 'Confirma el nuevo correo de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Confirma tu nuevo correo',
    body:
      paragraph('Recibimos una solicitud para usar <strong style="color:#16294B;">{{ .NewEmail }}</strong> como el nuevo correo de tu cuenta. Pulsa el botón para confirmar el cambio.') +
      button('Confirmar nuevo correo', '{{ .ConfirmationURL }}') +
      fallback('{{ .ConfirmationURL }}') +
      box('Si no solicitaste este cambio, ignora este correo. Tu dirección actual seguirá siendo la misma y nadie podrá modificarla sin confirmar este enlace.'),
    note: 'Aviso enviado a {{ .Email }}.',
  },

  invite: {
    title: 'Te invitaron a Venezuela Inmuebles',
    subject: 'Te invitaron a Venezuela Inmuebles',
    preheader: 'Acepta tu invitación y publica tu primer inmueble.',
    eyebrow: 'Invitación',
    heading: 'Te invitaron a Venezuela Inmuebles',
    body:
      paragraph('Has recibido una invitación para crear una cuenta en Venezuela Inmuebles, el marketplace de inmuebles de Venezuela. Acepta la invitación para empezar a publicar y recibir contactos.') +
      button('Aceptar invitación', '{{ .ConfirmationURL }}') +
      fallback('{{ .ConfirmationURL }}') +
      box('Este enlace es personal y de un solo uso. Si no esperabas esta invitación, puedes ignorarla.'),
    note: 'Invitación enviada a {{ .Email }}.',
  },

  magic_link: {
    title: 'Tu enlace de acceso · Venezuela Inmuebles',
    subject: 'Tu enlace de acceso · Venezuela Inmuebles',
    preheader: 'Inicia sesión sin contraseña en Venezuela Inmuebles.',
    eyebrow: 'Acceso',
    heading: 'Tu enlace de acceso',
    body:
      paragraph('Usa el botón para iniciar sesión sin contraseña. El enlace es de un solo uso y caduca en 1 hora.') +
      button('Iniciar sesión', '{{ .ConfirmationURL }}') +
      fallback('{{ .ConfirmationURL }}') +
      box('Si no intentaste iniciar sesión, ignora este correo. Nadie puede acceder a tu cuenta sin este enlace.'),
    note: 'Recibes este correo porque se solicitó un acceso para {{ .Email }}.',
  },

  reauthentication: {
    title: 'Tu código de verificación · Venezuela Inmuebles',
    subject: 'Tu código de verificación: {{ .Token }}',
    preheader: 'Usa tu código para confirmar tu identidad.',
    eyebrow: 'Seguridad',
    heading: 'Tu código de verificación',
    body:
      paragraph('Introduce este código en Venezuela Inmuebles para confirmar tu identidad. Caduca en 1 hora.') +
      tokenBox('{{ .Token }}') +
      box('Si no solicitaste este código, cambia tu contraseña y escríbenos a contacto@venezuela-inmuebles.online.'),
    note: 'Por seguridad, no compartas este código con nadie. Venezuela Inmuebles nunca te lo pedirá por teléfono ni por chat.',
  },

  recovery: {
    title: 'Restablece tu contraseña · Venezuela Inmuebles',
    subject: 'Restablece tu contraseña · Venezuela Inmuebles',
    preheader: 'Crea una nueva contraseña para tu cuenta.',
    eyebrow: 'Acceso',
    heading: 'Restablece tu contraseña',
    body:
      paragraph('Recibimos una solicitud para restablecer la contraseña de tu cuenta. Pulsa el botón para crear una nueva.') +
      button('Crear nueva contraseña', '{{ .ConfirmationURL }}') +
      fallback('{{ .ConfirmationURL }}') +
      box('Si no solicitaste el cambio, ignora este correo: tu contraseña actual sigue siendo válida y nadie más puede modificarla.'),
    note: 'Recibes este correo porque se solicitó un cambio de contraseña para {{ .Email }}.',
  },

  password_changed_notification: {
    title: 'Tu contraseña fue actualizada · Venezuela Inmuebles',
    subject: 'Tu contraseña fue actualizada · Venezuela Inmuebles',
    preheader: 'Confirmación de seguridad de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Tu contraseña fue actualizada',
    body:
      paragraph('La contraseña de tu cuenta <strong style="color:#16294B;">{{ .Email }}</strong> se actualizó correctamente. Si fuiste tú, no tienes que hacer nada más.') +
      box('Si no fuiste tú, restablece tu contraseña de inmediato y escríbenos a <a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;">contacto@venezuela-inmuebles.online</a>.') +
      button('Revisar mi cuenta', '{{ .SiteURL }}/login'),
    note: 'Este aviso de seguridad se envía siempre que cambia la contraseña de la cuenta.',
  },

  email_changed_notification: {
    title: 'Tu correo fue actualizado · Venezuela Inmuebles',
    subject: 'Tu correo fue actualizado · Venezuela Inmuebles',
    preheader: 'Confirmación de seguridad de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Tu correo fue actualizado',
    body:
      paragraph('El correo de tu cuenta cambió de <strong style="color:#16294B;">{{ .OldEmail }}</strong> a <strong style="color:#16294B;">{{ .Email }}</strong>.') +
      box('Si no reconoces este cambio, escríbenos de inmediato a <a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;">contacto@venezuela-inmuebles.online</a>.') +
      button('Revisar mi cuenta', '{{ .SiteURL }}/dashboard'),
    note: 'Este aviso de seguridad se envía siempre que cambia el correo de la cuenta.',
  },

  phone_changed_notification: {
    title: 'Tu teléfono fue actualizado · Venezuela Inmuebles',
    subject: 'Tu teléfono fue actualizado · Venezuela Inmuebles',
    preheader: 'Confirmación de seguridad de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Tu teléfono fue actualizado',
    body:
      paragraph('El teléfono de tu cuenta cambió de <strong style="color:#16294B;">{{ .OldPhone }}</strong> a <strong style="color:#16294B;">{{ .Phone }}</strong>.') +
      box('Si no reconoces este cambio, escríbenos de inmediato a <a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;">contacto@venezuela-inmuebles.online</a>.') +
      button('Revisar mi cuenta', '{{ .SiteURL }}/dashboard'),
    note: 'Este aviso de seguridad se envía siempre que cambia el teléfono de la cuenta.',
  },

  mfa_factor_enrolled_notification: {
    title: 'Se añadió un método de verificación · Venezuela Inmuebles',
    subject: 'Se añadió un método de verificación · Venezuela Inmuebles',
    preheader: 'Confirmación de seguridad de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Se añadió un método de verificación',
    body:
      paragraph('Se añadió el método <strong style="color:#16294B;">{{ .FactorType }}</strong> como forma de verificación de tu cuenta.') +
      box('Si no fuiste tú, cambia tu contraseña y escríbenos de inmediato a <a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;">contacto@venezuela-inmuebles.online</a>.') +
      button('Revisar mi cuenta', '{{ .SiteURL }}/dashboard'),
    note: 'Este aviso de seguridad se envía siempre que se añade un método de verificación.',
  },

  mfa_factor_unenrolled_notification: {
    title: 'Se eliminó un método de verificación · Venezuela Inmuebles',
    subject: 'Se eliminó un método de verificación · Venezuela Inmuebles',
    preheader: 'Confirmación de seguridad de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Se eliminó un método de verificación',
    body:
      paragraph('Se eliminó el método <strong style="color:#16294B;">{{ .FactorType }}</strong> como forma de verificación de tu cuenta.') +
      box('Si no fuiste tú, cambia tu contraseña y escríbenos de inmediato a <a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;">contacto@venezuela-inmuebles.online</a>.') +
      button('Revisar mi cuenta', '{{ .SiteURL }}/dashboard'),
    note: 'Este aviso de seguridad se envía siempre que se elimina un método de verificación.',
  },

  identity_linked_notification: {
    title: 'Se vinculó un nuevo método de acceso · Venezuela Inmuebles',
    subject: 'Se vinculó un nuevo método de acceso · Venezuela Inmuebles',
    preheader: 'Confirmación de seguridad de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Se vinculó un nuevo método de acceso',
    body:
      paragraph('Tu cuenta de <strong style="color:#16294B;">{{ .Provider }}</strong> se vinculó como método de acceso para {{ .Email }}.') +
      box('Si no reconoces esta vinculación, escríbenos de inmediato a <a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;">contacto@venezuela-inmuebles.online</a>.') +
      button('Revisar mi cuenta', '{{ .SiteURL }}/dashboard'),
    note: 'Este aviso de seguridad se envía siempre que se vincula un método de acceso.',
  },

  identity_unlinked_notification: {
    title: 'Se eliminó un método de acceso · Venezuela Inmuebles',
    subject: 'Se eliminó un método de acceso · Venezuela Inmuebles',
    preheader: 'Confirmación de seguridad de tu cuenta.',
    eyebrow: 'Seguridad',
    heading: 'Se eliminó un método de acceso',
    body:
      paragraph('Tu cuenta de <strong style="color:#16294B;">{{ .Provider }}</strong> se eliminó como método de acceso para {{ .Email }}.') +
      box('Si no reconoces este cambio, escríbenos de inmediato a <a href="mailto:contacto@venezuela-inmuebles.online" style="color:#16294B;">contacto@venezuela-inmuebles.online</a>.') +
      button('Revisar mi cuenta', '{{ .SiteURL }}/dashboard'),
    note: 'Este aviso de seguridad se envía siempre que se elimina un método de acceso.',
  },
}

mkdirSync(OUT_DIR, { recursive: true })

const subjects = {}
let maxLength = 0
for (const [key, template] of Object.entries(templates)) {
  const html = layout(template)
  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes >= 5000) {
    console.error(`❌ ${key}.html supera el límite de 5000 caracteres (${bytes})`)
    process.exitCode = 1
  }
  maxLength = Math.max(maxLength, bytes)
  writeFileSync(join(OUT_DIR, `${key}.html`), html, 'utf8')
  subjects[key] = template.subject
}

writeFileSync(join(OUT_DIR, 'subjects.json'), `${JSON.stringify(subjects, null, 2)}\n`, 'utf8')

console.log(`✅ ${Object.keys(templates).length} plantillas generadas en ${OUT_DIR}`)
console.log(`   Tamaño máximo: ${maxLength} caracteres (límite Supabase: 5000)`)
