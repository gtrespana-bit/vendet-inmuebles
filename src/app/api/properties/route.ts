import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      tipo_operacion,
      titulo,
      descripcion,
      precio,
      estado,
      ciudad,
      habitaciones,
      banos,
      area,
      imagenes,
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

    const tituloLimpio = typeof titulo === 'string' ? titulo.trim() : ''
    const descripcionLimpia = typeof descripcion === 'string' ? descripcion.trim() : ''
    const estadoLimpio = typeof estado === 'string' ? estado.trim() : ''
    const ciudadLimpia = typeof ciudad === 'string' ? ciudad.trim() : ''
    const precioNumerico = Number(precio)

    if (!tituloLimpio || !descripcionLimpia || !estadoLimpio || !ciudadLimpia || !Number.isFinite(precioNumerico) || precioNumerico <= 0) {
      return NextResponse.json({ error: 'Completa título, descripción, precio y ubicación válida' }, { status: 400 })
    }

    const operacionSlug = tipo_operacion === 'alquiler' ? 'alquiler' : 'venta'
    const [{ data: operacion }, { data: tipo }] = await Promise.all([
      supabase.from('operaciones').select('id').eq('slug', operacionSlug).single(),
      supabase.from('tipos_inmueble').select('id').eq('slug', 'casa').single(),
    ])

    if (!operacion || !tipo) {
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
      ? imagenes.filter((url: unknown): url is string => typeof url === 'string' && url.startsWith('https://')).slice(0, 20)
      : []

    const propertyData = {
      usuario_id: user.id,
      titulo: tituloLimpio.slice(0, 160),
      descripcion: descripcionLimpia.slice(0, 10000),
      precio: precioNumerico,
      moneda: 'USD',
      estado: estadoLimpio,
      ciudad: ciudadLimpia,
      ubicacion_estado_id: estadoData?.id || null,
      ubicacion_ciudad_id: ciudadId,
      operacion_id: operacion.id,
      tipo_id: tipo.id,
      habitaciones: Math.max(0, Number.parseInt(habitaciones, 10) || 0),
      banos: Math.max(0, Number.parseInt(banos, 10) || 0),
      area_total: Number.isFinite(Number(area)) && Number(area) > 0 ? Number(area) : null,
      imagen_url: imageUrls[0] || null,
      activo: true,
      estado_moderacion: 'aprobado',
      publicado_en: new Date().toISOString(),
    }

    const { data: property, error: insertError } = await supabase
      .from('inmuebles')
      .insert(propertyData)
      .select('id, titulo, slug, precio, estado, ciudad, creado_en')
      .single()

    if (insertError || !property) {
      console.error('Error al crear inmueble:', insertError)
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

    return NextResponse.json(property, { status: 201 })
  } catch (error: any) {
    console.error('Error creating property:', error)
    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
