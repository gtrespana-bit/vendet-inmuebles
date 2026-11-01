import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import type { Metadata, Sharp } from 'sharp'
import {
  getUploadPresignedUrl, getR2PublicUrl, isR2Configured, uploadObjectServer, getDeletePresignedUrl,
} from '@/lib/r2-client'
import { requireAdmin, requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  MAX_UPLOAD_BYTES, MAX_STORED_DIMENSION, claveNormalizada, motivoRechazo,
} from '@/lib/image-upload'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// Runtime Node explícito: `req.formData()` entrega File de undici, y el
// chequeo con duck-typing evita fallos de `instanceof File` entre realms.
export const runtime = 'nodejs'
export const maxDuration = 30

/** Detecta un archivo subido sin depender de `instanceof File` (cross-realm safe). */
function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).size === 'number'
  )
}

// Dos modos de uso:
// 1) multipart/form-data con campo "file" → el servidor sube el archivo a R2
//    (recomendado: sin CORS, el navegador nunca toca el bucket).
// 2) JSON { key, contentType } → presigned URL para subir directamente desde
//    el navegador (legado; requiere CORS configurado en el bucket R2).

/**
 * GET /api/r2-upload — diagnóstico de la configuración R2 (solo administración).
 * Escribe un objeto mínimo para comprobar permisos y lo borra a continuación:
 * cada llamada no debe dejar residuos en el bucket.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const report: Record<string, unknown> = {
      configured: isR2Configured(),
      endpoint: Boolean(process.env.R2_ENDPOINT),
      accessKey: Boolean(process.env.R2_ACCESS_KEY_ID),
      secretKey: Boolean(process.env.R2_SECRET_ACCESS_KEY),
      bucket: process.env.R2_BUCKET || null,
      publicUrl: process.env.R2_PUBLIC_URL || null,
      writeTest: 'skipped',
    }
    if (!isR2Configured()) {
      return NextResponse.json({ ...report, ok: false }, { status: 503 })
    }

    // Prueba de escritura real y borrado inmediato: sin residuos en el bucket.
    const probeKey = `_diag/r2-probe-${auth.user.id}-${Date.now()}.txt`
    try {
      await uploadObjectServer(probeKey, Buffer.from('ok'), 'text/plain')
      report.writeTest = 'ok'
    } catch (err: any) {
      report.writeTest = `fail: ${err?.name || 'unknown'}: ${String(err?.message || '').slice(0, 200)}`
      return NextResponse.json({ ...report, ok: false }, { status: 500 })
    } finally {
      try {
        const deleteUrl = await getDeletePresignedUrl(probeKey, 60)
        await fetch(deleteUrl, { method: 'DELETE' })
      } catch {
        report.cleanup = 'no se pudo borrar el objeto de prueba'
      }
    }

    return NextResponse.json({ ...report, ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error de diagnóstico' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response
    if (!isR2Configured()) {
      return NextResponse.json({ error: 'Almacenamiento de imágenes no configurado' }, { status: 503 })
    }

    const rateLimit = await checkRateLimit('r2-upload', auth.user.id, {
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    })
    if (!rateLimit.ok) return NextResponse.json({ error: 'Límite de subida alcanzado' }, { status: 429 })

    const contentTypeHeader = req.headers.get('content-type') || ''

    // ---- Modo 1: subida directa por el servidor (multipart) ----
    if (contentTypeHeader.startsWith('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      const key = typeof form.get('key') === 'string' ? String(form.get('key')) : ''

      if (!isUploadedFile(file)) {
        return NextResponse.json({ error: 'Falta el archivo', step: 'parse' }, { status: 400 })
      }
      if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\') || !key.startsWith(`${auth.user.id}/`)) {
        return NextResponse.json({ error: 'Ruta de archivo inválida' }, { status: 400 })
      }
      if (!file.type || !ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json({ error: 'Tipo de imagen no permitido' }, { status: 400 })
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'La imagen supera el máximo de 4 MB' }, { status: 400 })
      }

      const original = Buffer.from(await file.arrayBuffer())
      // El tipo real se decide decodificando el archivo, no por el MIME declarado.
      let imagen: Sharp
      try {
        imagen = sharp(original, { failOn: 'error', limitInputPixels: 40_000_000 })
      } catch {
        return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
      }

      let metadatos: Metadata
      try {
        metadatos = await imagen.metadata()
      } catch {
        return NextResponse.json({ error: 'El archivo no es una imagen válida' }, { status: 400 })
      }
      const rechazo = motivoRechazo({
        bytes: original.byteLength,
        formato: metadatos.format,
        ancho: metadatos.width,
        alto: metadatos.height,
      })
      if (rechazo) return NextResponse.json({ error: rechazo }, { status: 400 })

      // Se reescribe como WebP sin metadatos: el objeto guardado no puede
      // contener contenido distinto del que se ha validado.
      let normalizada: Buffer
      try {
        normalizada = await sharp(original, { failOn: 'error', limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: MAX_STORED_DIMENSION, height: MAX_STORED_DIMENSION, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer()
      } catch {
        return NextResponse.json({ error: 'No se pudo procesar la imagen' }, { status: 400 })
      }

      const finalKey = claveNormalizada(key, 'webp')
      const publicUrl = await uploadObjectServer(finalKey, normalizada, 'image/webp')
      return NextResponse.json({ publicUrl, key: finalKey })
    }

    // ---- Modo 2: presigned URL (legado) ----
    const body = await req.json()
    const key = typeof body.key === 'string' ? body.key : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/jpeg'
    if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\') || !key.startsWith(`${auth.user.id}/`)) {
      return NextResponse.json({ error: 'Ruta de archivo inválida' }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Tipo de imagen no permitido' }, { status: 400 })
    }

    // La firma fija tipo y tamaño: la URL no permite subir más de 4 MB ni otro tipo.
    const uploadUrl = await getUploadPresignedUrl(key, contentType, MAX_UPLOAD_BYTES, 300)
    return NextResponse.json({ url: uploadUrl, publicUrl: getR2PublicUrl(key), maxBytes: MAX_UPLOAD_BYTES })
  } catch (error: any) {
    // Detalle real para diagnóstico (no se filtran credenciales: solo nombre/mensaje del SDK)
    const r2Code = error?.name || error?.Code || 'unknown'
    const r2Msg = typeof error?.message === 'string' ? error.message.slice(0, 200) : ''
    console.error('R2 upload error:', { code: r2Code, message: r2Msg, stack: error?.stack?.slice(0, 400) })
    // 413 del body parser / payload: el archivo no llegó completo
    if (error?.message?.includes('PayloadTooLarge') || error?.status === 413) {
      return NextResponse.json({ error: 'La imagen es demasiado grande para el servidor' }, { status: 413 })
    }
    return NextResponse.json(
      { error: `Error subiendo la imagen (${r2Code})`, step: 'r2-put' },
      { status: 500 }
    )
  }
}
