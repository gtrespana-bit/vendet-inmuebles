import { createHash } from 'crypto'
import { redactSensitiveText } from './sentry-scrubber.ts'
import {
  esErrorRuidoIgnorable,
  normalizarRutaParaAgrupacion,
  sanitizarUrlRuta,
  type OrigenError,
  type SeveridadError,
} from './error-diagnostics.ts'

export interface EntradaReporteError {
  origen?: string | null
  severidad?: string | null
  nombre?: string | null
  mensaje?: string | null
  codigoError?: string | number | null
  ruta?: string | null
  endpoint?: string | null
  accionPrevia?: string | null
  stack?: string | null
  userId?: string | null
  dispositivo?: string | null
  navegador?: string | null
  pais?: string | null
  viewport?: string | null
  statusHttp?: number | null
}

export interface ReporteErrorSanitizado {
  huella: string
  codigoRef: string
  origen: OrigenError
  severidad: SeveridadError
  nombre: string
  mensaje: string
  codigoError: string | null
  ruta: string
  endpoint: string | null
  accionPrevia: string | null
  stack: string | null
  userId: string | null
  dispositivo: string | null
  navegador: string | null
  pais: string | null
  muestra: Record<string, unknown>
}

const ORIGENES_VALIDOS = new Set<OrigenError>(['cliente', 'servidor', 'api', 'red', 'react_boundary'])
const SEVERIDADES_VALIDAS = new Set<SeveridadError>(['critico', 'error', 'aviso'])

function limpiarLinea(input: unknown, max: number): string | null {
  if (input === null || input === undefined) return null
  const texto = redactSensitiveText(String(input))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ')
    .trim()
  if (!texto) return null
  return texto.slice(0, max)
}

function limpiarStack(stack: unknown): string | null {
  if (typeof stack !== 'string' || !stack.trim()) return null
  const lineas = stack
    .split('\n')
    .slice(0, 18)
    .map(linea =>
      redactSensitiveText(linea)
        .replace(/([?&])(token|token_hash|code|access_token|refresh_token|secret|password)=([^&\s)]*)/gi, '$1$2=[REDACTED]')
        .trimEnd()
    )
    .filter(Boolean)

  if (lineas.length === 0) return null
  return lineas.join('\n').slice(0, 3000)
}

function normalizarMensajeParaHuella(mensaje: string): string {
  return mensaje
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\b\d{3,}\b/g, ':num')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

/**
 * Sanitiza, descarta ruidos benignos y calcula la huella determinista SHA-256 +
 * código corto `ERR-XXXXXX` para agrupar ocurrencias sin exponer PII ni secretos.
 */
export function construirReporteErrorSanitizado(
  entrada: EntradaReporteError,
): ReporteErrorSanitizado | null {
  const nombreCrudo = String(entrada.nombre ?? 'Error').trim() || 'Error'
  const mensajeCrudo = String(entrada.mensaje ?? '').trim()
  const stackCrudo = typeof entrada.stack === 'string' ? entrada.stack : null

  if (esErrorRuidoIgnorable(nombreCrudo, mensajeCrudo, stackCrudo)) {
    return null
  }

  const origenRaw = String(entrada.origen ?? 'cliente').toLowerCase() as OrigenError
  const origen: OrigenError = ORIGENES_VALIDOS.has(origenRaw) ? origenRaw : 'cliente'

  let severidadRaw = String(entrada.severidad ?? '').toLowerCase() as SeveridadError
  if (!SEVERIDADES_VALIDAS.has(severidadRaw)) {
    severidadRaw =
      origen === 'react_boundary' || origen === 'servidor' || (entrada.statusHttp && entrada.statusHttp >= 500)
        ? 'critico'
        : origen === 'red'
          ? 'aviso'
          : 'error'
  }

  const nombre = limpiarLinea(nombreCrudo, 120) || 'Error'
  const mensaje = limpiarLinea(mensajeCrudo, 600) || nombre
  const codigoError = limpiarLinea(entrada.codigoError, 120)
  const ruta = sanitizarUrlRuta(entrada.ruta, '/')

  let endpoint: string | null = null
  if (typeof entrada.endpoint === 'string' && entrada.endpoint.trim()) {
    const partes = entrada.endpoint.trim().split(/\s+/, 2)
    if (partes.length === 2 && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(partes[0])) {
      endpoint = `${partes[0].toUpperCase()} ${sanitizarUrlRuta(partes[1], '/')}`.slice(0, 300)
    } else {
      endpoint = sanitizarUrlRuta(entrada.endpoint, '/').slice(0, 300)
    }
  }

  const accionPrevia = limpiarLinea(entrada.accionPrevia, 240)
  const stack = limpiarStack(stackCrudo)

  const userId =
    typeof entrada.userId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrada.userId)
      ? entrada.userId
      : null

  const dispositivo = limpiarLinea(entrada.dispositivo, 40)
  const navegador = limpiarLinea(entrada.navegador, 60)
  const pais = limpiarLinea(entrada.pais, 8)
  const viewport = limpiarLinea(entrada.viewport, 32)
  const statusHttp =
    typeof entrada.statusHttp === 'number' && Number.isInteger(entrada.statusHttp) && entrada.statusHttp >= 100 && entrada.statusHttp <= 599
      ? entrada.statusHttp
      : null

  const endpointAgrupado = endpoint
    ? endpoint.replace(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i, (_, m, u) => `${m.toUpperCase()} ${normalizarRutaParaAgrupacion(u)}`)
    : ''

  const semillaHuella = [
    origen,
    nombre.toLowerCase(),
    (codigoError || '').toLowerCase(),
    endpointAgrupado || normalizarRutaParaAgrupacion(ruta),
    normalizarMensajeParaHuella(mensaje),
  ].join('|')

  const huella = createHash('sha256').update(semillaHuella).digest('hex')
  const codigoRef = `ERR-${huella.slice(0, 6).toUpperCase()}`

  return {
    huella,
    codigoRef,
    origen,
    severidad: severidadRaw,
    nombre,
    mensaje,
    codigoError,
    ruta,
    endpoint,
    accionPrevia,
    stack,
    userId,
    dispositivo,
    navegador,
    pais,
    muestra: {
      fecha: new Date().toISOString(),
      ruta,
      endpoint,
      accion_previa: accionPrevia,
      user_id: userId,
      dispositivo,
      navegador,
      pais,
      viewport,
      status_http: statusHttp,
    },
  }
}
