import nodemailer from 'nodemailer'
import { htmlToPlainText } from './plain-text-email'

const smtpPort = Number(process.env.SMTP_PORT) || 465
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER || 'resend',
    pass: process.env.SMTP_PASS,
  },
})

export interface EmailParams {
  to: string
  subject: string
  html: string
}

export async function enviarEmail(params: EmailParams) {
  if (!process.env.SMTP_PASS) {
    console.error('⚠️ SMTP no configurado')
    return { success: false, error: 'SMTP no configurado' }
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Venezuela Inmuebles" <noreply@venezuela-inmuebles.online>',
      replyTo: 'contacto@venezuela-inmuebles.online',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: htmlToPlainText(params.html),
    })
    console.log(`✅ Email enviado a ${params.to}`)
    return { success: true }
  } catch (error) {
    console.error('❌ Error enviando email:', error)
    return { success: false, error }
  }
}
