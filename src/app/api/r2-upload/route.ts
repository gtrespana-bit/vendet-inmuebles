import { NextRequest, NextResponse } from 'next/server'
import { getUploadPresignedUrl, getR2PublicUrl, isR2Configured, uploadObjectServer } from '@/lib/r2-client'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

// Dos modos de uso:
// 1) multipart/form-data con campo "file" → el servidor sube el archivo a R2
//    (recomendado: sin CORS, el navegador nunca toca el bucket).
// 2) JSON { key, contentType } → presigned URL para subir directamente desde
//    el navegador (legado; requiere CORS configurado en el bucket R2).
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

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
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
    console.error('R2 upload error:', error)
    return NextResponse.json({ error: 'Error subiendo la imagen' }, { status: 500 })
  }
}
