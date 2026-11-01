import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const token = searchParams.get('token')
  const type = searchParams.get('type') || 'signup'
  const email = searchParams.get('email')

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'signup' | 'email' | 'email_change' | 'invite' | 'magiclink',
      })
      if (error) {
        return NextResponse.redirect(new URL('/confirm?error_code=otp_expired', request.url))
      }
      return NextResponse.redirect(new URL('/confirm?confirmed=1', request.url))
    }

    if (token && email) {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })
      if (error) {
        return NextResponse.redirect(new URL('/confirm?error_code=otp_expired', request.url))
      }
      return NextResponse.redirect(new URL('/confirm?confirmed=1', request.url))
    }

    return NextResponse.redirect(new URL('/confirm', request.url))
  } catch {
    return NextResponse.redirect(new URL('/confirm?error_code=otp_expired', request.url))
  }
}
