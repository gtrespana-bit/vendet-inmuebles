import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { type NextRequest } from 'next/server'

// REMOVED: Supabase auth middleware was causing Edge Runtime errors
// because @supabase/ssr uses Node.js APIs not available in Edge Runtime.
// Auth is handled by getServerUser() in root layout instead.

const nextIntlMiddleware = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  // 1. Detect locale from URL pathname FIRST
  const pathnameLocale = request.nextUrl.pathname.split('/')[1]
  const locale = routing.locales.includes(pathnameLocale as any)
    ? pathnameLocale
    : routing.defaultLocale

  // 2. Inject locale header directly on NextRequest
  // This is the proper way to add headers in middleware
  request.headers.set('x-detected-locale', locale)

  // 3. Apply next-intl routing only (no Supabase blocking)
  const intlResponse = nextIntlMiddleware(request)

  return intlResponse
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*|.*route\\.ts$).*)',
  ],
}