'use server'

import nodemailer from 'nodemailer'
import { htmlToPlainText } from './plain-text-email'

const FROM = process.env.SMTP_FROM || '"Venezuela Inmuebles" <noreply@venezuela-inmuebles.online>'
const CONTACT = 'contacto@venezuela-inmuebles.online'
const URL = (process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://venezuela-inmuebles.online').replace(/\/$/, '')
const LOGO = `${URL}/logo-venezuela-inmuebles.png`

/** Escapa contenido escrito por usuarios antes de insertarlo en el HTML. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Transporter ───────────────────────────────────────────

function getTransporter() {
  const port = Number(process.env.SMTP_PORT) || 465
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.resend.com',
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER || 'resend', pass: process.env.SMTP_PASS },
  })
}

interface OpcionesEnvio {
  replyTo?: string
  /** URL de baja en un clic (cabecera List-Unsubscribe). */
  unsubscribeUrl?: string
}

async function enviar(to: string, subject: string, html: string, options: OpcionesEnvio = {}): Promise<boolean> {
  if (!process.env.SMTP_PASS) {
    console.warn('⚠️ SMTP no configurado')
    return false
  }
  try {
    await getTransporter().sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: htmlToPlainText(html),
      replyTo: options.replyTo || CONTACT,
      ...(options.unsubscribeUrl
        ? {
            headers: {
              'List-Unsubscribe': `<${options.unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        : {}),
    })
    console.log(`✅ Email a ${to}: ${subject}`)
    return true
  } catch (e) {
    console.error('❌ Error email:', e)
    return false
  }
}

// ─── Email Layout ──────────────────────────────────────────

const COLORS = {
  primary: '#16294B',
  primaryHover: '#0B1730',
  accent: '#B08542',
  bg: '#F4F1E9',
  white: '#FFFFFF',
  dark: '#1E293B',
  gray: '#64748B',
  lightGray: '#E2E8F0',
  success: '#059669',
}

function emailLayout(title: string, body: string, ctaText?: string, ctaUrl?: string, footerExtra = ''): string {
  return `<!DOCTYPE html>
<html lang="es" style="margin:0;padding:0">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:'Inter','Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:24px 0">
    <tr>
      <td align="center" valign="top">
        <!-- Container 600 -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${COLORS.white};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
          <!-- Header -->
          <!-- Header -->
          <tr>
            <td align="center" style="background:${COLORS.primary};padding:32px 24px 28px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:8px">
                    <a href="${URL}" style="text-decoration:none">
                      <img src="${LOGO}" alt="Venezuela Inmuebles" width="160" style="display:block;max-width:160px;height:auto;border:0">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin:0;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:${COLORS.white};letter-spacing:-0.3px">${title}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Accent line -->
          <tr>
            <td height="3" style="background:${COLORS.accent}"></td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px 8px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:15px;color:${COLORS.dark};line-height:1.65">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          ${ctaText && ctaUrl ? `
          <tr>
            <td align="left" style="padding:24px 28px 32px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <th align="center" style="background:${COLORS.primary};border-radius:8px">
                    <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:14px 36px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;color:${COLORS.white};text-decoration:none;letter-spacing:0.3px">
                      ${ctaText}
                    </a>
                  </th>
                </tr>
              </table>
            </td>
          </tr>` : ''}
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid ${COLORS.lightGray};padding:24px 28px;background:${COLORS.bg}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:12px;color:${COLORS.gray};line-height:1.65">
                    <p style="margin:0 0 6px;font-weight:600;color:${COLORS.dark}">Venezuela Inmuebles</p>
                    <p style="margin:0 0 6px">El marketplace venezolano</p>
                    <p style="margin:0"><a href="mailto:${CONTACT}" style="color:${COLORS.primary};text-decoration:none">${CONTACT}</a></p>
                    <p style="margin:6px 0 0"><a href="${URL}" style="color:${COLORS.primary};text-decoration:none">${URL}</a></p>
                    ${footerExtra}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!-- /Container -->
      </td>
    </tr>
  </table>
  <!-- /Wrapper -->
</body>
</html>`
}

function card(body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};border-radius:10px;padding:20px;margin:8px 0;border:1px solid ${COLORS.lightGray}"><tr><td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:15px;color:${COLORS.dark};line-height:1.6">${body}</td></tr></table>`
}

function priceLine(label: string, value: string): string {
  return `<tr><td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray};padding:4px 0">${label}</td><td align="right" style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:16px;font-weight:700;color:${COLORS.primary};padding:4px 0">${value}</td></tr>`
}

function formatearFechaEmail(iso?: string | null): string {
  if (!iso) return 'Sin vencimiento'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return String(iso)
  try {
    return new Intl.DateTimeFormat('es-VE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Caracas',
    }).format(fecha)
  } catch {
    return fecha.toISOString().slice(0, 10)
  }
}

function limpiarMotivoAdmin(motivo?: string | null): string | null {
  const limpio = String(motivo ?? '').trim()
  if (!limpio) return null
  if (limpio.toLowerCase() === 'manual admin') return null
  return limpio
}

function notaAdminHtml(motivo?: string | null): string {
  const nota = limpiarMotivoAdmin(motivo)
  if (!nota) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border-radius:8px;border-left:4px solid ${COLORS.accent};margin:16px 0">
    <tr>
      <td style="padding:14px 16px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.dark};line-height:1.6">
        <strong style="color:${COLORS.primary}">Mensaje del equipo:</strong><br>
        «${esc(nota)}»
      </td>
    </tr>
  </table>`
}

// ─── 1. Producto Publicado ─────────────────────────────────

export async function emailProductoPublicado(
  email: string,
  nombre: string,
  titulo: string,
  precio: string,
  slug: string,
): Promise<boolean> {
  return enviar(email, '✅ Tu anuncio fue publicado', emailLayout(
    'Anuncio publicado',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Tu anuncio ya está visible en Venezuela Inmuebles para quienes buscan en Venezuela.</p>
     ${card(`
       <p style="margin:0 0 8px;font-weight:600;font-size:16px;color:${COLORS.dark}">${esc(titulo)}</p>
       <p style="margin:0;font-size:22px;font-weight:700;color:${COLORS.primary}">$${precio} USD</p>
     `)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">Consejo: revisa tu anuncio desde tu perfil para asegurarte de que la foto principal sea la mejor.</p>`,
    'Ver mi anuncio',
    `${URL}/inmueble/${slug}`,
  ))
}

// ─── 2. Mensaje Recibido ───────────────────────────────────

export async function emailMensajeRecibido(
  emailVendedor: string,
  nombreVendedor: string,
  nombreComprador: string,
  producto: string,
  mensajePreview: string,
): Promise<boolean> {
  return enviar(emailVendedor, `💬 Nuevo mensaje sobre "${producto}"`, emailLayout(
    'Nuevo mensaje',
    `<p style="margin:0 0 16px">Hola <strong>${nombreVendedor}</strong>,</p>
     <p style="margin:0 0 20px">Un comprador te escribió sobre tu anuncio:</p>
     ${card(`
       <p style="margin:0 0 12px;font-weight:600;color:${COLORS.dark}">${producto}</p>
       <p style="margin:0 0 8px"><strong>De:</strong> ${nombreComprador}</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.white};border-radius:8px;padding:16px;margin-top:8px;border-left:3px solid ${COLORS.primary}">
         <tr><td style="font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.dark};font-style:italic;line-height:1.6">"${mensajePreview}"</td></tr>
       </table>
     `)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">Responder pronto aumenta tus posibilidades de venta.</p>`,
    'Responder mensaje',
    `${URL}/dashboard?tab=mensajes`,
  ))
}

// ─── 3. Créditos Añadidos y Créditos de Cortesía ──────────

export async function emailCreditosAgregados(
  email: string,
  nombre: string,
  cantidad: number,
  balanceTotal: number,
): Promise<boolean> {
  return enviar(email, `Se acreditaron +${cantidad} ${cantidad === 1 ? 'crédito' : 'créditos'} en tu cuenta`, emailLayout(
    'Créditos añadidos',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Se acreditaron créditos en tu cuenta de Venezuela Inmuebles:</p>
     ${card(`
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         ${priceLine('Créditos añadidos', `+${cantidad}`)}
         <tr style="border-top:1px solid ${COLORS.lightGray}"><td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Balance total disponible</td><td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:${COLORS.success}">${balanceTotal}</td></tr>
       </table>
     `)}`,
    'Ir a mi panel',
    `${URL}/dashboard?tab=productos`,
  ))
}

export async function emailCreditosRegalados(
  email: string,
  nombre: string,
  cantidad: number,
  balanceTotal: number,
  motivo?: string | null,
): Promise<boolean> {
  const unidad = cantidad === 1 ? 'crédito' : 'créditos'
  return enviar(
    email,
    `Has recibido +${cantidad} ${unidad} de cortesía en Venezuela Inmuebles`,
    emailLayout(
      'Créditos de cortesía añadidos',
      `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
       <p style="margin:0 0 20px">
         El equipo de <strong>Venezuela Inmuebles</strong> ha añadido
         <strong>+${cantidad} ${unidad} de cortesía</strong> a tu cuenta. Estos créditos no tienen fecha de vencimiento y ya están listos para usarse.
       </p>
       ${card(`
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${priceLine('Créditos otorgados', `+${cantidad} ${unidad}`)}
           <tr style="border-top:1px solid ${COLORS.lightGray}">
             <td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Nuevo balance disponible</td>
             <td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:${COLORS.success}">${balanceTotal} ${balanceTotal === 1 ? 'crédito' : 'créditos'}</td>
           </tr>
         </table>
       `)}
       ${notaAdminHtml(motivo)}
       <p style="margin:18px 0 8px;font-weight:600;color:${COLORS.dark}">¿Cómo puedes aprovecharlos?</p>
       <p style="margin:0;color:${COLORS.gray};font-size:14px;line-height:1.65">
         • <strong>Impulso inmediato (1 crédito):</strong> vuelve a posicionar tu inmueble en los primeros resultados.<br>
         • <strong>Inmueble destacado (desde 4 créditos):</strong> aparece en portada y al tope de las búsquedas por 12h, 24h o 48h.
       </p>`,
      'Usar mis créditos',
      `${URL}/dashboard?tab=productos`,
    ),
    { replyTo: CONTACT },
  )
}

// ─── 4. Verificación de Perfil ─────────────────────────────

export async function emailVerificacionAprobada(
  email: string,
  nombre: string,
  empresaNombre?: string | null,
): Promise<boolean> {
  const mencionEmpresa = empresaNombre
    ? ` (<strong>${esc(empresaNombre)}</strong>)`
    : ''
  return enviar(
    email,
    'Tu perfil ha sido verificado en Venezuela Inmuebles',
    emailLayout(
      'Perfil verificado oficialmente',
      `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>${mencionEmpresa},</p>
       <p style="margin:0 0 20px">
         Nuestro equipo completó la revisión de tu cuenta y activó tu
         <strong>insignia oficial de Perfil Verificado</strong> en Venezuela Inmuebles.
       </p>
       ${card(`
         <p style="margin:0 0 10px;font-weight:700;font-size:15px;color:${COLORS.primary}">Beneficios ya activos en tu cuenta:</p>
         <p style="margin:0;color:${COLORS.dark};font-size:14px;line-height:1.7">
           • <strong>Sello de identidad verificada</strong> visible en todos tus anuncios y en tu perfil público.<br>
           • <strong>Mayor confianza ante compradores e inquilinos</strong>, incrementando la tasa de contacto directo.<br>
           • <strong>Respaldo oficial de autenticidad</strong> dentro del directorio inmobiliario.
         </p>
       `)}
       <p style="margin:20px 0 0;color:${COLORS.gray};font-size:14px">
         Tus publicaciones activas muestran la insignia automáticamente sin que tengas que realizar ningún paso adicional.
       </p>`,
      'Ver mi perfil verificado',
      `${URL}/dashboard`,
    ),
    { replyTo: CONTACT },
  )
}

export async function emailVerificacionRechazada(
  email: string,
  nombre: string,
  motivo?: string | null,
): Promise<boolean> {
  return enviar(
    email,
    'Necesitamos actualizar tus datos de verificación en Venezuela Inmuebles',
    emailLayout(
      'Revisión de verificación',
      `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
       <p style="margin:0 0 20px">
         Revisamos tu solicitud de verificación de identidad y por el momento necesitamos que corrijas un detalle antes de activar tu sello:
       </p>
       ${card(`
         <p style="margin:0 0 6px;font-weight:700;font-size:14px;color:${COLORS.primary}">Observación del equipo:</p>
         <p style="margin:0;color:${COLORS.dark};font-size:14px;line-height:1.6">${esc(motivo || 'Por favor asegúrate de que el documento sea legible y coincida con los datos de tu perfil.')}</p>
       `)}
       <p style="margin:16px 0 0;color:${COLORS.gray};font-size:14px">
         Puedes enviar nuevamente tu solicitud desde tu panel en cualquier momento o responder este correo si necesitas asistencia.
       </p>`,
      'Volver a solicitar verificación',
      `${URL}/dashboard?tab=perfil`,
    ),
    { replyTo: CONTACT },
  )
}

// ─── 5. Subida de Nivel ────────────────────────────────────

export async function emailSubidaNivel(
  email: string,
  nombre: string,
  nivelNuevo: string,
  nivelAnterior: string,
): Promise<boolean> {
  const emojis: Record<string, string> = { Bronce: '🥉', Plata: '🥈', Oro: '🥇', Diamante: '💎' }
  const emoji = emojis[nivelNuevo] || '⭐'
  return enviar(email, `${emoji} Subiste de nivel: ${nivelNuevo}`, emailLayout(
    `¡Ahora eres ${nivelNuevo}!`,
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <div style="text-align:center;padding:24px 0">
       <p style="font-size:52px;margin:0">${emoji}</p>
       <p style="font-size:18px;font-weight:700;color:${COLORS.primary};margin:12px 0">Subiste de nivel</p>
     </div>
     ${card(`
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         ${priceLine('Nivel anterior', nivelAnterior)}
         <tr style="border-top:1px solid ${COLORS.lightGray}"><td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Nuevo nivel</td><td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:18px;font-weight:700;color:${COLORS.accent}">${nivelNuevo}</td></tr>
       </table>
     `)}`,
    'Ver mi perfil',
    `${URL}/dashboard?tab=perfil`,
  ))
}

// ─── 6. Mensajes sin leer (aviso diferido) ─────────────────

export interface MensajeNoLeidoParams {
  email: string
  nombreDestinatario: string
  nombreRemitente: string
  tituloPropiedad: string
  ubicacionPropiedad?: string | null
  precioPropiedad?: string | null
  imagenPropiedad?: string | null
  totalMensajes: number
  mensajePreview: string
  urlChat: string
  urlBaja: string
}

function imagenSegura(url?: string | null): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) ? url : null
}

