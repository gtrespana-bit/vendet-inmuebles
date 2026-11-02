import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/api-auth'
import { requireUUIDs } from '@/lib/validation'
import { notifyUser } from '@/lib/push-notify'
import { notificarPropiedadModerada } from '@/lib/email-eventos'
import { isPlanQuotaError, planQuotaResponse } from '@/lib/quota-errors'
import { dispararAlertasInmediatasPorInmueble } from '@/lib/search-alerts-server'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { productId, action } = body
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    if (!['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const { data: product, error: productError } = await auth.supabaseAdmin
      .from('inmuebles')
      .select('id, usuario_id, titulo, slug')
      .eq('id', productId)
      .maybeSingle()
    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
    if (!product) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })

    const aprobada = action === 'aprobar'
    const updateData = aprobada
      ? { estado_moderacion: 'aprobado', motivo_moderacion: null, activo: true }
      : { estado_moderacion: 'rechazado', motivo_moderacion: 'Bloqueado por administración', activo: false }

    const { error } = await auth.supabaseAdmin
      .from('inmuebles')
      .update(updateData)
      .eq('id', productId)
    if (error) {
      // Aprobar reactiva la publicación: la cuenta puede estar por encima del cupo
      // de su plan actual y el trigger 012 impide volver a publicarla.
      if (isPlanQuotaError(error)) {
        const quota = planQuotaResponse(error.message)
        return NextResponse.json(quota.body, { status: quota.status })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // La decisión de moderación se comunica por push y por correo.
    await notifyUser(auth.supabaseAdmin, product.usuario_id, {
      title: aprobada ? '✅ Tu inmueble fue aprobado' : 'Tu anuncio necesita cambios',
      body: aprobada
        ? `"${product.titulo}" ya está publicado y visible para todos.`
        : `"${product.titulo}" no se publicó. Revisa el correo con el detalle.`,
      tag: 'moderacion',
      icon: '/icon-192.png',
      click_url: `/inmueble/${product.slug || productId}`,
    })
    await notificarPropiedadModerada(auth.supabaseAdmin, {
      usuarioId: product.usuario_id,
      titulo: product.titulo,
      slug: product.slug,
      aprobada,
      motivo: aprobada ? null : 'El contenido no cumple nuestras normas de publicación.',
    })

    if (aprobada) {
      void dispararAlertasInmediatasPorInmueble(auth.supabaseAdmin, product.id).catch((err) => {
        console.error('Alertas inmediatas tras moderación:', err)
      })
    }

    revalidatePath('/')
    revalidatePath('/catalogo')
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
