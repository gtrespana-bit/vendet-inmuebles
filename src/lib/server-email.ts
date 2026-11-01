'use server'

import nodemailer from 'nodemailer'

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
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
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

// ─── 3. Créditos Añadidos ──────────────────────────────────

export async function emailCreditosAgregados(
  email: string,
  nombre: string,
  cantidad: number,
  balanceTotal: number,
): Promise<boolean> {
  return enviar(email, `✅ +${cantidad} créditos en tu cuenta`, emailLayout(
    'Créditos añadidos',
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <p style="margin:0 0 20px">Se acreditaron créditos a tu cuenta:</p>
     ${card(`
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         <tr>${priceLine('Créditos añadidos', `+${cantidad}`)}</tr>
         <tr style="border-top:1px solid ${COLORS.lightGray}"><td style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.gray}">Balance total</td><td align="right" style="padding-top:8px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:${COLORS.success}">${balanceTotal}</td></tr>
       </table>
     `)}`,
    'Ir a mi perfil',
    `${URL}/dashboard?tab=perfil`,
  ))
}

// ─── 4. Verificación Aprobada ──────────────────────────────

export async function emailVerificacionAprobada(email: string, nombre: string): Promise<boolean> {
  return enviar(email, '🎉 Tu cuenta fue verificada', emailLayout(
    'Cuenta verificada',
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <div style="text-align:center;padding:24px 0">
       <p style="font-size:52px;margin:0">✅</p>
       <p style="font-size:18px;font-weight:700;color:${COLORS.primary};margin:12px 0">Verificación completada</p>
     </div>
     <p style="margin:0 0 16px;text-align:center">Tu cuenta ahora tiene el sello de verificación visible en todos tus anuncios.</p>
     <p style="margin:0;text-align:center;color:${COLORS.gray};font-size:14px">Esto aumenta la confianza de los compradores y mejora tus ventas.</p>`,
    'Ver mi perfil',
    `${URL}/dashboard`,
  ))
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