/**
 * Aviso de mensajes de chat que el destinatario no ha leído tras el plazo de
 * espera. Agrupa todos los mensajes de la conversación en un único correo.
 */
export async function emailMensajesNoLeidos(params: MensajeNoLeidoParams): Promise<boolean> {
  const {
    email,
    nombreDestinatario,
    nombreRemitente,
    tituloPropiedad,
    ubicacionPropiedad,
    precioPropiedad,
    imagenPropiedad,
    totalMensajes,
    mensajePreview,
    urlChat,
    urlBaja,
  } = params

  const total = Math.max(1, Number(totalMensajes) || 1)
  const resumen = total === 1 ? '1 mensaje sin leer' : `${total} mensajes sin leer`
  const imagen = imagenSegura(imagenPropiedad)

  return enviar(
    email,
    `Tienes mensajes sin leer sobre «${tituloPropiedad}»`,
    emailLayout(
      'Mensajes sin leer',
      `<p style="margin:0 0 16px">Hola <strong>${esc(nombreDestinatario)}</strong>,</p>
       <p style="margin:0 0 20px">
         <strong>${esc(nombreRemitente)}</strong> te escribió sobre tu inmueble
         <strong>«${esc(tituloPropiedad)}»</strong> y todavía no has abierto el mensaje.
         Esperamos unos minutos antes de avisarte por correo para no interrumpir la conversación.
       </p>
       ${card(`
         ${imagen ? `<img src="${esc(imagen)}" alt="" width="100%" style="display:block;width:100%;max-height:190px;object-fit:cover;border-radius:8px;margin-bottom:14px;border:0">` : ''}
         <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:${COLORS.dark}">${esc(tituloPropiedad)}</p>
         ${ubicacionPropiedad ? `<p style="margin:0 0 6px;color:${COLORS.gray};font-size:13px">${esc(ubicacionPropiedad)}</p>` : ''}
         ${precioPropiedad ? `<p style="margin:0 0 14px;font-size:20px;font-weight:700;color:${COLORS.primary}">${esc(precioPropiedad)}</p>` : ''}
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.white};border-radius:8px;border-left:3px solid ${COLORS.primary}">
           <tr>
             <td style="padding:14px 16px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.dark};font-style:italic;line-height:1.6">
               «${esc(mensajePreview)}»
             </td>
           </tr>
         </table>
         <p style="margin:12px 0 0;color:${COLORS.gray};font-size:12px">${esc(resumen)}</p>
       `)}
       <p style="margin:0;color:${COLORS.gray};font-size:13px">
         Responde desde la plataforma para mantener tu número de teléfono privado y
         conservar el historial de la conversación.
       </p>`,
      'Leer y responder',
      urlChat,
      `<p style="margin:12px 0 0;font-size:11px;color:${COLORS.gray}">Recibes este aviso porque alguien te escribió en Venezuela Inmuebles. <a href="${esc(urlBaja)}" style="color:${COLORS.gray};text-decoration:underline">No quiero recibir estos avisos</a>.</p>`,
    ),
    { unsubscribeUrl: urlBaja, replyTo: CONTACT },
  )
}

