'use client'

import { useEffect, useRef } from 'react'
import { trackGa4Event } from '@/lib/ga4'

function getOrCreateSessionId(): string | null {
  try {
    let sid = sessionStorage.getItem('vi_sid')
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
      sessionStorage.setItem('vi_sid', sid)
    }
    return sid
  } catch {
    return null
  }
}

function sendInternalTrack(tipo: string, meta: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({
      tipo,
      ruta: window.location.pathname,
      sessionId: getOrCreateSessionId(),
      meta,
    })
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon('/api/track', blob)) return
    }
    fetch('/api/track', {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => { /* silencio */ })
  } catch {
    /* silencio */
  }
}

/**
 * Registra una visita a la ficha de un inmueble (una vez por montaje):
 * incrementa el contador `visitas`, guarda eventos de embudo (`vista_inmueble`,
 * `click_contacto`) en `eventos_web` y reporta `view_item` / `generate_lead` a GA4.
 */
export default function TrackInmueble({ id }: { id: string }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current || !id) return
    sent.current = true
    trackGa4Event('view_item', { item_id: id, content_type: 'property' })
    try {
      const bodyStr = JSON.stringify({ id, sessionId: getOrCreateSessionId() })
      const blob = new Blob([bodyStr], { type: 'application/json' })
      if (navigator.sendBeacon && navigator.sendBeacon('/api/inmueble/visita', blob)) return
      fetch('/api/inmueble/visita', {
        method: 'POST',
        body: bodyStr,
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
        sendInternalTrack('click_contacto', { inmueble_id: id, canal: 'whatsapp' })
      } else if (href.startsWith('tel:')) {
        trackGa4Event('generate_lead', { method: 'phone', item_id: id })
        sendInternalTrack('click_contacto', { inmueble_id: id, canal: 'llamar' })
      } else if (href.includes('/chat?producto_id=')) {
        trackGa4Event('generate_lead', { method: 'chat', item_id: id })
        sendInternalTrack('click_contacto', { inmueble_id: id, canal: 'chat' })
      } else if (href.startsWith('mailto:')) {
        trackGa4Event('generate_lead', { method: 'email', item_id: id })
        sendInternalTrack('click_contacto', { inmueble_id: id, canal: 'email' })
      } else if (href.includes('m.me/') || href.includes('messenger.com/')) {
        trackGa4Event('generate_lead', { method: 'messenger', item_id: id })
        sendInternalTrack('click_contacto', { inmueble_id: id, canal: 'messenger' })
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [id])

  return null
}
