import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { count, error } = await auth.supabaseAdmin
    .from('perfiles')
    .select('id', { count: 'exact', head: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, supabase_configured: true, profiles_total: count || 0 })
}
