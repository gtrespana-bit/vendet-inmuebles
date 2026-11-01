import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Metadata, Viewport } from 'next'
import '../globals.css'
// Fuentes variables autoalojadas: sin peticiones externas ni layout shift (en todas las páginas)
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AuthProvider } from '@/components/AuthProvider'
import EmailConfirmationRedirect from '@/components/EmailConfirmationRedirect'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import AnalyticsGate from '@/components/AnalyticsGate'
import GoogleAnalyticsTracker from '@/components/GoogleAnalyticsTracker'
import ClientErrorMonitor from '@/components/ClientErrorMonitor'
import CookieConsent from '@/components/CookieConsent'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import BottomTabNav from '@/components/BottomTabNav'

export const viewport: Viewport = {
  themeColor: '#16294B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  colorScheme: 'light',
}

async function getDictionary(locale: string) {
  return (await import(`@/i18n/dictionaries/${locale}.json`)).default
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  
  const metadataBase = new URL('https://venezuela-inmuebles.online')

  return {
    metadataBase,
    title: {
      default: locale === 'es' 
        ? 'Venezuela Inmuebles | Casas, apartamentos y terrenos en venta y alquiler'
        : 'Venezuela Inmuebles | Homes, apartments and land for sale and rent',
      template: '%s | Venezuela Inmuebles',
    },
    description: locale === 'es'
      ? 'Explora casas, apartamentos, terrenos, locales y oficinas en venta y alquiler en Venezuela.'
      : 'Explore houses, apartments, land, commercial spaces and offices for sale and rent in Venezuela.',
    keywords: locale === 'es'
      ? ['inmuebles venezuela', 'casas en venta venezuela', 'apartamentos venezuela', 'terrenos venezuela', 'alquiler venezuela', 'bienes raices venezuela', 'propiedades venezuela', 'inmobiliaria venezuela']
      : ['venezuela real estate', 'houses for sale venezuela', 'apartments venezuela', 'land venezuela', 'rent venezuela', 'properties venezuela'],
    authors: [{ name: 'Venezuela Inmuebles' }],
    creator: 'Venezuela Inmuebles',
    publisher: 'Venezuela Inmuebles',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      locale: locale === 'es' ? 'es_VE' : 'en_US',
      siteName: 'Venezuela Inmuebles',
      title: locale === 'es'
        ? 'Venezuela Inmuebles | Propiedades en venta y alquiler'
        : 'Venezuela Inmuebles | Properties for sale and rent',
      description: locale === 'es'
        ? 'Explora inmuebles en venta y alquiler en Venezuela y encuentra tu próximo hogar o inversión.'
        : 'Explore properties for sale and rent in Venezuela and find your next home or investment.',
      images: [{
        url: 'https://venezuela-inmuebles.online/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Venezuela Inmuebles, propiedades en Venezuela'
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: locale === 'es'
        ? 'Venezuela Inmuebles | Propiedades en venta y alquiler'
        : 'Venezuela Inmuebles | Properties for sale and rent',
      description: locale === 'es'
        ? 'Explora inmuebles en venta y alquiler en Venezuela.'
        : 'Explore properties for sale and rent in Venezuela.',
      images: ['https://venezuela-inmuebles.online/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    category: 'real_estate',
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as any)) {
    notFound()
  }

  const messages = await getDictionary(locale)
  const skipLabel = locale === 'en' ? 'Skip to main content' : 'Saltar al contenido principal'

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:shadow-lg">
        {skipLabel}
      </a>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthProvider>
          <EmailConfirmationRedirect />
          <Header />
          <main id="main-content" className="min-h-screen bg-white">{children}</main>
          <Footer />
          <PWAInstallBanner />
          <PushNotificationBanner />
          <BottomTabNav />
          <CookieConsent />
        </AuthProvider>
        <GoogleAnalyticsTracker />
        <AnalyticsGate />
        <ClientErrorMonitor />
        <ServiceWorkerRegistration />
      </NextIntlClientProvider>
    </>
  )
}
