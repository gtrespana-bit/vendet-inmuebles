'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { ContactChannel } from '@/lib/listing-funnel'

interface TrackedContactLinkProps {
  href: string
  channel: ContactChannel
  propertyId?: string | null
  sellerId?: string | null
  external?: boolean
  className?: string
  ariaLabel?: string
  children: ReactNode
}

function sendContactBeacon(payload: {
  channel: ContactChannel
  propertyId?: string | null
  sellerId?: string | null
}) {
  if (typeof window === 'undefined') return
  try {
    let sessionId: string | null = null
    try {
      sessionId = sessionStorage.getItem('vi_sid')
      if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
        sessionStorage.setItem('vi_sid', sessionId)
      }
    } catch {
      // sessionStorage bloqueado
    }

    const body = JSON.stringify({
      tipo: 'click_contacto',
      ruta: window.location.pathname,
      sessionId,
      meta: {
        canal: payload.channel,
        ...(payload.propertyId ? { inmueble_id: payload.propertyId } : {}),
        ...(payload.sellerId ? { vendedor_id: payload.sellerId } : {}),
      },
    })

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/track', blob)
      return
    }

    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Nunca interrumpir la navegación por analítica
  }
}

export default function TrackedContactLink({
  href,
  channel,
  propertyId,
  sellerId,
  external = false,
  className,
  ariaLabel,
  children,
}: TrackedContactLinkProps) {
  const handleClick = () => {
    sendContactBeacon({ channel, propertyId, sellerId })
  }

  if (external || href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:')) {
    const openNewTab = href.startsWith('http')
    return (
      <a
        href={href}
        onClick={handleClick}
        className={className}
        aria-label={ariaLabel}
        {...(openNewTab ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

  return (
    <Link href={href} onClick={handleClick} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}
