import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
  port: Number(process.env.ZOHO_SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_SMTP_USER,
    pass: process.env.ZOHO_SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
})

export interface EmailParams {
  to: string
  subject: string
  html: string
}

export async function enviarEmail(params: EmailParams) {
  if (!process.env.ZOHO_SMTP_USER || !process.env.ZOHO_SMTP_PASS) {
    console.error('⚠️ Zoho SMTP no configurado')
    return { success: false, error: 'SMTP no configurado' }
  }

  try {
    await transporter.sendMail({
      from: '"VendeT-Venezuela" <noreply@vendet.online>',
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    console.log(`✅ Email enviado a ${params.to}`)
    return { success: true }
  } catch (error) {
    console.error('❌ Error enviando email:', error)
    return { success: false, error }
  }
}
