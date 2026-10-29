import { NextRequest, NextResponse } from 'next/server'
import { getUploadPresignedUrl, getR2PublicUrl, isR2Configured } from '@/lib/r2-client'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response
    if (!isR2Configured()) {
      return NextResponse.json({ error: 'Almacenamiento de imágenes no configurado' }, { status: 503 })
    }

    const body = await req.json()
    const key = typeof body.key === 'string' ? body.key : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/jpeg'
    if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\') || !key.startsWith(`${auth.user.id}/`)) {
      return NextResponse.json({ error: 'Ruta de archivo inválida' }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Tipo de imagen no permitido' }, { status: 400 })
    }

    const rateLimit = await checkRateLimit('r2-upload', auth.user.id, {
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    })
    if (!rateLimit.ok) return NextResponse.json({ error: 'Límite de subida alcanzado' }, { status: 429 })

    const uploadUrl = await getUploadPresignedUrl(key, contentType, 300)
    return NextResponse.json({ url: uploadUrl, publicUrl: getR2PublicUrl(key) })
  } catch (error: any) {
    console.error('R2 presigned URL error:', error)
    return NextResponse.json({ error: 'Error generando URL de subida' }, { status: 500 })
  }
}
