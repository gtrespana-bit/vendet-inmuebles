import { NextRequest, NextResponse } from 'next/server'
import { getUploadPresignedUrl, getR2PublicUrl, isR2Configured, uploadObjectServer } from '@/lib/r2-client'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

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
 * GET /api/r2-upload — diagnóstico de la configuración R2.
 * Sube un objeto de prueba real para verificar credenciales,
 * bucket y permisos de escritura. Requiere sesión.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
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

    // Prueba de escritura real: subir un objeto mínimo
    const probeKey = `${auth.user.id}/_diag/r2-probe-${Date.now()}.txt`
    try {
      const url = await uploadObjectServer(probeKey, Buffer.from('ok'), 'text/plain')
      report.writeTest = 'ok'
      report.probeUrl = url
    } catch (err: any) {
      report.writeTest = `fail: ${err?.name || 'unknown'}: ${String(err?.message || '').slice(0, 200)}`
      return NextResponse.json({ ...report, ok: false }, { status: 500 })
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
      const fileType = file.type || 'image/jpeg'
      if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
        return NextResponse.json({ error: 'Tipo de imagen no permitido' }, { status: 400 })
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'La imagen supera el máximo de 8MB' }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const publicUrl = await uploadObjectServer(key, buffer, fileType)
      return NextResponse.json({ publicUrl })
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

    const uploadUrl = await getUploadPresignedUrl(key, contentType, 300)
    return NextResponse.json({ url: uploadUrl, publicUrl: getR2PublicUrl(key) })
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
