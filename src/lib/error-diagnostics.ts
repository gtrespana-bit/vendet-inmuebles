/**
 * Utilidades isomórficas (seguras en cliente y servidor) para filtrado de ruido,
 * sanitización de URLs/rutas y diagnóstico rápido en español de errores del sistema.
 */

export type OrigenError = 'cliente' | 'servidor' | 'api' | 'red' | 'react_boundary'
export type SeveridadError = 'critico' | 'error' | 'aviso'
export type EstadoError = 'nuevo' | 'en_revision' | 'resuelto' | 'ignorado' | 'reabierto'

const PARAMETROS_SENSIBLES =
  /^(token|token_hash|code|access_token|refresh_token|secret|password|pass|apikey|api_key|email|phone|telefono|cedula|otp)$/i

const PATRONES_RUIDO_IGNORABLE = [
  /ResizeObserver loop/i,
  /ResizeObserver.*undelivered notifications/i,
  /^Script error\.?$/i,
  /NEXT_REDIRECT/i,
  /NEXT_NOT_FOUND/i,
  /DYNAMIC_SERVER_USAGE/i,
  /The user aborted a request/i,
  /signal is aborted without reason/i,
  /AbortError/i,
  /Non-Error promise rejection captured with value: undefined/i,
  /webkit-masked-url/i,
]

const PATRONES_EXTENSIONES = [
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /safari-web-extension:\/\//i,
  /MetaMask/i,
  /LastPass/i,
  /Grammarly/i,
]

/**
 * Descarta ruidos benignos del navegador, redirecciones internas de Next.js
 * o errores provocados por extensiones externas del usuario.
 */
export function esErrorRuidoIgnorable(
  nombre?: string | null,
  mensaje?: string | null,
  stack?: string | null,
): boolean {
  const n = String(nombre ?? '').trim()
  const m = String(mensaje ?? '').trim()
  const s = String(stack ?? '').trim()
  const combinado = `${n}: ${m}`

  if (!n && !m) return true
  if (n === 'AbortError') return true

  for (const rx of PATRONES_RUIDO_IGNORABLE) {
    if (rx.test(combinado) || rx.test(m)) return true
  }

  for (const rx of PATRONES_EXTENSIONES) {
    if (rx.test(combinado) || rx.test(s)) return true
  }

  return false
}

/**
 * Limpia una ruta o URL eliminando fragmentos `#...` y ocultando cualquier
 * parámetro sensible en la query string (`token`, `code`, `password`, etc.).
 */
export function sanitizarUrlRuta(rawUrl: unknown, fallback = '/'): string {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return fallback
  const texto = rawUrl.trim().slice(0, 1000)

  try {
    const base = 'https://venezuela-inmuebles.online'
    const parsed = texto.startsWith('http://') || texto.startsWith('https://')
      ? new URL(texto)
      : new URL(texto.startsWith('/') ? texto : `/${texto}`, base)

    const paramsLimpios = new URLSearchParams()
    parsed.searchParams.forEach((val, key) => {
      if (PARAMETROS_SENSIBLES.test(key)) {
        paramsLimpios.set(key, '[REDACTED]')
      } else {
        paramsLimpios.set(key, val.slice(0, 80))
      }
    })

    const qs = paramsLimpios.toString()
    const pathname = parsed.pathname || '/'
    return `${pathname}${qs ? `?${qs}` : ''}`.slice(0, 300)
  } catch {
    return texto
      .split('#')[0]
      .replace(/([?&])(token|token_hash|code|access_token|refresh_token|secret|password)=([^&]*)/gi, '$1$2=[REDACTED]')
      .slice(0, 300)
  }
}

/**
 * Normaliza segmentos dinámicos (UUIDs, números largos, tokens de invitación)
 * para agrupar ocurrencias equivalentes bajo la misma huella.
 */
export function normalizarRutaParaAgrupacion(ruta: string): string {
  const sinQuery = sanitizarUrlRuta(ruta).split('?')[0] || '/'
  return sinQuery
    .replace(/^\/(es|en)(?=\/|$)/i, '')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    .replace(/\/invitacion\/[A-Za-z0-9_-]{12,}/g, '/invitacion/:token')
    .replace(/\/\d{2,}/g, '/:id') || '/'
}

export interface DiagnosticoRapido {
  titulo: string
  causa: string
  solucion: string
}

/**
 * Traduce códigos técnicos frecuentes (PostgreSQL, PostgREST, HTTP, Next.js y
 * navegador) a una explicación directa y accionable en español para el Admin.
 */
