'use client'

import { useEffect } from 'react'
import { esErrorRuidoIgnorable } from '@/lib/error-diagnostics'

const COOLDOWN_MS = 5 * 60 * 1000
const MAX_REPORTES_SESION = 12
const RUTAS_API_EXCLUIDAS = /^\/api\/(errores|admin\/errores|track|ga\/|inmueble\/visita)/i

let ultimaAccionSegura: string | null = null
let totalEnviadosSesion = 0
const enviadosRecientes = new Map<string, number>()

export interface PayloadErrorCliente {
  origen: 'cliente' | 'api' | 'red' | 'react_boundary'
  severidad?: 'critico' | 'error' | 'aviso'
  nombre: string
  mensaje: string
  codigoError?: string | number | null
  ruta?: string
  endpoint?: string | null
  accionPrevia?: string | null
  stack?: string | null
  statusHttp?: number | null
}

/**
 * Envía de forma asíncrona, deduplicada y sin bloquear el hilo principal un
 * reporte de error al endpoint interno `/api/errores`.
 */
export async function reportarErrorCliente(
  payload: PayloadErrorCliente,
): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    if (totalEnviadosSesion >= MAX_REPORTES_SESION) return null

    if (esErrorRuidoIgnorable(payload.nombre, payload.mensaje, payload.stack)) {
      return null
    }

    const rutaActual = payload.ruta || `${window.location.pathname}${window.location.search}`
    const claveDedup = `${payload.origen}|${payload.nombre}|${payload.codigoError || ''}|${rutaActual}|${payload.mensaje.slice(0, 120)}`
    const ahora = Date.now()
    const ultimoEnvio = enviadosRecientes.get(claveDedup)
    if (ultimoEnvio && ahora - ultimoEnvio < COOLDOWN_MS) {
      return null
    }

    enviadosRecientes.set(claveDedup, ahora)
    totalEnviadosSesion += 1

    const cuerpo = JSON.stringify({
      origen: payload.origen,
      severidad: payload.severidad,
      nombre: payload.nombre.slice(0, 120),
      mensaje: payload.mensaje.slice(0, 600),
      codigoError: payload.codigoError ? String(payload.codigoError).slice(0, 120) : null,
      ruta: rutaActual.slice(0, 300),
      endpoint: payload.endpoint ? payload.endpoint.slice(0, 300) : null,
      accionPrevia: (payload.accionPrevia ?? ultimaAccionSegura)?.slice(0, 240) || null,
      stack: payload.stack ? payload.stack.slice(0, 3000) : null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      statusHttp: payload.statusHttp ?? null,
    })

    const res = await fetch('/api/errores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      keepalive: true,
      credentials: 'same-origin',
    })

    if (res.ok) {
      const data = await res.json().catch(() => null)
      return typeof data?.codigoRef === 'string' ? data.codigoRef : null
    }
    return null
  } catch {
    return null
  }
}

function describirElementoSeguro(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const el = target.closest('button, a, [role="button"]')
  if (!el) return null

  const tag = el.tagName.toLowerCase() === 'a' ? 'enlace' : 'botón'
  const etiqueta = (
    el.getAttribute('aria-label') ||
    el.textContent ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)

  if (tag === 'enlace') {
    const href = el.getAttribute('href') || ''
    const destino = href.startsWith('/') ? ` (${href.split('?')[0].slice(0, 60)})` : ''
    return etiqueta ? `Click en enlace "${etiqueta}"${destino}` : `Click en enlace${destino}`
  }

  return etiqueta ? `Click en botón "${etiqueta}"` : 'Click en botón'
}

