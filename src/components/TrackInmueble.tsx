'use client'

import { useEffect, useRef } from 'react'

/**
 * Registra una visita a la ficha de un inmueble (una vez por montaje):
 * incrementa el contador `visitas` y guarda el evento para el panel admin.
 */
export default function TrackInmueble({ id }: { id: string }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current || !id) return
    sent.current = true
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

  return null
}
