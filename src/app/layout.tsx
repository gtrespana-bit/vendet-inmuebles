import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'

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

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  )
}
