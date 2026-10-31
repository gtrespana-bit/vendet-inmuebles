import { registrarEvento, rutaDesdeReferer } from '@/lib/analytics-server'

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireAuthenticatedUser } from '@/lib/api-auth'
import { sanitizeString } from '@/lib/validation'
import { checkPlanLimits } from '@/lib/plans'
import { emailProductoPublicado, emailPropiedadEnRevision } from '@/lib/server-email'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    if (body.userId !== auth.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const titulo = sanitizeString(body.titulo, 160)
    const descripcion = sanitizeString(body.descripcion, 10000)
    const condicion = typeof body.estado === 'string' ? body.estado.trim() : 'Bueno'
    const estado = typeof body.ubicacion_estado === 'string' ? body.ubicacion_estado.trim() : ''
    const ciudad = typeof body.ubicacion_ciudad === 'string' ? body.ubicacion_ciudad.trim() : ''
    const precio = Number(body.precio_usd)
    const categoriaId = Number(body.categoria_id)
    const allowedConditions = ['Nuevo', 'Como nuevo', 'Bueno', 'Usado', 'Para repuestos']

    if (!titulo || titulo.length < 3 || !descripcion || descripcion.length > 10000) {
      return NextResponse.json({ error: 'Título o descripción inválidos' }, { status: 400 })
    }
    if (!estado || estado.length > 100 || !ciudad || ciudad.length > 100) {
      return NextResponse.json({ error: 'Ubicación inválida' }, { status: 400 })
    }
    if (!Number.isFinite(precio) || precio < 0 || precio > 999999999) {
      return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
    }
    if (!allowedConditions.includes(condicion)) {
      return NextResponse.json({ error: 'Condición inválida' }, { status: 400 })
    }
    if (!Number.isInteger(categoriaId) || categoriaId < 1) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await checkRateLimit('producto:create', auth.user.id, { ip })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: `Demasiadas publicaciones. Espera ${Math.ceil(rateLimit.resetIn / 60000)} min`, resetIn: rateLimit.resetIn },
        { status: 429 }
      )
    }

    const planData = await checkPlanLimits(auth.user.id)
    if (!planData.canPublish) {
      return NextResponse.json(
        { error: `Límite de publicaciones alcanzado para el plan ${planData.plan}` },
        { status: 403 }
      )
    }

    const { data: category, error: categoryError } = await auth.supabaseAdmin
      .from('categorias')
      .select('id')
      .eq('id', categoriaId)
      .maybeSingle()
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 })
    if (!category) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 })

    const { data: stateData } = await auth.supabaseAdmin
      .from('states')
      .select('id')
      .eq('name', estado)
      .maybeSingle()

    let cityId: string | null = null
    if (stateData?.id) {
      const { data: cityData } = await auth.supabaseAdmin
        .from('cities')
        .select('id')
        .eq('state_id', stateData.id)
        .ilike('name', ciudad)
        .maybeSingle()
      cityId = cityData?.id || null
    }

    const imageUrls = Array.isArray(body.imagenes)
      ? body.imagenes.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('https://')).slice(0, planData.limits.maxFotos)
      : []
    const firstImage = typeof body.imagen_url === 'string' && body.imagen_url.startsWith('https://')
      ? body.imagen_url
      : imageUrls[0] || null
    const moderationState = body.estado_moderacion === 'pendiente' ? 'pendiente' : 'aprobado'

    const insertData = {
      usuario_id: auth.user.id,
      titulo,
      descripcion,
      categoria_id: categoriaId,
      subcategoria: sanitizeString(body.subcategoria || '', 100) || null,
      marca: sanitizeString(body.marca || '', 100) || null,
      estado,
      ciudad,
      ubicacion_estado_id: stateData?.id || null,
      ubicacion_ciudad_id: cityId,
      condicion,
      precio,
      moneda: 'USD',
      imagen_url: firstImage,
      metodos_contacto: body.metodos_contacto && typeof body.metodos_contacto === 'object' ? body.metodos_contacto : null,
      activo: true,
      estado_moderacion: moderationState,
      motivo_moderacion: moderationState === 'pendiente' ? sanitizeString(body.motivo_moderacion || '', 500) || null : null,
      publicado_en: new Date().toISOString(),
    }

    const { data: property, error: insertError } = await auth.supabaseAdmin
      .from('inmuebles')
      .insert(insertData)
      .select('*')
      .single()
    if (insertError || !property) {
      return NextResponse.json({ error: insertError?.message || 'Error al publicar' }, { status: 500 })
    }

    if (imageUrls.length > 0) {
      const { error: imageError } = await auth.supabaseAdmin.from('inmueble_imagenes').insert(
        imageUrls.map((url: string, index: number) => ({
          inmueble_id: property.id,
          url_imagen: url,
          orden: index,
          es_portada: index === 0,
        }))
      )
      if (imageError) {
        await auth.supabaseAdmin.from('inmuebles').delete().eq('id', property.id)
        return NextResponse.json({ error: imageError.message }, { status: 500 })
      }
    }

    await registrarEvento('publicacion_creada', {
      ruta: `/inmueble/${property.slug || property.id}`,
      titulo: property.titulo,
      meta: { inmueble_id: property.id, moderacion: moderationState, estado, ciudad, precio },
      userId: auth.user.id,
      req,
    })

    revalidatePath('/')
    revalidatePath('/catalogo')

    // Confirmación por correo de la publicación (o de que entró en revisión).
    const nombrePublicador = auth.user.email?.split('@')[0] || 'Usuario'
    try {
      if (auth.user.email) {
        if (moderationState === 'aprobado') {
          await emailProductoPublicado(
            auth.user.email,
            nombrePublicador,
            titulo,
            precio.toFixed(0),
            property.slug || property.id,
          )
        } else {
          await emailPropiedadEnRevision(auth.user.email, nombrePublicador, titulo)
        }
      }
    } catch (emailError) {
      console.error('Error enviando confirmación de publicación:', emailError)
    }

    const alert = body.moderacionAlerta
    if (moderationState === 'pendiente' && alert?.nivel) {
      const bot = process.env.TELEGRAM_BOT_TOKEN
      const chat = process.env.TELEGRAM_CHAT_ID
      if (bot && chat) {
        await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat,
            text: `⚠️ <b>ALERTA MODERACIÓN — ${sanitizeString(String(alert.nivel).toUpperCase(), 20)}</b>\n\n📝 "${titulo}"\n👤 ${auth.user.email || auth.user.id}\n🚫 Palabras: ${Array.isArray(alert.palabras) ? alert.palabras.map((word: unknown) => sanitizeString(String(word), 50)).slice(0, 20).join(', ') : 'N/A'}`,
            parse_mode: 'HTML',
          }),
        }).catch(() => undefined)
      }
    }

    return NextResponse.json({ ok: true, data: property }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
