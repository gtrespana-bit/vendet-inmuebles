import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'properties' })
  return {
    title: t('meta.title').replace(/\s*[-|]\s*Venezuela Inmuebles$/i, ''),
    description: t('meta.description'),
    alternates: {
      canonical: `https://venezuela-inmuebles.online${locale === 'en' ? '/en' : ''}/propiedades`,
      languages: {
        'es-VE': 'https://venezuela-inmuebles.online/propiedades',
        'en-US': 'https://venezuela-inmuebles.online/en/propiedades',
      },
    },
  }
}

export default async function PropiedadesPage({ params }: PageProps) {
  const { locale } = await params
  redirect(locale === 'en' ? '/en/propiedades/venta' : '/propiedades/venta')
}
