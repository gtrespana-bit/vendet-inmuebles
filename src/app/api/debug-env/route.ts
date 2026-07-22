import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
  const checks = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabase_url_value: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
  }

  // Test query con service role
  let queryResult: any = { success: false, error: null, count: 0 }
  try {
    const supabase = createServerClient()
    const { data, error, count } = await supabase
      .from('productos')
      .select('id', { count: 'exact', head: true })

    queryResult = {
      success: !error,
      error: error?.message || null,
      count: count || 0,
    }
  } catch (e: any) {
    queryResult = { success: false, error: e.message, count: 0 }
  }

  return NextResponse.json({ env: checks, query: queryResult })
}
