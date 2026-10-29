import { NextRequest, NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser, isAdminUser } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    const { data: inmueble, error: inmuebleError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id, titulo, imagen_url')
      .eq('id', body.productId)
      .maybeSingle()
    if (inmuebleError) return NextResponse.json({ error: inmuebleError.message }, { status: 500 })
    if (!inmueble) return NextResponse.json({ error: 'Inmueble no encontrado' }, { status: 404 })

    if (inmueble.usuario_id !== auth.user.id && !isAdminUser(auth.user)) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar esta publicación' }, { status: 403 })
    }

    const { data: images } = await auth.supabaseAdmin
      .from('inmueble_imagenes')
      .select('url_imagen')
      .eq('inmueble_id', inmueble.id)

    const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
    const r2Bucket = process.env.R2_BUCKET || 'vendetinmuebles'
    const r2Config = {
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }

    if (r2PublicUrl && r2Config.endpoint && r2Config.accessKeyId && r2Config.secretAccessKey) {
      const r2 = new S3Client({
        region: 'auto',
        endpoint: r2Config.endpoint,
        credentials: { accessKeyId: r2Config.accessKeyId, secretAccessKey: r2Config.secretAccessKey },
      })
      const urls = [inmueble.imagen_url, ...(images || []).map((image: any) => image.url_imagen)]
      const keys = new Set<string>()
      for (const url of urls) {
        if (typeof url !== 'string' || !url.startsWith(`${r2PublicUrl}/`)) continue
        const key = decodeURIComponent(url.slice(r2PublicUrl.length + 1))
        if (key && !key.includes('..')) keys.add(key)
      }
      await Promise.allSettled(Array.from(keys, key => r2.send(new DeleteObjectCommand({ Bucket: r2Bucket, Key: key }))))
      r2.destroy()
    }

    const { error: deleteError } = await auth.supabaseAdmin
      .from('inmuebles')
      .delete()
      .eq('id', inmueble.id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
