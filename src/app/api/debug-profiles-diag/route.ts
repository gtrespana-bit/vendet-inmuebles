import { NextResponse } from 'next/server'

// Diagnóstico: devuelve el status del acceso a perfiles
export async function GET() {
  const { createClient } = await import('@supabase/supabase-js')
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  
  const info: any = {
    supabase_url: supabaseUrl?.substring(0, 30) + '...',
    service_key_exists: !!serviceKey,
    service_key_prefix: serviceKey ? serviceKey.substring(0, 20) + '...' : null,
    anon_key_exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Missing env vars', info })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Test: contar perfiles
  const { count: totalCount, error: countError } = await supabaseAdmin
    .from('perfiles')
    .select('*', { count: 'exact', head: true })

  info.profiles_total = countError ? `ERROR: ${countError.message}` : totalCount

  // Test: obtener 3 perfiles con datos
  if (!countError) {
    const { data, error } = await supabaseAdmin
      .from('perfiles')
      .select('id, nombre')
      .limit(3)

    if (error) {
      info.sample = `ERROR: ${error.message}`
    } else {
      info.sample = data?.map(p => ({ id: p.id?.substring(0, 10), nombre: p.nombre || '(vacío)' }))
    }
  }

  return NextResponse.json(info)
}