export function diagnosticarCausaProbable(item: {
  origen?: string | null
  nombre?: string | null
  mensaje?: string | null
  codigo_error?: string | null
  endpoint?: string | null
}): DiagnosticoRapido {
  const codigo = String(item.codigo_error ?? '').toUpperCase()
  const texto = `${item.nombre ?? ''} ${item.mensaje ?? ''} ${item.codigo_error ?? ''} ${item.endpoint ?? ''}`

  if (/ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(texto)) {
    return {
      titulo: 'Cambio de versión tras un despliegue',
      causa: 'El usuario tenía abierta una pestaña antigua mientras se publicó una nueva versión del sitio en Vercel.',
      solucion: 'Suele resolverse automáticamente al recargar la página. Solo requiere acción si persiste en usuarios con pestañas recién abiertas.',
    }
  }

  if (codigo === '42501' || /row-level security|permission denied/i.test(texto)) {
    return {
      titulo: 'Permiso bloqueado en base de datos (RLS)',
      causa: 'Una consulta o escritura fue rechazada por las políticas de seguridad (RLS) de Supabase.',
      solucion: 'Verifica la ruta afectada y confirma si la operación debe pasar por un endpoint de servidor autenticado o ajustar su política RLS.',
    }
  }

  if (codigo === '23505' || /duplicate key value violates unique constraint/i.test(texto)) {
    return {
      titulo: 'Registro duplicado (clave única)',
      causa: 'Se intentó guardar un valor único que ya existía (por ejemplo: slug de escaparate, referencia de pago o correo).',
      solucion: 'Revisa la validación previa del formulario en esa ruta para mostrar un aviso amigable antes del guardado.',
    }
  }

  if (codigo === '23503' || /violates foreign key constraint/i.test(texto)) {
    return {
      titulo: 'Referencia inexistente (clave foránea)',
      causa: 'La operación apuntó a un inmueble, usuario o registro que ya había sido eliminado.',
      solucion: 'Comprueba que el registro exista antes de ejecutar la acción secundaria.',
    }
  }

  if (codigo === 'PGRST116' || /JSON object requested, multiple \(or no\) rows returned/i.test(texto)) {
    return {
      titulo: 'Consulta esperaba 1 fila exacta (PGRST116)',
      causa: 'Se usó `.single()` en Supabase y la tabla devolvió 0 filas o más de una.',
      solucion: 'Sustituir `.single()` por `.maybeSingle()` en la consulta del endpoint o componente indicado.',
    }
  }

  if (codigo === '413' || /Payload Too Large|body exceeded|Entity Too Large/i.test(texto)) {
    return {
      titulo: 'Archivo o imagen demasiado pesada (HTTP 413)',
      causa: 'El usuario intentó subir una fotografía o comprobante que excede el peso máximo permitido.',
      solucion: 'Verifica la compresión previa en el cliente o el límite máximo configurado en la subida.',
    }
  }

  if (codigo === '429' || /Too Many Requests|rate.?limit/i.test(texto)) {
    return {
      titulo: 'Límite de frecuencia alcanzado (HTTP 429)',
      causa: 'La IP o el usuario realizó demasiadas solicitudes seguidas y el limitador de protección actuó.',
      solucion: 'Si es un usuario legítimo subiendo muchos anuncios o fotos, revisa el umbral en `src/lib/rate-limit.ts`.',
    }
  }

  if (codigo === '504' || codigo === 'ETIMEDOUT' || /timeout|timed out/i.test(texto)) {
    return {
      titulo: 'Tiempo de espera agotado (Timeout)',
      causa: 'Una llamada externa (SMTP, OCR, almacenamiento o base de datos) tardó más de lo previsto.',
      solucion: 'Revisa el endpoint señalado y valida la latencia del servicio externo implicado.',
    }
  }

  if (/Failed to fetch|NetworkError|Load failed|ERR_NETWORK/i.test(texto) || item.origen === 'red') {
    return {
      titulo: 'Fallo de conexión de red del usuario',
      causa: 'El navegador del usuario perdió conexión a internet o tuvo microcortes móviles durante una petición.',
      solucion: 'Normal en redes móviles inestables; solo investiga si ocurre masivamente desde distintos usuarios al mismo minuto.',
    }
  }

  if (
    /Attempted to call .* from the server but .* is on the client|Functions cannot be passed directly to Client Components|Event handlers cannot be passed to Client Component props/i.test(
      texto,
    )
  ) {
    return {
      titulo: 'Frontera Servidor/Cliente de React (RSC)',
      causa: 'Un Server Component invocó una función exportada desde un módulo con `"use client"` o pasó una función no serializable a un Client Component.',
      solucion: 'Mueve las funciones puras compartidas a un módulo sin `"use client"` en `src/lib/` para que puedan ejecutarse tanto en SSR como en el navegador.',
    }
  }

  if (
    /Invalid src prop .* hostname .* is not configured under images/i.test(
      texto,
    )
  ) {
    return {
      titulo: 'Dominio de imagen externo no autorizado en Next/Image',
      causa: 'Un componente `<Image>` recibió una URL externa cuyo dominio no figura en `images.remotePatterns` y no tenía `unoptimized`.',
      solucion: 'Aplica `unoptimized={!isOptimizableImageSrc(src)}` desde `@/lib/image-src` o añade el dominio de almacenamiento en `next.config.js`.',
    }
  }

  if (/Hydration failed|Minified React error #(418|423|425)/i.test(texto)) {
    return {
      titulo: 'Desajuste de hidratación en React',
      causa: 'El HTML renderizado en el servidor difirió del primer render en el navegador (p. ej. fechas según zona horaria o traducciones automáticas del navegador).',
      solucion: 'Revisa los componentes de la ruta indicada que dependan de `Date`, `window` o `localStorage` durante el render inicial.',
    }
  }

  if (/QuotaExceededError|The quota has been exceeded/i.test(texto)) {
    return {
      titulo: 'Almacenamiento local lleno o restringido',
      causa: 'El navegador del usuario bloqueó `localStorage`/`sessionStorage` (común en navegación privada estricta o memoria llena).',
      solucion: 'Envuelve el acceso a `localStorage` con `try/catch` en la ruta afectada.',
    }
  }

  if (codigo.startsWith('5') || item.origen === 'servidor' || item.origen === 'api') {
    return {
      titulo: 'Error interno en servidor o endpoint API',
      causa: 'Una ruta del backend devolvió un fallo no controlado al procesar la solicitud del usuario.',
      solucion: 'Revisa el endpoint, el código de error y la traza técnica adjunta para localizar la línea exacta.',
    }
  }

  return {
    titulo: 'Excepción en la interfaz del usuario',
    causa: 'Se produjo un error inesperado en el navegador mientras el usuario interactuaba con esta pantalla.',
    solucion: 'Revisa la última acción previa del usuario y la traza para reproducir el caso rápidamente.',
  }
}
