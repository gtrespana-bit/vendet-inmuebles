import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { AuthProvider } from '@/components/AuthProvider'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { headers, cookies } from 'next/headers'
import { routing } from '@/i18n/routing'
import { getServerUser } from '@/lib/supabase-server'

// Importar directamente SIN next/dynamic para evitar BAILOUT_TO_CLIENT_SIDE_RENDERING
// Estos componentes son pequeños y no justifican el overhead de dynamic imports
import PWAInstallBanner from '@/components/PWAInstallBanner'
import PushNotificationBanner from '@/components/PushNotificationBanner'
import BottomTabNav from '@/components/BottomTabNav'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
})

export const viewport: Viewport = {
  themeColor: '#008080',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  colorScheme: 'light',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://vendet.online'),
  title: {
    default: 'VendeT - Marketplace de Venezuela | Compra y Vende Fácil',
    template: '%s | VendeT',
  },
  description: 'El marketplace más grande de Venezuela. Compra y vende productos nuevos y usados de forma segura. Miles de vendedores verificados en Caracas, Maracaibo, Valencia y toda Venezuela.',
  keywords: [
    'marketplace venezuela',
    'compra venta venezuela',
    'vender online venezuela',
    'marketplace caracas',
    'tienda online venezuela',
    'ecommerce venezuela',
    'clasificados venezuela',
    'ventas online venezuela',
    'marketplace maracaibo',
    'marketplace valencia venezuela',
    'anuncios clasificados venezuela',
    'venta de carros venezuela',
    'tecnologia usada venezuela',
    'moda segunda mano venezuela',
    'hogar venezuela',
    'herramientas venezuela',
    'repuestos venezuela',
    'materiales venezuela',
  ],
  authors: [{ name: 'VendeT' }],
  creator: 'VendeT',
  publisher: 'VendeT',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: 'https://vendet.online',
    siteName: 'VendeT',
    title: 'VendeT - Marketplace de Venezuela | Compra y Vende Fácil',
    description: 'El marketplace más grande de Venezuela. Compra y vende productos nuevos y usados de forma segura.',
    images: [
      {
        url: '/og-image.webp',
        width: 1200,
        height: 630,
        alt: 'VendeT Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VendeT - Marketplace de Venezuela',
    description: 'Compra y vende productos nuevos y usados de forma segura en Venezuela.',
    images: ['/og-image.webp'],
    creator: '@vendet',
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
    canonical: 'https://vendet.online',
    languages: {
      'es-VE': 'https://vendet.online',
      'en-US': 'https://vendet.online/en',
    },
  },
  verification: {
    google: 'google-site-verification=vendet-online-verification-code',
  },
  category: 'marketplace',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialUser = await getServerUser()

  const headersList = await headers()
  const detectedLocale = headersList.get('x-detected-locale')
  
  let lang = 'es'
  if (detectedLocale && routing.locales.includes(detectedLocale as any)) {
    lang = detectedLocale
  } else {
    const cookieStore = await cookies()
    const localeCookie = cookieStore.get('NEXT_LOCALE')
    if (localeCookie?.value && routing.locales.includes(localeCookie.value as any)) {
      lang = localeCookie.value
    }
  }

  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://byqrmrcoinybbcmdnnwn.supabase.co" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://byqrmrcoinybbcmdnnwn.supabase.co" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VendeT" />
        <meta name="application-name" content="VendeT" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-192x192.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="geo.region" content="VE" />
        <meta name="geo.placename" content="Venezuela" />
        <meta name="language" content="Spanish" />
        <meta name="revisit-after" content="1 days" />
        <meta name="rating" content="General" />
        <meta name="distribution" content="Global" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'VendeT',
              url: 'https://vendet.online',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://vendet.online/buscar?q={search_term_string}',
                'query-input': 'required name=search_term_string'
              },
              publisher: {
                '@type': 'Organization',
                name: 'VendeT',
                url: 'https://vendet.online',
                logo: 'https://vendet.online/icons/icon-192x192.png',
                sameAs: [
                  'https://instagram.com/vendet',
                  'https://twitter.com/vendet',
                  'https://facebook.com/vendet'
                ]
              }
            })
          }}
        />
      </head>
      <body className="bg-white antialiased" suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:shadow-lg">
          Skip to main content
        </a>
        <AuthProvider initialUser={initialUser}>
          <Header />
          <main id="main-content" className="min-h-screen bg-white" suppressHydrationWarning>{children}</main>
          <Footer />
          <PWAInstallBanner />
          <PushNotificationBanner />
          <BottomTabNav />
        </AuthProvider>
        {/* Re-enable Vercel Analytics and SpeedInsights with lazy initialization */}
        <Analytics />
        <SpeedInsights />
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
