import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AuthProvider } from '@/components/AuthProvider'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import BottomTabNav from '@/components/BottomTabNav'

export const viewport: Viewport = {
  themeColor: '#008080',
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
  
  const metadataBase = new URL('https://vendet-inmuebles.online')
  const canonicalUrl = locale === 'es' 
    ? 'https://vendet-inmuebles.online' 
    : `https://vendet-inmuebles.online/${locale}`

  return {
    metadataBase,
    title: {
      default: locale === 'es' 
        ? 'VendeT Inmuebles - Bienes Raíces en Venezuela | Casas, Apartamentos, Terrenos'
        : 'VendeT Real Estate - Properties in Venezuela | Houses, Apartments, Land',
      template: '%s | VendeT Inmuebles',
    },
    description: locale === 'es'
      ? 'El portal líder de bienes raíces en Venezuela. Encuentra casas, apartamentos, terrenos, locales y oficinas en venta y alquiler en todo el país.'
      : 'The leading real estate portal in Venezuela. Find houses, apartments, land, commercial spaces and offices for sale and rent across the country.',
    keywords: locale === 'es'
      ? ['inmuebles venezuela', 'casas en venta venezuela', 'apartamentos venezuela', 'terrenos venezuela', 'alquiler venezuela', 'bienes raices venezuela', 'propiedades venezuela', 'inmobiliaria venezuela']
      : ['venezuela real estate', 'houses for sale venezuela', 'apartments venezuela', 'land venezuela', 'rent venezuela', 'properties venezuela'],
    authors: [{ name: 'VendeT Inmuebles' }],
    creator: 'VendeT Inmuebles',
    publisher: 'VendeT Inmuebles',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      locale: locale === 'es' ? 'es_VE' : 'en_US',
      url: canonicalUrl,
      siteName: 'VendeT Inmuebles',
      title: locale === 'es'
        ? 'VendeT Inmuebles - Bienes Raíces en Venezuela'
        : 'VendeT Real Estate - Properties in Venezuela',
      description: locale === 'es'
        ? 'El portal líder de bienes raíces en Venezuela. Encuentra tu próximo hogar o inversión.'
        : 'The leading real estate portal in Venezuela. Find your next home or investment.',
      images: [{
        url: 'https://vendet-inmuebles.online/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VendeT Inmuebles - Bienes Raíces Venezuela'
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: locale === 'es'
        ? 'VendeT Inmuebles - Bienes Raíces en Venezuela'
        : 'VendeT Real Estate - Properties in Venezuela',
      description: locale === 'es'
        ? 'El portal líder de bienes raíces en Venezuela.'
        : 'The leading real estate portal in Venezuela.',
      images: ['https://vendet-inmuebles.online/og-image.png'],
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
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'es-VE': 'https://vendet-inmuebles.online',
        'en-US': 'https://vendet-inmuebles.online/en',
      },
    },
    verification: {
      google: 'google-site-verification=vendet-inmuebles-verification-code',
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

  return (
    <html lang={locale}>
      <body className="bg-white antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:shadow-lg">
          Skip to main content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <Header />
            <main id="main-content" className="min-h-screen bg-white">{children}</main>
            <Footer />
            <PWAInstallBanner />
            <PushNotificationBanner />
            <BottomTabNav />
          </AuthProvider>
          <Analytics />
          <SpeedInsights />
          <ServiceWorkerRegistration />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
