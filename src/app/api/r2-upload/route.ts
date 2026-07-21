/**
 * API Route: Genera presigned URL para subir fotos a Cloudflare R2
 * 
 * POST /api/r2-upload
 * Body: { key: string, contentType: string }
 * Returns: { url: string, publicUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUploadPresignedUrl, getR2PublicUrl } from '@/lib/r2-client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { key, contentType } = body

    if (!key) {
      return NextResponse.json({ error: 'Missing key' }, { status: 400 })
    }

    const uploadUrl = await getUploadPresignedUrl(key, contentType || 'image/jpeg')
    const publicUrl = getR2PublicUrl(key)

    return NextResponse.json({ url: uploadUrl, publicUrl })
  } catch (error) {
    console.error('R2 presigned URL error:', error)
    return NextResponse.json(
      { error: 'Error generando URL de subida' },
      { status: 500 }
    )
  }
}
