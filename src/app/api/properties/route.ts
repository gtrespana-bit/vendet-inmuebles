import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json()
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

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!titulo || !descripcion || !precio || !estado || !ciudad) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('productos')
      .insert({
        user_id: userId,
        titulo,
        descripcion,
        precio: parseFloat(precio),
        estado,
        ciudad,
        habitaciones: habitaciones ? parseInt(habitaciones) : null,
        banos: banos ? parseInt(banos) : null,
        area: area ? parseInt(area) : null,
        imagenes: imagenes || [],
        categoria: 'inmuebles',
        tipo_operacion: tipo_operacion || 'venta',
        activo: true,
      })
      .select()
      .single()

    if (error) {
      console.error('=== ERROR CRUD SUPABASE ===')
      console.error('Mensaje:', error.message)
      console.error('Detalle:', error.details)
      console.error('Hint:', error.hint)
      console.error('Code:', error.code)
      console.error('Datos enviados:', JSON.stringify({
        user_id: userId,
        titulo,
        descripcion,
        precio: parseFloat(precio),
        estado,
        ciudad,
        habitaciones: habitaciones ? parseInt(habitaciones) : null,
        banos: banos ? parseInt(banos) : null,
        area: area ? parseInt(area) : null,
        imagenes: imagenes || [],
        categoria: 'inmuebles',
        tipo_operacion: tipo_operacion || 'venta',
        activo: true,
      }, null, 2))
      
      return NextResponse.json(
        { 
          error: 'Error al guardar en base de datos', 
          message: error.message,
          details: error.details,
          code: error.code
        },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error creating property:', error)
    console.error('Error stack:', error?.stack)
    console.error('Request body:', body)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor', details: error?.message },
      { status: 500 }
    )
  }
}