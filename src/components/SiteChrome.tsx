'use client'

import { usePathname } from 'next/navigation'

/**
 * Decides whether the global site chrome (header, footer, PWA banners, mobile tab bar)
 * is rendered for the current route.
 *
 * The editorial landing page (`/` and `/en`) is a self-contained composition with its
 * own navigation and footer, so the standard chrome must not be rendered there.
 */
function isEditorialHome(pathname: string | null): boolean {
  if (!pathname) return false
  const withoutLocale = pathname.replace(/^\/(es|en)(?=\/|$)/, '')
  return withoutLocale === '' || withoutLocale === '/'
}

type SiteChromeProps = {
  header: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}

export default function SiteChrome({ header, footer, children }: SiteChromeProps) {
  const pathname = usePathname()
  const editorial = isEditorialHome(pathname)

  return (
    <>
      {!editorial && header}
      <main id="main-content" className={editorial ? undefined : 'min-h-screen bg-white'}>
        {children}
      </main>
      {!editorial && footer}
    </>
  )
}
