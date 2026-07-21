import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAILS } from '@/lib/admin-config'
import { requireUUIDs } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, action, adminEmail } = body
    
    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }
    
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updateData = action === 'aprobar'
      ? { estado_moderacion: 'aprobado', motivo_moderacion: null }
      : { estado_moderacion: 'rechazado', motivo_moderacion: 'Bloqueado por admin', activo: false }

    const { error } = await sb
      .from('productos')
      .update(updateData)
      .eq('id', productId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
