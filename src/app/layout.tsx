import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import {
  GA4_MEASUREMENT_ID,
  buildGa4BootstrapScript,
  isValidGaMeasurementId,
} from '@/lib/ga4'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let lang = 'es'
  try {
    const detected = await getLocale()
    if (detected === 'en' || detected === 'es') lang = detected
  } catch {
    lang = 'es'
  }

  const gaEnabled = isValidGaMeasurementId(GA4_MEASUREMENT_ID)

  return (
    <html lang={lang}>
      <head>
        {gaEnabled && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
            />
            <script
              id="ga4-init"
              dangerouslySetInnerHTML={{
                __html: buildGa4BootstrapScript(GA4_MEASUREMENT_ID),
              }}
            />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  )
}
