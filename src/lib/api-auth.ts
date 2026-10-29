import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/admin-config'

type AuthenticatedContext = {
  ok: true
  supabaseAdmin: SupabaseClient
  user: User
}

type AuthorizationFailure = {
  ok: false
  response: NextResponse
}

export type AuthorizationResult = AuthenticatedContext | AuthorizationFailure

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function requireAuthenticatedUser(request: NextRequest): Promise<AuthorizationResult> {
  const supabaseAdmin = createAdminClient()
  if (!supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Config missing' }, { status: 500 }),
    }
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sesión inválida' }, { status: 401 }),
    }
  }

  return { ok: true, supabaseAdmin, user: data.user }
}

export function isAdminUser(user: User): boolean {
  const email = user.email?.toLowerCase() || ''
  return ADMIN_EMAILS.includes(email) || user.app_metadata?.role === 'admin'
}

export async function requireAdmin(request: NextRequest): Promise<AuthorizationResult> {
  const auth = await requireAuthenticatedUser(request)
  if (!auth.ok) return auth

  if (!isAdminUser(auth.user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
    }
  }

  return auth
}