function resolverRutaApiMismoOrigen(input: RequestInfo | URL): string | null {
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    if (!raw) return null
    const parsed = new URL(raw, window.location.origin)
    if (parsed.origin !== window.location.origin) return null
    if (!parsed.pathname.startsWith('/api/')) return null
    if (RUTAS_API_EXCLUIDAS.test(parsed.pathname)) return null
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

export default function ClientErrorMonitor() {
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const desc = describirElementoSeguro(ev.target)
      if (desc) ultimaAccionSegura = desc
    }

    const onSubmit = () => {
      ultimaAccionSegura = `Envío de formulario en ${window.location.pathname}`
    }

    const onWindowError = (ev: ErrorEvent) => {
      const err = ev.error
      const nombre = err?.name || 'RuntimeError'
      const mensaje = err?.message || ev.message || 'Excepción en cliente'
      const stack = typeof err?.stack === 'string'
        ? err.stack
        : ev.filename
          ? `at ${ev.filename}:${ev.lineno || 0}:${ev.colno || 0}`
          : null

      setTimeout(() => {
        void reportarErrorCliente({
          origen: 'cliente',
          severidad: 'error',
          nombre,
          mensaje,
          codigoError: err?.code || null,
          stack,
        })
      }, 0)
    }

    const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason
      const nombre = reason?.name || 'UnhandledRejection'
      const mensaje =
        typeof reason?.message === 'string'
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Promesa rechazada sin capturar'
      const stack = typeof reason?.stack === 'string' ? reason.stack : null

      setTimeout(() => {
        void reportarErrorCliente({
          origen: 'cliente',
          severidad: 'error',
          nombre,
          mensaje,
          codigoError: reason?.code || reason?.status || null,
          stack,
        })
      }, 0)
    }

    // Observador ligero de fallos HTTP 5xx y caídas de red sobre `/api/*` propios
    const fetchOriginal = window.fetch.bind(window)
    const fetchInstrumentado: typeof window.fetch = async (input, init) => {
      const apiPath = resolverRutaApiMismoOrigen(input)
      if (!apiPath) {
        return fetchOriginal(input, init)
      }

      const metodo = (
        init?.method ||
        (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET') ||
        'GET'
      ).toUpperCase()

      try {
        const res = await fetchOriginal(input, init)
        if (res.status >= 500) {
          const accionSnapshot = ultimaAccionSegura
          const clon = res.clone()
          setTimeout(() => {
            void clon
              .text()
              .then(txt => {
                let detalle = `Respuesta HTTP ${res.status} en ${metodo} ${apiPath.split('?')[0]}`
                let codigoExtra: string | number = res.status
                try {
                  const json = JSON.parse(txt.slice(0, 1024))
                  if (typeof json?.error === 'string' && json.error.trim()) {
                    detalle = json.error.trim().slice(0, 300)
                  }
                  if (json?.code) {
                    codigoExtra = `${res.status}:${String(json.code).slice(0, 40)}`
                  }
                } catch {
                  // Ignorar si no es JSON
                }
                return reportarErrorCliente({
                  origen: 'api',
                  severidad: 'critico',
                  nombre: 'HttpServerError',
                  mensaje: detalle,
                  codigoError: codigoExtra,
                  endpoint: `${metodo} ${apiPath}`,
                  accionPrevia: accionSnapshot,
                  statusHttp: res.status,
                })
              })
              .catch(() => {})
          }, 0)
        }
        return res
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          const accionSnapshot = ultimaAccionSegura
          setTimeout(() => {
            void reportarErrorCliente({
              origen: 'red',
              severidad: 'aviso',
              nombre: err?.name || 'NetworkError',
              mensaje: err?.message || `Fallo de red solicitando ${metodo} ${apiPath.split('?')[0]}`,
              codigoError: 'ERR_NETWORK',
              endpoint: `${metodo} ${apiPath}`,
              accionPrevia: accionSnapshot,
            })
          }, 0)
        }
        throw err
      }
    }

    window.fetch = fetchInstrumentado
    window.addEventListener('click', onClick, { capture: true, passive: true })
    window.addEventListener('submit', onSubmit, { capture: true, passive: true })
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      window.fetch = fetchOriginal
      window.removeEventListener('click', onClick, { capture: true } as EventListenerOptions)
      window.removeEventListener('submit', onSubmit, { capture: true } as EventListenerOptions)
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
