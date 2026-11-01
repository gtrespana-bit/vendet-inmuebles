'use client'

import { useEffect, useRef } from 'react'
import { trackGa4Event } from '@/lib/ga4'

/**
 * Registra una visita a la ficha de un inmueble (una vez por montaje):
 * incrementa el contador `visitas`, guarda el evento para el panel admin
 * y reporta `view_item` / conversiones `generate_lead` a Google Analytics 4.
 */
export default function TrackInmueble({ id }: { id: string }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current || !id) return
    sent.current = true
    trackGa4Event('view_item', { item_id: id, content_type: 'property' })
    try {
      const blob = new Blob([JSON.stringify({ id })], { type: 'application/json' })
      if (navigator.sendBeacon && navigator.sendBeacon('/api/inmueble/visita', blob)) return
      fetch('/api/inmueble/visita', {
        method: 'POST',
        body: JSON.stringify({ id }),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => { /* silencio */ })
    } catch { /* silencio */ }
  }, [id])

  useEffect(() => {
    if (!id) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (href.includes('wa.me/')) {
        trackGa4Event('generate_lead', { method: 'whatsapp', item_id: id })
      } else if (href.startsWith('tel:')) {
        trackGa4Event('generate_lead', { method: 'phone', item_id: id })
      } else if (href.includes('/chat?producto_id=')) {
        trackGa4Event('generate_lead', { method: 'chat', item_id: id })
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [id])

  return null
}
