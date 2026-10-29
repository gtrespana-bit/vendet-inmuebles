import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// La consulta depende de datos de la base; no debe ejecutarse ni cachearse al compilar.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 503 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  // Get the verified admin profile which has the payment data
  const { data: admin } = await supabase
    .from('perfiles')
    .select('pago_movil_telefono, pago_movil_cedula, pago_movil_banco')
    .eq('verificado', true)
    .maybeSingle()

  if (!admin || !admin.pago_movil_telefono) {
    // Fallback if admin profile doesn't have payment data
    return NextResponse.json({
      pagoMovil: {
        telefono: '04126443099',
        cedula: 'V20794917',
        banco: 'Banco Provincial BBVA'
      }
    })
  }

  return NextResponse.json({
    pagoMovil: {
      telefono: admin.pago_movil_telefono,
      cedula: admin.pago_movil_cedula || 'V29394292',
      banco: admin.pago_movil_banco || 'Banesco'
    }
  })
}
