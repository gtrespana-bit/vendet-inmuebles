import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getUserFromRequest } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const {
      tipoOperacion,
      titulo,
      descripcion,
      precio,
      estado,
      municipio,
      tipoInmueble,
      habitaciones,
      banos,
      area,
      imagenes,
    } = body

    if (!titulo || !descripcion || !precio || !estado || !municipio || !tipoInmueble) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('productos')
      .insert({
        user_id: user.id,
        titulo,
        descripcion,
        precio: parseFloat(precio),
        estado,
        municipio,
        tipo_inmueble: tipoInmueble,
        tipo_operacion: tipoOperacion || 'venta',
        habitaciones: habitaciones ? parseInt(habitaciones) : null,
        banos: banos ? parseInt(banos) : null,
        area: area ? parseInt(area) : null,
        imagenes: imagenes || [],
        categoria: 'inmuebles',
        activo: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: error.message || 'Error al crear la propiedad' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating property:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
