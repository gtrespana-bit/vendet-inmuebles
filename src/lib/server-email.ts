'use server'

import nodemailer from 'nodemailer'

const FROM = '"VendeT-Venezuela" <noreply@vendet.online>'
const CONTACT = 'contacto@vendet.online'
const URL = process.env.NEXT_PUBLIC_URL || 'https://vendet.online'
const LOGO = `${URL}/logo-vendet.png`

// ─── Transporter ───────────────────────────────────────────

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
    port: Number(process.env.ZOHO_SMTP_PORT) || 587,
    secure: process.env.ZOHO_SMTP_PORT === '465',
    auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
    tls: { rejectUnauthorized: false },
  })
}

async function enviar(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.ZOHO_SMTP_USER || !process.env.ZOHO_SMTP_PASS) {
    console.warn('⚠️ SMTP no configurado')
    return false
  }
  try {
    await getTransporter().sendMail({ from: FROM, to, subject, html })
    console.log(`✅ Email a ${to}: ${subject}`)
    return true
  } catch (e) {
    console.error('❌ Error email:', e)
    return false
  }
}

// ─── Email Layout ──────────────────────────────────────────

const COLORS = {
  primary: '#7B2D3B',
  primaryHover: '#5C1E2B',
  accent: '#C9A84C',
  bg: '#F5F7FA',
  white: '#FFFFFF',
  dark: '#1E293B',
  gray: '#64748B',
  lightGray: '#E2E8F0',
  success: '#059669',
}

function emailLayout(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
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
                      <img src="${LOGO}" alt="VendeT-Venezuela" width="160" style="display:block;max-width:160px;height:auto;border:0">
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
                    <p style="margin:0 0 6px;font-weight:600;color:${COLORS.dark}">VendeT-Venezuela</p>
                    <p style="margin:0 0 6px">El marketplace venezolano</p>
                    <p style="margin:0"><a href="mailto:${CONTACT}" style="color:${COLORS.primary};text-decoration:none">${CONTACT}</a></p>
                    <p style="margin:6px 0 0"><a href="${URL}" style="color:${COLORS.primary};text-decoration:none">${URL}</a></p>
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
    `<p style="margin:0 0 16px">Hola <strong>${nombre}</strong>,</p>
     <p style="margin:0 0 20px">Tu anuncio ya está visible en VendeT-Venezuela para que miles de compradores lo vean.</p>
     ${card(`
       <p style="margin:0 0 8px;font-weight:600;font-size:16px;color:${COLORS.dark}">${titulo}</p>
       <p style="margin:0;font-size:22px;font-weight:700;color:${COLORS.primary}">$${precio} USD</p>
     `)}
     <p style="margin:24px 0 0;color:${COLORS.gray};font-size:14px">Consejo: revisa tu anuncio desde tu perfil para asegurarte de que la foto principal sea la mejor.</p>`,
    'Ver mi anuncio',
    `${URL}/producto/${slug}`,
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
