import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const requestedUserId = formData.get('userId') as string | null

    if (!file || !requestedUserId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }
    if (requestedUserId !== auth.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const extension = IMAGE_EXTENSIONS[file.type]
    if (!extension) {
      return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen debe ser menor a 2MB' }, { status: 400 })
    }

    const filePath = `${auth.user.id}/avatar.${extension}`
    const { error: uploadErr } = await auth.supabaseAdmin.storage
      .from('foto_perfil')
      .upload(filePath, file, { upsert: true, cacheControl: '3600', contentType: file.type })
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { data: urlData } = auth.supabaseAdmin.storage.from('foto_perfil').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    const { error: updateErr } = await auth.supabaseAdmin
      .from('perfiles')
      .update({ foto_perfil_url: publicUrl })
      .eq('id', auth.user.id)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
