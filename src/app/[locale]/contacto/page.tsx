import type { Metadata } from 'next'
import ContactForm from './ContactForm'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const isEnglish = locale === 'en'

  return {
    title: isEnglish ? 'Contact | Venezuela Inmuebles' : 'Contacto | Venezuela Inmuebles',
    description: isEnglish
      ? 'Contact Venezuela Inmuebles with a question, suggestion or issue.'
      : 'Contacta a Venezuela Inmuebles si tienes una pregunta, sugerencia o problema.',
  }
}

export default function ContactPage() {
  return <ContactForm />
}
