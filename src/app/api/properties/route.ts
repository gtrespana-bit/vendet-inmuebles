import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'
import { checkPlanLimits } from '@/lib/plans'
import { savePropertyFeatures } from '@/lib/property-features'
import { sanitizarMetodosContacto } from '@/lib/contact-methods'
import { isPlanQuotaError, planQuotaResponse } from '@/lib/quota-errors'
import { checkRateLimit } from '@/lib/rate-limit'
import { evaluarModeracionServidor } from '@/lib/moderacion'
import { canUserManageProperty, getUserAgencyContext } from '@/lib/agency-server'
import { resolveEffectiveAgencyPublisher } from '@/lib/agency'
import { isValidUUID } from '@/lib/validation'
import { canPlanIncludeRichMedia, sanitizeExternalMediaUrl } from '@/lib/property-media'
import { dispararAlertasInmediatasPorInmueble } from '@/lib/search-alerts-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tipo_operacion,
      tipo_propiedad,
      titulo,
      descripcion,
      precio,
      estado,
      ciudad,
      habitaciones,
      banos,
      area,
      area_construida,
      puestos_estacionamiento,
      condicion,
      caracteristicas,
      imagenes,
      latitud,
      longitud,
      metodos_contacto,
      userId,
    } = body

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    const user = authData.user
    if (authError || !user || (userId && userId !== user.id)) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateLimit = await checkRateLimit('producto:create', user.id, { ip })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: `Demasiadas publicaciones. Espera ${Math.ceil(rateLimit.resetIn / 60000)} min`, resetIn: rateLimit.resetIn },
        { status: 429 }
      )
    }

    const planData = await checkPlanLimits(user.id)
    if (!planData.canPublish) {
      return NextResponse.json(
        { error: `Límite de publicaciones alcanzado para el plan ${planData.plan}` },
        { status: 403 }
      )
    }

    const tituloLimpio = typeof titulo === 'string' ? titulo.trim() : ''
    const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : ''
    const estadoLimpio = typeof estado === 'string' ? estado.trim() : ''
    const ciudadLimpia = typeof ciudad === 'string' ? ciudad.trim() : ''
    const precioNumerico = Number(precio)

    if (!tituloLimpio || !descripcionLimpia || !estadoLimpio || !ciudadLimpia || !Number.isFinite(precioNumerico) || precioNumerico <= 0) {
      return NextResponse.json({ error: 'Completa título, descripción, precio y ubicación válida' }, { status: 400 })
    }

    const moderacion = evaluarModeracionServidor(tituloLimpio, descripcionLimpia)
    if (!moderacion.permitido) {
      return NextResponse.json(
        { error: 'La publicación contiene términos no permitidos por nuestras normas.' },
        { status: 400 }
      )
    }

    const operacionSlug = tipo_operacion === 'alquiler' ? 'alquiler' : 'venta'
    const tipoSlug = typeof tipo_propiedad === 'string' && /^[a-z-]{2,40}$/.test(tipo_propiedad) ? tipo_propiedad : 'casa'
    const [{ data: operacion }, { data: tipo }] = await Promise.all([
      supabase.from('operaciones').select('id').eq('slug', operacionSlug).single(),
      supabase.from('tipos_inmueble').select('id').eq('slug', tipoSlug).maybeSingle(),
    ])

    const tipoFinal = tipo || (await supabase.from('tipos_inmueble').select('id').eq('slug', 'casa').single()).data

    if (!operacion || !tipoFinal) {
      return NextResponse.json({ error: 'No están configurados los catálogos de inmuebles' }, { status: 500 })
    }

    const { data: estadoData } = await supabase
      .from('states')
      .select('id')
      .eq('name', estadoLimpio)
      .maybeSingle()

    let ciudadId: string | null = null
    if (estadoData?.id) {
      const { data: ciudadData } = await supabase
        .from('cities')
        .select('id')
        .eq('state_id', estadoData.id)
        .ilike('name', ciudadLimpia)
        .maybeSingle()
      ciudadId = ciudadData?.id || null
    }

    const imageUrls = Array.isArray(imagenes)
      ? imagenes.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('https://'))
      : []

    if (imageUrls.length > planData.limits.maxFotos) {
      const quota = planQuotaResponse(`Máximo ${planData.limits.maxFotos} fotos para este plan`)
      return NextResponse.json(quota.body, { status: quota.status })
    }
    const lat = Number(latitud)
    const lng = Number(longitud)
    const hasCoords =
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
      Math.abs(lat) > 0.5 && Math.abs(lng) > 0.5

    const areaConstruidaNum = Number(area_construida)
    const condicionLimpia = typeof condicion === 'string' && condicion.trim() ? condicion.trim().slice(0, 60) : null
    const zonaLimpia = typeof body.zona === 'string' && body.zona.trim() ? body.zona.trim().slice(0, 120) : null

    const rawVideo = typeof body.video_url === 'string' ? body.video_url.trim() : ''
    const rawTour = typeof body.virtual_tour_url === 'string' ? body.virtual_tour_url.trim() : ''
    const rawPlano = typeof body.plano_url === 'string' ? body.plano_url.trim() : ''

    const videoUrlLimpia = rawVideo ? sanitizeExternalMediaUrl(rawVideo) : null
    const virtualTourUrlLimpia = rawTour ? sanitizeExternalMediaUrl(rawTour) : null
    const planoUrlLimpia = rawPlano ? sanitizeExternalMediaUrl(rawPlano) : null

    if ((rawVideo && !videoUrlLimpia) || (rawTour && !virtualTourUrlLimpia) || (rawPlano && !planoUrlLimpia)) {
      return NextResponse.json(
        { error: 'Los enlaces de vídeo, recorrido 360° y planos deben ser URLs públicas válidas con https://' },
        { status: 400 }
      )
    }

    if ((videoUrlLimpia || virtualTourUrlLimpia || planoUrlLimpia) && !canPlanIncludeRichMedia(planData.effectivePublishingPlan)) {
      const quota = planQuotaResponse('Los enlaces de vídeo, recorrido 360° y planos están incluidos en los planes Profesional y Agencia')
      return NextResponse.json(quota.body, { status: quota.status })
    }

    const { agency, activeMemberIds } = await getUserAgencyContext(supabase, user.id)
    const requestedAgentId = typeof body.agente_asignado_id === 'string' && isValidUUID(body.agente_asignado_id)
      ? body.agente_asignado_id
      : null
    const ownership = resolveEffectiveAgencyPublisher({
      userId: user.id,
      agency,
      requestedAgentId,
      activeMemberIds,
    })

    const propertyData = {
      usuario_id: ownership.usuario_id,
      agencia_id: ownership.agencia_id,
      agente_asignado_id: ownership.agente_asignado_id,
      titulo: tituloLimpio.slice(0, 160),
      descripcion: descripcionLimpia.slice(0, 10000),
      precio: precioNumerico,
      moneda: 'USD',
      estado: estadoLimpio,
      ciudad: ciudadLimpia,
      zona: zonaLimpia,
      ubicacion_estado_id: estadoData?.id || null,
      ubicacion_ciudad_id: ciudadId,
      operacion_id: operacion.id,
      tipo_id: tipoFinal.id,
      habitaciones: Math.max(0, Number.parseInt(habitaciones, 10) || 0),
      banos: Math.max(0, Number.parseInt(banos, 10) || 0),
      area_total: Number.isFinite(Number(area)) && Number(area) > 0 ? Number(area) : null,
      area_construida: Number.isFinite(areaConstruidaNum) && areaConstruidaNum > 0 ? areaConstruidaNum : null,
      puestos_estacionamiento: Math.max(0, Number.parseInt(puestos_estacionamiento, 10) || 0),
      condicion: condicionLimpia,
      video_url: videoUrlLimpia,
      virtual_tour_url: virtualTourUrlLimpia,
      plano_url: planoUrlLimpia,
      latitud: hasCoords ? Number(lat.toFixed(7)) : null,
      longitud: hasCoords ? Number(lng.toFixed(7)) : null,
      imagen_url: imageUrls[0] || null,
      // Métodos de contacto por publicación (Llamar/WhatsApp/email/Messenger).
      // `{}` = solo chat interno; `null` = sin configurar.
      metodos_contacto: sanitizarMetodosContacto(metodos_contacto),
      activo: true,
      estado_moderacion: moderacion.estadoModeracion,
      motivo_moderacion: moderacion.motivoModeracion,
      publicado_en: new Date().toISOString(),
    }

    const { data: property, error: insertError } = await supabase
      .from('inmuebles')
      .insert(propertyData)
      .select('id, titulo, slug, precio, estado, ciudad, creado_en')
      .single()

    if (insertError || !property) {
      console.error('Error al crear inmueble:', insertError)
      if (isPlanQuotaError(insertError)) {
        const quota = planQuotaResponse(insertError?.message)
        return NextResponse.json(quota.body, { status: quota.status })
      }
      return NextResponse.json({ error: insertError?.message || 'Error al crear el inmueble' }, { status: 500 })
    }

    if (imageUrls.length > 0) {
      const { error: imagesError } = await supabase.from('inmueble_imagenes').insert(
        imageUrls.map((url: string, index: number) => ({
          inmueble_id: property.id,
          url_imagen: url,
          orden: index,
          es_portada: index === 0,
        }))
      )

      if (imagesError) {
        await supabase.from('inmuebles').delete().eq('id', property.id)
        console.error('Error al guardar imágenes:', imagesError)
        return NextResponse.json({ error: 'No se pudieron guardar las imágenes del inmueble' }, { status: 500 })
      }
    }

    if (Array.isArray(caracteristicas)) {
      try {
        await savePropertyFeatures(supabase, property.id, caracteristicas)
      } catch (featureError) {
        console.error('Error al guardar características:', featureError)
        const { error: rollbackError } = await supabase.from('inmuebles').delete().eq('id', property.id)
        if (rollbackError) console.error('No se pudo revertir el inmueble:', rollbackError)
        return NextResponse.json({ error: 'No se pudieron guardar las características del inmueble' }, { status: 500 })
      }
    }

    if (moderacion.estadoModeracion === 'aprobado') {
      void dispararAlertasInmediatasPorInmueble(supabase, property.id).catch((err) => {
        console.error('Alertas inmediatas al publicar inmueble:', err)
      })
    }

    // La ficha y el catálogo deben reflejar el anuncio recién creado.
    revalidatePath(`/inmueble/${property.id}`)
    revalidatePath('/catalogo')

    return NextResponse.json(property, { status: 201 })
  } catch (error: any) {
    console.error('Error creating property:', error)
    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/properties — Editar un anuncio propio
 * Body: { id, titulo?, descripcion?, precio?, tipo? (slug), ciudad?, estado?,
 *         area_construida?, area_total?, puestos_estacionamiento?, condicion?,
 *         latitud?, longitud?, caracteristicas?: string[],
 *         imagenes?: Array<{ id?: string, url: string }>,
 *         metodos_contacto?: { telefono?, whatsapp?, email?, messenger? } | null }
 * Las imágenes se envían como lista completa (la primera = portada).
 */
export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const supabase = createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id : null
    if (!id) {
      return NextResponse.json({ error: 'Falta el id del inmueble' }, { status: 400 })
    }

    // El inmueble debe existir y pertenecer al usuario o estar bajo su gestión autorizada de agencia
    const { data: existing, error: existingError } = await supabase
      .from('inmuebles')
      .select('id, usuario_id, agencia_id, agente_asignado_id, video_url, virtual_tour_url, plano_url')
      .eq('id', id)
      .maybeSingle()
    if (existingError) throw existingError
    if (!existing || !(await canUserManageProperty(supabase, user.id, existing))) {
      return NextResponse.json({ error: 'Inmueble no encontrado' }, { status: 404 })
    }

    // Reject over-quota/invalid images BEFORE any mutation. Never truncate a saved gallery.
    const editPlan = await checkPlanLimits(user.id)
    if (Array.isArray(body.imagenes)) {
      if (body.imagenes.some((img: any) => !img || typeof img.url !== 'string' || !img.url.startsWith('https://'))) {
        return NextResponse.json({ error: 'Imagen no válida' }, { status: 400 })
      }
      // Grandfather existing photos after a downgrade, but do not allow new ones above quota.
      if (body.imagenes.length > editPlan.limits.maxFotos && body.imagenes.some((img: any) => !img.id)) {
        const quota = planQuotaResponse(`El plan ${editPlan.plan} permite ${editPlan.limits.maxFotos} fotos`)
        return NextResponse.json(quota.body, { status: quota.status })
      }
      const { data: currentImages, error: imageReadError } = await supabase.from('inmueble_imagenes')
        .select('id').eq('inmueble_id', id)
      if (imageReadError) throw imageReadError
      const ownIds = new Set((currentImages || []).map(img => img.id))
      const ids = body.imagenes.filter((img: any) => img.id).map((img: any) => img.id)
      if (ids.some((imageId: string) => !ownIds.has(imageId)) || new Set(ids).size !== ids.length) {
        return NextResponse.json({ error: 'Imagen no válida' }, { status: 400 })
      }
    }

    // Campos editables
    const cambios: Record<string, unknown> = {}
    const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
    const num = (v: unknown) => {
      if (v === null) return null
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
      return undefined
    }

    const titulo = str(body.titulo, 150)
    if (titulo !== undefined) cambios.titulo = titulo
    const descripcion = str(body.descripcion, 6000)
    if (descripcion !== undefined) cambios.descripcion = descripcion
    if (titulo !== undefined || descripcion !== undefined) {
      const modEdicion = evaluarModeracionServidor(titulo, descripcion)
      if (!modEdicion.permitido) {
        return NextResponse.json(
          { error: 'La edición contiene términos no permitidos por nuestras normas.' },
          { status: 400 }
        )
      }
      if (modEdicion.estadoModeracion === 'pendiente') {
        cambios.estado_moderacion = 'pendiente'
        cambios.motivo_moderacion = modEdicion.motivoModeracion
      }
    }
    const precio = num(body.precio)
    if (precio !== undefined) cambios.precio = precio
    const ciudad = str(body.ciudad, 100)
    if (ciudad !== undefined) cambios.ciudad = ciudad
    const estado = str(body.estado, 100)
    if (estado !== undefined) cambios.estado = estado
    const areaConstruida = num(body.area_construida)
    if (areaConstruida !== undefined) cambios.area_construida = areaConstruida
    const areaTerreno = num(body.area_total)
    if (areaTerreno !== undefined) cambios.area_total = areaTerreno
    const puestos = num(body.puestos_estacionamiento)
    if (puestos !== undefined) cambios.puestos_estacionamiento = puestos
    const condicion = str(body.condicion, 60)
    if (condicion !== undefined) cambios.condicion = condicion || null
    if ('zona' in body) {
      cambios.zona = typeof body.zona === 'string' && body.zona.trim() ? body.zona.trim().slice(0, 120) : null
    }

    for (const mediaKey of ['video_url', 'virtual_tour_url', 'plano_url'] as const) {
      if (!(mediaKey in body)) continue
      const rawVal = typeof body[mediaKey] === 'string' ? body[mediaKey].trim() : ''
      if (!rawVal) {
        cambios[mediaKey] = null
        continue
      }
      const cleanVal = sanitizeExternalMediaUrl(rawVal)
      if (!cleanVal) {
        return NextResponse.json(
          { error: 'Los enlaces de vídeo, recorrido 360° y planos deben ser URLs públicas válidas con https://' },
          { status: 400 }
        )
      }
      const prevVal = typeof existing[mediaKey] === 'string' ? existing[mediaKey].trim() : ''
      const isUnchanged = prevVal && (prevVal === rawVal || prevVal === cleanVal)
      if (!isUnchanged && !canPlanIncludeRichMedia(editPlan.effectivePublishingPlan)) {
        const quota = planQuotaResponse('Los enlaces de vídeo, recorrido 360° y planos están incluidos en los planes Profesional y Agencia')
        return NextResponse.json(quota.body, { status: quota.status })
      }
      cambios[mediaKey] = cleanVal
    }
    for (const [key, limit] of [['latitud', 90], ['longitud', 180]] as const) {
      const value = body[key]
      if (value === null || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit)) cambios[key] = value
    }
    // Métodos de contacto por publicación (Llamar/WhatsApp/email/Messenger).
    // `{}` = solo chat interno; `null` = sin configurar (se usa el teléfono del perfil).
    if ('metodos_contacto' in body) {
      cambios.metodos_contacto = sanitizarMetodosContacto(body.metodos_contacto)
    }

    if (typeof body.agente_asignado_id === 'string' && isValidUUID(body.agente_asignado_id) && existing.agencia_id) {
      const { agency, activeMemberIds } = await getUserAgencyContext(supabase, user.id)
      if (agency && agency.id === existing.agencia_id && agency.isAdmin && activeMemberIds.has(body.agente_asignado_id)) {
        cambios.agente_asignado_id = body.agente_asignado_id
      }
    }

    if (estado && ciudad) {
      const { data: state } = await supabase.from('states').select('id').eq('name', estado).maybeSingle()
      const { data: city } = state?.id
        ? await supabase.from('cities').select('id').eq('state_id', state.id).ilike('name', ciudad).maybeSingle()
        : { data: null }
      cambios.ubicacion_estado_id = state?.id || null
      cambios.ubicacion_ciudad_id = city?.id || null
    }

    if (typeof body.tipo === 'string' && body.tipo.trim()) {
      const slug = body.tipo.trim().toLowerCase()
      if (/^[a-z-]{2,40}$/.test(slug)) {
        const { data: tipoRow } = await supabase
          .from('tipos_inmueble')
          .select('id')
          .eq('slug', slug)
          .single()
        if (tipoRow?.id) cambios.tipo_id = tipoRow.id
      }
    }

    if (Object.keys(cambios).length > 0) {
      const { error } = await supabase.from('inmuebles').update(cambios).eq('id', id)
      if (error) throw error
    }

    if (Array.isArray(body.caracteristicas)) {
      await savePropertyFeatures(supabase, id, body.caracteristicas)
    }

    // Imágenes (lista completa: la primera es portada)
    if (Array.isArray(body.imagenes)) {
      const nuevas = body.imagenes
        .filter((img: unknown): img is { id?: string; url: string } =>
          !!img && typeof (img as { url?: unknown }).url === 'string' && !!(img as { url: string }).url.startsWith('https://'))

      const { data: filasActuales, error: imagesReadError } = await supabase
        .from('inmueble_imagenes').select('id, orden').eq('inmueble_id', id)
      if (imagesReadError) throw imagesReadError

      const actualesIds = new Set((filasActuales || []).map((f) => String(f.id)))
      const conservar = new Set(nuevas.map((img: { id?: string }) => img.id).filter(Boolean) as string[])
      const retenidas = (filasActuales || []).filter((f) => conservar.has(String(f.id)))
      if (conservar.size !== nuevas.filter((img: { id?: string }) => img.id).length ||
          Array.from(conservar).some((imageId) => !actualesIds.has(imageId))) {
        return NextResponse.json({ error: 'Imagen no válida' }, { status: 400 })
      }
      const borrar = Array.from(actualesIds).filter((fid) => !conservar.has(fid))
      if (borrar.length > 0) {
        const { error } = await supabase.from('inmueble_imagenes').delete().eq('inmueble_id', id).in('id', borrar)
        if (error) throw error
      }

      // Apartar los órdenes existentes antes de reordenar para evitar la restricción única.
      const offset = Math.max(0, ...(filasActuales || []).map((f) => f.orden)) + nuevas.length + 1
      for (let index = 0; index < retenidas.length; index++) {
        const fila = retenidas[index]
        const { error } = await supabase.from('inmueble_imagenes')
          .update({ orden: offset + index, es_portada: false }).eq('inmueble_id', id).eq('id', fila.id)
        if (error) throw error
      }
      for (let i = 0; i < nuevas.length; i++) {
        const img = nuevas[i]
        if (img.id && actualesIds.has(img.id)) {
          const { error } = await supabase.from('inmueble_imagenes')
            .update({ orden: i, es_portada: i === 0 }).eq('inmueble_id', id).eq('id', img.id)
          if (error) throw error
        } else if (!img.id) {
          const { error } = await supabase.from('inmueble_imagenes')
            .insert({ inmueble_id: id, url_imagen: img.url, orden: i, es_portada: i === 0 })
          if (error) throw error
        } else {
          throw new Error('Imagen no válida')
        }
      }
      const { error: coverError } = await supabase.from('inmuebles')
        .update({ imagen_url: nuevas[0]?.url || null }).eq('id', id)
      if (coverError) throw coverError
    }

    // Invalida la ficha (ambientes, fotos, contacto…) y los listados.
    revalidatePath(`/inmueble/${id}`)
    revalidatePath('/inmueble/[id]', 'page')
    revalidatePath('/catalogo')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating property:', error)
    if (isPlanQuotaError(error)) {
      const quota = planQuotaResponse(error?.message)
      return NextResponse.json(quota.body, { status: quota.status })
    }
    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
