/**
 * Política de subida de fotos de anuncios (F06).
 *
 * El límite de tamaño debe caber en el cuerpo de una función de Vercel
 * (~4,5 MB), no en los 8 MB que anunciaba el formulario: por encima del
 * límite de la plataforma la petición se rechaza antes de llegar al código.
 *
 * El tipo se decide decodificando la imagen con sharp, nunca por el MIME
 * declarado por el navegador, y se reescribe en WebP sin metadatos.
 */

/** 4 MB: por debajo del límite de cuerpo de Vercel y del que aceptan los comprobantes. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/** Imágenes mayores: se rechazan antes de reservar memoria para decodificarlas. */
export const MAX_UPLOAD_PIXELS = 40_000_000

/** Lado máximo admitido en el archivo original. */
export const MAX_UPLOAD_DIMENSION = 8000

/** Lado máximo del archivo guardado (el resto se reduce). */
export const MAX_STORED_DIMENSION = 2560

export const FORMATOS_ADMITIDOS = ['jpeg', 'png', 'webp'] as const
export type FormatoImagen = (typeof FORMATOS_ADMITIDOS)[number]

export function esFormatoAdmitido(formato: string | undefined | null): formato is FormatoImagen {
  return !!formato && (FORMATOS_ADMITIDOS as readonly string[]).includes(formato)
}

/**
 * Reemplaza la extensión de la clave por la del formato real detectado, para
 * que el archivo guardado y su `Content-Type` no puedan contradecirse.
 */
export function claveNormalizada(key: string, formato: FormatoImagen): string {
  const sinExtension = key.replace(/\.[A-Za-z0-9]{1,5}$/, '')
  return `${sinExtension}.${formato === 'jpeg' ? 'jpg' : formato}`
}

/** Motivo legible cuando el archivo no se puede aceptar (o null si es válido). */
export function motivoRechazo(datos: {
  bytes: number
  ancho?: number
  alto?: number
  formato?: string
}): string | null {
  if (datos.bytes <= 0) return 'El archivo está vacío'
  if (datos.bytes > MAX_UPLOAD_BYTES) return 'La imagen supera el máximo de 4 MB'
  if (!esFormatoAdmitido(datos.formato)) return 'El archivo no es una imagen JPG, PNG o WebP válida'
  const ancho = datos.ancho ?? 0
  const alto = datos.alto ?? 0
  if (ancho < 1 || alto < 1) return 'El archivo no es una imagen válida'
  if (ancho > MAX_UPLOAD_DIMENSION || alto > MAX_UPLOAD_DIMENSION) return 'La imagen supera el tamaño permitido'
  if (ancho * alto > MAX_UPLOAD_PIXELS) return 'La imagen tiene demasiados píxeles'
  return null
}
