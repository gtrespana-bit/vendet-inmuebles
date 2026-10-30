/**
 * Compresión de imágenes en el navegador antes de subirlas.
 *
 * Motivo: Vercel rechaza con 413 cualquier request body > 4.5 MB
 * (límite de plataforma, no configurable). Las fotos de móvil suelen
 * pesar 4-8 MB, así que las redimensionamos/comprimimos en cliente
 * para que suban en ~100-400 KB sin pérdida visual apreciable.
 */

const MAX_EDGE = 1920 // lado máximo (mantiene ≥1600px para el puntaje de foto)
const QUALITY = 0.82
const SKIP_BELOW_BYTES = 350 * 1024 // JPEGs pequeños se suben tal cual

/**
 * Devuelve un File JPEG comprimido. Si la imagen ya es pequeña, no se puede
 * decodificar (p. ej. HEIC en navegador sin soporte) o la compresión no
 * reduce el tamaño, devuelve el archivo original.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    if (file.type === 'image/jpeg' && file.size < SKIP_BELOW_BYTES) return file

    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    )
    // Si no mejora (o falla), nos quedamos con el original
    if (!blob || blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    // Decodificación no soportada (HEIC u otro): original; el servidor validará
    return file
  }
}
