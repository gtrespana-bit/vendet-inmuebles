import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const email = searchParams.get('email')

  if (!token || type !== 'email' || !email) {
    return NextResponse.redirect(new URL('/confirmacion', request.url))
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verificar el token de confirmación
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      return NextResponse.redirect(new URL('/confirmacion', request.url))
    }

    // Si tiene éxito, redirigir a la página de confirmación
    return NextResponse.redirect(new URL('/confirmacion', request.url))
  } catch (err) {
    return NextResponse.redirect(new URL('/confirmacion', request.url))
  }
}
