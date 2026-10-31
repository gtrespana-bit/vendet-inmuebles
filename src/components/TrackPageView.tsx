'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics-client'

function usePageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const search = searchParams?.toString()
    const ruta = pathname + (search ? `?${search}` : '')
    // No trackear el panel admin, dashboards ni APIs
    if (ruta.startsWith('/admin') || ruta.startsWith('/dashboard') || ruta.startsWith('/api')) return
    trackEvent('pageview', { ruta, titulo: document.title })
  }, [pathname, searchParams])
}

/**
 * Registra un pageview en cada navegación del App Router.
 * Debe envolver usePageView en <Suspense> (useSearchParams lo exige en estáticas).
 */
export default function TrackPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewInner />
    </Suspense>
  )
}

function PageViewInner() {
  usePageView()
  return null
}
