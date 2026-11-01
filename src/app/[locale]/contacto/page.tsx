import type { Metadata } from 'next'
import ContactForm from './ContactForm'
import { buildPageAlternates } from '@/lib/seo-metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const isEnglish = locale === 'en'

  return {
    title: isEnglish ? 'Contact' : 'Contacto',
    description: isEnglish
      ? 'Contact Venezuela Inmuebles with a question, suggestion or issue.'
      : 'Contacta a Venezuela Inmuebles si tienes una pregunta, sugerencia o problema.',
    alternates: buildPageAlternates(locale, '/contacto'),
  }
}

export default function ContactPage() {
  return <ContactForm />
}
