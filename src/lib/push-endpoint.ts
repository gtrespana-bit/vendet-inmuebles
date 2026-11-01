/**
 * Validación del endpoint de una suscripción push (F07).
 *
 * El servidor hace una petición HTTP al `endpoint` que envía el navegador:
 * aceptar cualquier URL HTTPS permitía usar la cuenta como proxy hacia
 * destinos internos (SSRF) o hacia terceros arbitrarios. Solo se admiten los
 * servicios push de los navegadores habituales, por HTTPS y puerto estándar.
 */

/** Dominios exactos de servicios push conocidos. */
const HOSTS_EXACTOS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])

/** Sufijos admitidos (cubren variantes regionales y de canal de cada proveedor). */
const SUFIJOS = [
  '.googleapis.com',
  '.push.services.mozilla.com',
  '.notify.windows.com',
  '.push.apple.com',
  '.push.services.mozilla.org',
  '.wns.windows.com',
]

function esIPv4(host: string): boolean {
  const partes = host.split('.')
  if (partes.length !== 4) return false
  return partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

export function esEndpointPushPermitido(endpoint: unknown): boolean {
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) return false

  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }

  if (url.protocol !== 'https:') return false
  if (url.username || url.password) return false
  if (url.port && url.port !== '443') return false

  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host || host.includes('..')) return false
  if (esIPv4(host) || host.startsWith('[') || host === 'localhost') return false

  if (HOSTS_EXACTOS.has(host)) return true
  return SUFIJOS.some((sufijo) => host.endsWith(sufijo))
}
