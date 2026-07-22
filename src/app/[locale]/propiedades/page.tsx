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
    title: t('meta.title'),
    description: t('meta.description')
  }
}

export default async function PropiedadesPage({ params }: PageProps) {
  const { locale } = await params
  
  // Redirigir a la página de venta por defecto
  redirect(`/${locale}/propiedades/venta`)
}