// ─── 7. Moderación de anuncios ─────────────────────────────

export async function emailPropiedadAprobada(
  email: string,
  nombre: string,
  titulo: string,
  slug: string,
): Promise<boolean> {
  return enviar(email, '✅ Tu inmueble fue aprobado', emailLayout(
    'Anuncio aprobado',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Revisamos tu anuncio y ya está publicado para todos los compradores.</p>
     ${card(`<p style="margin:0;font-weight:700;font-size:16px;color:${COLORS.dark}">${esc(titulo)}</p>`)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">Consejo: responde rápido a los mensajes, las propiedades con respuesta en menos de 1 hora reciben más contactos.</p>`,
    'Ver mi anuncio',
    `${URL}/inmueble/${encodeURIComponent(slug)}`,
  ))
}

export async function emailPropiedadRechazada(
  email: string,
  nombre: string,
  titulo: string,
  motivo?: string | null,
): Promise<boolean> {
  return enviar(email, 'Tu anuncio necesita cambios', emailLayout(
    'Anuncio no publicado',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Revisamos tu anuncio y por ahora no pudimos publicarlo:</p>
     ${card(`
       <p style="margin:0 0 8px;font-weight:700;font-size:16px;color:${COLORS.dark}">${esc(titulo)}</p>
       <p style="margin:0;color:${COLORS.gray};font-size:13px">${esc(motivo || 'El contenido no cumple nuestras normas de publicación.')}</p>
     `)}
     <p style="margin:0 0 8px;font-weight:600">¿Qué puedes hacer?</p>
     <p style="margin:0;color:${COLORS.gray};font-size:14px">Corrige la información señalada y vuelve a publicarlo. Si crees que fue un error, respóndenos a este correo y lo revisamos contigo.</p>`,
    'Ir a mis anuncios',
    `${URL}/dashboard`,
  ), { replyTo: CONTACT })
}

// ─── 8. Verificación revocada ──────────────────────────────

export async function emailVerificacionRevocada(email: string, nombre: string): Promise<boolean> {
  return enviar(email, 'Actualización sobre tu verificación', emailLayout(
    'Verificación no activa',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">
       Tu sello de verificación ya no está activo. Tus anuncios siguen publicados,
       pero los compradores ya no verán la insignia de cuenta verificada.
     </p>
     ${card(`<p style="margin:0;color:${COLORS.gray};font-size:14px">Si crees que se trata de un error o quieres volver a verificar tu identidad, escríbenos a ${esc(CONTACT)} y te ayudamos.</p>`)}`,
    'Ir a mi perfil',
    `${URL}/dashboard`,
  ), { replyTo: CONTACT })
}

// ─── 9. Reseña recibida ────────────────────────────────────

export async function emailResenaRecibida(
  email: string,
  nombre: string,
  nombreAutor: string,
  puntuacion: number,
  comentario: string | null,
  tituloPropiedad: string | null,
): Promise<boolean> {
  const estrellas = '★'.repeat(Math.max(1, Math.min(5, Math.round(Number(puntuacion) || 0))))
  return enviar(email, `⭐ ${nombreAutor} te dejó una reseña`, emailLayout(
    'Nueva reseña',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px"><strong>${esc(nombreAutor)}</strong> valoró su experiencia contigo${tituloPropiedad ? ` en «${esc(tituloPropiedad)}»` : ''}.</p>
     ${card(`
       <p style="margin:0 0 8px;font-size:22px;letter-spacing:2px;color:${COLORS.accent}">${estrellas}</p>
       ${comentario ? `<p style="margin:0;color:${COLORS.dark};font-size:14px;font-style:italic;line-height:1.6">«${esc(comentario)}»</p>` : `<p style="margin:0;color:${COLORS.gray};font-size:14px">La reseña no incluye comentario.</p>`}
     `)}
     <p style="margin:0;color:${COLORS.gray};font-size:14px">Responder con amabilidad mejora tu reputación y la confianza de próximos compradores.</p>`,
    'Ver mis reseñas',
    `${URL}/dashboard?tab=resenas`,
  ))
}

// ─── 10. Anuncio destacado / boost ─────────────────────────

export async function emailPropiedadDestacada(
  email: string,
  nombre: string,
  titulo: string,
  slug: string,
): Promise<boolean> {
  return enviar(email, '⭐ Tu inmueble está destacado', emailLayout(
    'Inmueble destacado',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Tu anuncio ahora aparece destacado y con mayor visibilidad en la búsqueda durante las próximas horas.</p>
     ${card(`<p style="margin:0;font-weight:700;font-size:16px;color:${COLORS.dark}">${esc(titulo)}</p>`)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">Aprovecha el impulso: comparte el enlace en tus redes y responde rápido a los interesados.</p>`,
    'Ver mi anuncio',
    `${URL}/inmueble/${encodeURIComponent(slug)}`,
  ))
}

export async function emailPropiedadBoost(
  email: string,
  nombre: string,
  titulo: string,
  slug: string,
): Promise<boolean> {
  return enviar(email, '🚀 Tu inmueble recibió un impulso', emailLayout(
    'Impulso aplicado',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Aplicamos un impulso a tu anuncio para que más compradores lo vean en el catálogo.</p>
     ${card(`<p style="margin:0;font-weight:700;font-size:16px;color:${COLORS.dark}">${esc(titulo)}</p>`)}`,
    'Ver mi anuncio',
    `${URL}/inmueble/${encodeURIComponent(slug)}`,
  ))
}

// ─── 11. Inmueble marcado como vendido ─────────────────────

export async function emailPropiedadVendida(
  email: string,
  nombre: string,
  titulo: string,
): Promise<boolean> {
  return enviar(email, '🎉 Marcaste tu inmueble como vendido', emailLayout(
    '¡Felicidades por la venta!',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Registramos que <strong>${esc(titulo)}</strong> ya no está disponible. El anuncio permanece en tu historial para que puedas reutilizarlo.</p>
     ${card(`<p style="margin:0;color:${COLORS.gray};font-size:14px">Si quieres vender o alquilar otro inmueble, publícalo en minutos desde tu panel.</p>`)}`,
    'Publicar otro inmueble',
    `${URL}/publicar`,
  ))
}

// ─── 12. Compra de créditos rechazada ──────────────────────

export async function emailCreditosRechazados(
  email: string,
  nombre: string,
  motivo?: string | null,
): Promise<boolean> {
  return enviar(email, 'No pudimos procesar tu compra de créditos', emailLayout(
    'Compra no aprobada',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Revisamos tu solicitud de créditos y no pudimos aprobarla.</p>
     ${card(`<p style="margin:0;color:${COLORS.gray};font-size:14px">${esc(motivo || 'No pudimos verificar el pago recibido.')}</p>`)}
     <p style="margin:0;color:${COLORS.gray};font-size:14px">Si ya realizaste el pago, respóndenos a este correo con el comprobante y lo revisamos de inmediato.</p>`,
    'Ver mis créditos',
    `${URL}/creditos`,
  ), { replyTo: CONTACT })
}

// ─── 13. Anuncio en revisión ───────────────────────────────

export async function emailPropiedadEnRevision(
  email: string,
  nombre: string,
  titulo: string,
): Promise<boolean> {
  return enviar(email, 'Recibimos tu anuncio y está en revisión', emailLayout(
    'Anuncio en revisión',
    `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
     <p style="margin:0 0 20px">Recibimos tu anuncio correctamente. Nuestro equipo lo está revisando y te avisaremos por correo en cuanto esté publicado.</p>
     ${card(`<p style="margin:0;font-weight:700;font-size:16px;color:${COLORS.dark}">${esc(titulo)}</p>`)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">La revisión suele tardar menos de 24 horas. Mientras tanto puedes seguir preparando las fotos y la descripción desde tu panel.</p>`,
    'Ir a mi panel',
    `${URL}/dashboard`,
  ))
}

// ─── 14. Invitación a equipo de Agencia Inmobiliaria ───────

export async function emailInvitacionAgencia(
  email: string,
  agenciaNombre: string,
  invitadorNombre: string,
  rol: 'admin' | 'agente',
  inviteUrl: string,
): Promise<boolean> {
  const rolTexto = rol === 'admin' ? 'Administrador de Agencia' : 'Agente Inmobiliario'
  return enviar(
    email,
    `Invitación para unirte a ${agenciaNombre} en Venezuela Inmuebles`,
    emailLayout(
      `Únete al equipo de ${esc(agenciaNombre)}`,
      `<p style="margin:0 0 16px">Hola,</p>
       <p style="margin:0 0 20px"><strong>${esc(invitadorNombre)}</strong> te ha invitado a formar parte del equipo de <strong>${esc(agenciaNombre)}</strong> como <strong>${rolTexto}</strong> en Venezuela Inmuebles.</p>
       ${card(`
         <p style="margin:0 0 8px;font-weight:700;font-size:15px;color:${COLORS.dark}">Beneficios incluidos en el equipo:</p>
         <p style="margin:0;color:${COLORS.gray};font-size:14px;line-height:1.6">
           • Publicación ilimitada de inmuebles bajo la cartera de ${esc(agenciaNombre)}<br>
           • Hasta 30 fotografías de alta resolución, vídeo y planos por propiedad<br>
           • Atención directa de clientes interesados en tus inmuebles asignados por chat y WhatsApp
         </p>
       `)}
       <p style="margin:20px 0 0;color:${COLORS.gray};font-size:14px">Pulsa el botón para aceptar la invitación (si aún no tienes cuenta, podrás crearla gratis en menos de un minuto con este mismo correo). El enlace es válido durante 7 días.</p>`,
      'Aceptar invitación al equipo',
      inviteUrl,
    ),
    { replyTo: CONTACT }
  )
}

// ─── 15. Tiempo Extra y Gestión Manual de Planes (Admin) ───

export interface TiempoExtraPlanParams {
  email: string
  nombre: string
  empresaNombre?: string | null
  plan: 'agencia' | 'profesional'
  estado: 'activa' | 'trial'
  diasAgregados: number
  fechaVencimiento?: string | null
  creditosIncluidos?: number | null
  motivo?: string | null
}

function beneficiosPlanHtml(plan: 'agencia' | 'profesional', creditosIncluidos?: number | null): string {
  if (plan === 'agencia') {
    const creditos = creditosIncluidos ?? 20
    return `<p style="margin:18px 0 8px;font-weight:600;color:${COLORS.dark}">Qué incluye tu Plan Agencia:</p>
      <p style="margin:0;color:${COLORS.gray};font-size:14px;line-height:1.65">
        • <strong>Publicaciones ilimitadas</strong> activas en toda Venezuela.<br>
        • <strong>Gestión de equipo multi-agente:</strong> invita agentes por correo o enlace y asigna propiedades.<br>
        • <strong>Hasta 30 fotografías</strong>, vídeo y planos por propiedad.<br>
        • <strong>${creditos} créditos mensuales incluidos</strong> para impulsar o destacar tus anuncios.
      </p>`
  }
  const creditos = creditosIncluidos ?? 5
  return `<p style="margin:18px 0 8px;font-weight:600;color:${COLORS.dark}">Qué incluye tu Plan Profesional:</p>
    <p style="margin:0;color:${COLORS.gray};font-size:14px;line-height:1.65">
      • <strong>Hasta 10 inmuebles activos</strong> simultáneamente.<br>
      • <strong>Escaparate profesional</strong> con tu marca y contacto directo.<br>
      • <strong>Hasta 20 fotografías</strong> y vídeo por propiedad.<br>
      • <strong>${creditos} créditos mensuales incluidos</strong> para impulsar o destacar tus anuncios.
    </p>`
}

export async function emailTiempoExtraPlan(params: TiempoExtraPlanParams): Promise<boolean> {
  const {
    email,
    nombre,
    empresaNombre,
    plan,
    estado,
    diasAgregados,
    fechaVencimiento,
    creditosIncluidos,
    motivo,
  } = params

  const planLabel = plan === 'agencia' ? 'Agencia' : 'Profesional'
  const diasTxt = `${diasAgregados} ${diasAgregados === 1 ? 'día' : 'días'}`
  const estadoTxt = estado === 'trial' ? 'Período de prueba extendido' : 'Suscripción activa extendida'
  const mencionEmpresa = empresaNombre ? ` para <strong>${esc(empresaNombre)}</strong>` : ''
  const ctaDestino = plan === 'agencia' ? `${URL}/dashboard?tab=agencia` : `${URL}/dashboard`

  return enviar(
    email,
    `Tiempo extra añadido a tu Plan ${planLabel} en Venezuela Inmuebles`,
    emailLayout(
      `+${diasTxt} extra en tu Plan ${planLabel}`,
      `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
       <p style="margin:0 0 20px">
         Hemos otorgado <strong>+${diasTxt} adicionales de cortesía</strong>${mencionEmpresa} en tu
         <strong>Plan ${planLabel}</strong> dentro de Venezuela Inmuebles.
       </p>
       ${card(`
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${priceLine('Plan', `Plan ${planLabel}`)}
           ${priceLine('Modalidad', estadoTxt)}
           ${priceLine('Tiempo extra otorgado', `+${diasTxt}`)}
           <tr style="border-top:1px solid ${COLORS.lightGray}">
             <td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Válido hasta</td>
             <td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:16px;font-weight:700;color:${COLORS.success}">${esc(formatearFechaEmail(fechaVencimiento))}</td>
           </tr>
         </table>
       `)}
       ${notaAdminHtml(motivo)}
       ${beneficiosPlanHtml(plan, creditosIncluidos)}`,
      plan === 'agencia' ? 'Gestionar mi agencia' : 'Ir a mi panel',
      ctaDestino,
    ),
    { replyTo: CONTACT },
  )
}

export interface PlanAsignadoAdminParams {
  email: string
  nombre: string
  empresaNombre?: string | null
  plan: 'agencia' | 'profesional' | 'gratuita'
  estado: 'activa' | 'trial' | 'cancelada'
  dias?: number | null
  fechaVencimiento?: string | null
  creditosIncluidos?: number | null
  motivo?: string | null
}

export async function emailPlanAsignadoAdmin(params: PlanAsignadoAdminParams): Promise<boolean> {
  const {
    email,
    nombre,
    empresaNombre,
    plan,
    estado,
    dias,
    fechaVencimiento,
    creditosIncluidos,
    motivo,
  } = params

  if (plan === 'gratuita' || estado === 'cancelada') {
    return enviar(
      email,
      'Actualización de tu plan en Venezuela Inmuebles',
      emailLayout(
        'Tu cuenta pasó al Plan Gratuito',
        `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
         <p style="margin:0 0 20px">
           Te informamos que tu cuenta en Venezuela Inmuebles ahora opera bajo el <strong>Plan Gratuito</strong> (hasta 3 inmuebles activos sin costo).
         </p>
         ${notaAdminHtml(motivo)}
         <p style="margin:16px 0 0;color:${COLORS.gray};font-size:14px">
           Si deseas reactivar un Plan Profesional o Agencia, puedes hacerlo desde tu panel o respondiendo a este mensaje.
         </p>`,
        'Ver planes disponibles',
        `${URL}/planes`,
      ),
      { replyTo: CONTACT },
    )
  }

  const planLabel = plan === 'agencia' ? 'Agencia' : 'Profesional'
  const estadoTxt = estado === 'trial' ? 'Período de prueba sin costo' : 'Suscripción activa'
  const duracionTxt = dias && dias > 0 ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Vigencia activa'
  const mencionEmpresa = empresaNombre ? ` para <strong>${esc(empresaNombre)}</strong>` : ''
  const ctaDestino = plan === 'agencia' ? `${URL}/dashboard?tab=agencia` : `${URL}/dashboard`

  return enviar(
    email,
    `Tu Plan ${planLabel} ya está activo en Venezuela Inmuebles`,
    emailLayout(
      `Plan ${planLabel} activado`,
      `<p style="margin:0 0 16px">Hola <strong>${esc(nombre)}</strong>,</p>
       <p style="margin:0 0 20px">
         Hemos activado el <strong>Plan ${planLabel}</strong>${mencionEmpresa} en tu cuenta de Venezuela Inmuebles.
       </p>
       ${card(`
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${priceLine('Plan activado', `Plan ${planLabel}`)}
           ${priceLine('Modalidad', estadoTxt)}
           ${priceLine('Duración otorgada', duracionTxt)}
           <tr style="border-top:1px solid ${COLORS.lightGray}">
             <td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Válido hasta</td>
             <td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:16px;font-weight:700;color:${COLORS.success}">${esc(formatearFechaEmail(fechaVencimiento))}</td>
           </tr>
         </table>
       `)}
       ${notaAdminHtml(motivo)}
       ${beneficiosPlanHtml(plan, creditosIncluidos)}`,
      plan === 'agencia' ? 'Configurar mi agencia' : 'Ir a mi panel',
      ctaDestino,
    ),
    { replyTo: CONTACT },
  )
}

// ─── 11. Alertas de Búsquedas Guardadas ────────────────────

export interface InmuebleAlertaEmail {
  id: string
  slug?: string | null
  titulo: string
  precio: number
  moneda?: string | null
  ubicacion: string
  operacion?: string | null
}

export async function emailAlertaBusquedaGuardada(params: {
  email: string
  nombreUsuario: string
  nombreBusqueda: string
  queryString: string
  inmuebles: InmuebleAlertaEmail[]
  unsubscribeUrl?: string
}): Promise<boolean> {
  const { email, nombreUsuario, nombreBusqueda, queryString, inmuebles, unsubscribeUrl } = params
  if (!inmuebles.length) return false

  const filasHtml = inmuebles
    .slice(0, 5)
    .map((item) => {
      const targetUrl = `${URL}/inmueble/${encodeURIComponent(item.slug || item.id)}`
      const precioFmt =
        item.precio > 0
          ? `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(item.precio)}`
          : 'Precio a consultar'
      const sufijo = item.operacion === 'alquiler' && item.precio > 0 ? '/mes' : ''
      return `<div style="padding:12px 0;border-bottom:1px solid ${COLORS.lightGray}">
        <a href="${targetUrl}" style="font-size:15px;font-weight:700;color:${COLORS.primary};text-decoration:none">${esc(item.titulo)}</a>
        <div style="margin-top:4px;font-size:13px;color:${COLORS.gray}">${esc(item.ubicacion)}</div>
        <div style="margin-top:4px;font-size:15px;font-weight:700;color:${COLORS.accent}">${esc(precioFmt)}${sufijo}</div>
      </div>`
    })
    .join('')

  const catalogUrl = queryString ? `${URL}/catalogo?${queryString}` : `${URL}/catalogo`
  const footerUnsub = unsubscribeUrl
    ? `<p style="margin:12px 0 0;font-size:12px;color:${COLORS.gray}">¿No deseas recibir más alertas? Puedes pausarlas en tu panel o <a href="${esc(unsubscribeUrl)}" style="color:${COLORS.primary}">darte de baja con un clic</a>.</p>`
    : ''

  return enviar(
    email,
    `${inmuebles.length === 1 ? 'Nuevo inmueble' : `${inmuebles.length} nuevos inmuebles`} para tu alerta: ${nombreBusqueda}`,
    emailLayout(
      'Nuevas propiedades coinciden con tu búsqueda',
      `<p style="margin:0 0 14px">Hola <strong>${esc(nombreUsuario || 'buscador')}</strong>,</p>
       <p style="margin:0 0 18px">
         Se publicaron nuevas propiedades que coinciden con tu alerta guardada
         <strong>«${esc(nombreBusqueda)}»</strong>:
       </p>
       ${card(filasHtml)}
       ${footerUnsub}`,
      'Ver resultados completos',
      catalogUrl,
    ),
    { replyTo: CONTACT, unsubscribeUrl },
  )
}

// ─── 12. Solicitud de Visita / Consulta de Inmueble ────────

export async function emailNuevaSolicitudVisita(params: {
  emailDestino: string
  nombreDestino: string
  tituloInmueble: string
  slugInmueble?: string | null
  inmuebleId: string
  nombreContacto: string
  telefonoContacto: string
  emailContacto?: string | null
  modalidad: 'presencial' | 'videollamada' | 'llamada'
  fechaPreferida?: string | null
  franjaHoraria: string
  mensaje?: string | null
}): Promise<boolean> {
  const modalidadLabel =
    params.modalidad === 'videollamada'
      ? 'Videollamada / Recorrido virtual guiado'
      : params.modalidad === 'llamada'
        ? 'Llamada telefónica'
        : 'Visita presencial al inmueble'

  const franjaLabel: Record<string, string> = {
    manana: 'Mañana (8:00 a.m. – 12:00 m.)',
    tarde: 'Tarde (1:00 p.m. – 6:00 p.m.)',
    fin_de_semana: 'Fin de semana',
    flexible: 'Horario flexible a convenir',
  }

  const soloDigitos = params.telefonoContacto.replace(/[^\d]/g, '')
  const waDigits = soloDigitos.startsWith('0') && soloDigitos.length === 11
    ? `58${soloDigitos.slice(1)}`
    : soloDigitos
  const waLink = waDigits.length >= 10 ? `https://wa.me/${waDigits}` : null
  const fichaUrl = `${URL}/inmueble/${encodeURIComponent(params.slugInmueble || params.inmuebleId)}`

  return enviar(
    params.emailDestino,
    `Nueva solicitud de visita: ${params.tituloInmueble}`,
    emailLayout(
      'Nuevo interesado en visitar tu inmueble',
      `<p style="margin:0 0 14px">Hola <strong>${esc(params.nombreDestino || 'anunciante')}</strong>,</p>
       <p style="margin:0 0 18px">
         Recibiste una nueva solicitud sobre <a href="${fichaUrl}" style="color:${COLORS.primary};font-weight:700">${esc(params.tituloInmueble)}</a>:
       </p>
       ${card(`
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${priceLine('Interesado', esc(params.nombreContacto))}
           ${priceLine('Teléfono / WhatsApp', esc(params.telefonoContacto))}
           ${params.emailContacto ? priceLine('Correo', esc(params.emailContacto)) : ''}
           ${priceLine('Modalidad', modalidadLabel)}
           ${params.fechaPreferida ? priceLine('Fecha sugerida', esc(params.fechaPreferida)) : ''}
           ${priceLine('Horario preferido', esc(franjaLabel[params.franjaHoraria] || params.franjaHoraria))}
         </table>
         ${params.mensaje ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid ${COLORS.lightGray};font-size:14px;color:${COLORS.dark}"><strong>Comentario:</strong> ${esc(params.mensaje)}</div>` : ''}
         ${waLink ? `<div style="margin-top:14px"><a href="${waLink}" style="display:inline-block;padding:8px 14px;border-radius:8px;background:#16a34a;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none">Responder directo por WhatsApp</a></div>` : ''}
       `)}`,
      'Gestionar visitas en mi panel',
      `${URL}/dashboard?tab=visitas`,
    ),
    { replyTo: params.emailContacto || CONTACT },
  )
}

// ─── 13. Confirmación / Actualización de Visita para el Comprador ──

export async function emailEstadoSolicitudVisita(params: {
  emailComprador: string
  nombreComprador: string
  nombreAsesor: string
  telefonoAsesor?: string | null
  tituloInmueble: string
  slugInmueble?: string | null
  inmuebleId: string
  ubicacionInmueble?: string | null
  estado: 'confirmada' | 'cancelada' | 'atendida'
  modalidad: 'presencial' | 'videollamada' | 'llamada'
  fechaPreferida?: string | null
  franjaHoraria?: string | null
  notaVendedor?: string | null
  calendarUrl?: string | null
}): Promise<boolean> {
  const fichaUrl = `${URL}/inmueble/${encodeURIComponent(params.slugInmueble || params.inmuebleId)}`
  const esConfirmada = params.estado === 'confirmada'
  const esCancelada = params.estado === 'cancelada'

  const modalidadLabel =
    params.modalidad === 'videollamada'
      ? 'Videollamada / Recorrido virtual'
      : params.modalidad === 'llamada'
        ? 'Llamada telefónica'
        : 'Visita presencial'

  const franjaLabel: Record<string, string> = {
    manana: 'Mañana (9:30 a.m.)',
    tarde: 'Tarde (3:00 p.m.)',
    fin_de_semana: 'Fin de semana (10:30 a.m.)',
    flexible: 'Horario acordado con el asesor',
  }

  const asunto = esConfirmada
    ? `✅ Visita confirmada: ${params.tituloInmueble}`
    : esCancelada
      ? `Actualización de tu solicitud de visita: ${params.tituloInmueble}`
      : `Gracias por visitar: ${params.tituloInmueble}`

  const encabezado = esConfirmada
    ? '¡Tu solicitud de visita fue confirmada!'
    : esCancelada
      ? 'Tu solicitud de visita requiere reprogramación'
      : 'Visita registrada como atendida'

  const intro = esConfirmada
    ? `El asesor <strong>${esc(params.nombreAsesor || 'del inmueble')}</strong> confirmó tu solicitud sobre <a href="${fichaUrl}" style="color:${COLORS.primary};font-weight:700">${esc(params.tituloInmueble)}</a>.`
    : esCancelada
      ? `El asesor actualizó el estado de tu solicitud sobre <a href="${fichaUrl}" style="color:${COLORS.primary};font-weight:700">${esc(params.tituloInmueble)}</a>. Si deseas elegir otro horario, puedes responder directamente o reprogramar en la ficha.`
      : `Registramos como completada tu consulta/visita sobre <a href="${fichaUrl}" style="color:${COLORS.primary};font-weight:700">${esc(params.tituloInmueble)}</a>.`

  return enviar(
    params.emailComprador,
    asunto,
    emailLayout(
      encabezado,
      `<p style="margin:0 0 14px">Hola <strong>${esc(params.nombreComprador || 'interesado')}</strong>,</p>
       <p style="margin:0 0 18px">${intro}</p>
       ${card(`
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
           ${priceLine('Modalidad', modalidadLabel)}
           ${params.fechaPreferida ? priceLine('Fecha', esc(params.fechaPreferida)) : ''}
           ${params.franjaHoraria ? priceLine('Horario', esc(franjaLabel[params.franjaHoraria] || params.franjaHoraria)) : ''}
           ${params.ubicacionInmueble ? priceLine('Ubicación', esc(params.ubicacionInmueble)) : ''}
           ${params.telefonoAsesor ? priceLine('Contacto del asesor', esc(params.telefonoAsesor)) : ''}
         </table>
         ${params.notaVendedor ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid ${COLORS.lightGray};font-size:14px;color:${COLORS.dark}"><strong>Nota del asesor:</strong> ${esc(params.notaVendedor)}</div>` : ''}
         ${esConfirmada && params.calendarUrl ? `<div style="margin-top:14px"><a href="${esc(params.calendarUrl)}" style="display:inline-block;padding:8px 14px;border-radius:8px;background:${COLORS.primary};color:#ffffff;font-size:13px;font-weight:700;text-decoration:none">📅 Añadir a Google Calendar</a></div>` : ''}
       `)}`,
      'Ver ficha del inmueble',
      fichaUrl,
    ),
    { replyTo: CONTACT },
  )
}


