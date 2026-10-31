/**
 * Utilidades puras para los correos de notificación (sin dependencias de
 * Supabase, SMTP ni Next.js) para poder probarlas de forma aislada.
 */

export function formatearPrecioPropiedad(precio: unknown, moneda: unknown): string | null {
  const numeric = Number(precio)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const simbolo = moneda === 'VES' ? 'Bs.' : moneda === 'EUR' ? '€' : '$'
  try {
    return `${simbolo} ${numeric.toLocaleString('es-VE', { maximumFractionDigits: 0 })}`
  } catch {
    return `${simbolo} ${Math.round(numeric)}`
  }
}

export function limpiarPreviewMensaje(texto: unknown, maximo = 180): string {
  const limpio = String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limpio) return ''
  return limpio.length > maximo ? `${limpio.slice(0, maximo - 1).trimEnd()}…` : limpio
}

export function resumenMensajesNoLeidos(cantidad: number): string {
  const total = Math.max(1, Math.trunc(Number(cantidad) || 1))
  return total === 1 ? '1 mensaje sin leer' : `${total} mensajes sin leer`
}

/**
 * Límite de frecuencia: no se envía otro correo de chat si el anterior se
 * envió hace menos de `minutos` (por defecto 30).
 */
export function puedeEnviarAviso(
  ultimoEnvio: string | Date | null | undefined,
  ahora: Date = new Date(),
  minutos = 30,
): boolean {
  if (!ultimoEnvio) return true
  const fecha = ultimoEnvio instanceof Date ? ultimoEnvio : new Date(ultimoEnvio)
  if (Number.isNaN(fecha.getTime())) return true
  return ahora.getTime() - fecha.getTime() >= minutos * 60 * 1000
}
