import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { CIUDADES_SEO } from './lib/ubicaciones-seo'
import { NextResponse, type NextRequest } from 'next/server'

// REMOVED: Supabase auth middleware was causing Edge Runtime errors
// because @supabase/ssr uses Node.js APIs not available in Edge Runtime.
// Auth se verifica en el servidor (layouts de /admin y /dashboard + API routes).

const nextIntlMiddleware = createMiddleware(routing)

// Slugs de ciudad válidos (landings SEO /{ciudad}) — datos puros, seguros para Edge.
const CITY_SLUGS = new Set(CIUDADES_SEO.map((c) => c.slug))

// Segmentos únicos válidos que NO son ciudades (páginas estáticas y privadas).
const STATIC_SEGMENTS = new Set([
  'catalogo', 'mapa', 'buscar', 'blog', 'como-funciona', 'como-instalar-app',
  'contacto', 'creditos', 'pagos', 'planes', 'sobre-nosotros', 'faq',
  'terminos-y-condiciones', 'politica-de-privacidad', 'publicar', 'publicar-inmueble',
  'offline',
  // Privadas (el acceso real lo controlan los layouts de servidor y las API)
  'admin', 'dashboard', 'chat', 'mi-perfil', 'eliminar-cuenta',
  'login', 'register', 'iniciar-sesion', 'registrarse', 'reset-password',
  'confirm', 'confirmacion',
  // Rutas con segundo segmento dinámico
  'inmueble', 'vendedor', 'propiedades', 'invitacion',
])

/**
 * En producción, cualquier ruta de un solo segmento que no sea página válida
 * ni ciudad conocida devuelve 404 REAL desde el middleware.
 * (notFound() tras un rewrite de middleware devuelve 200 = soft-404, que daña el SEO.)
 * En desarrollo se permite todo (páginas test-*, diagnostico, etc.).
 */
function notFoundResponse(): NextResponse {
  return new NextResponse('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export default async function middleware(request: NextRequest) {
  // 1. Detect locale from URL pathname FIRST
  const pathnameLocale = request.nextUrl.pathname.split('/')[1]

  // Type guard para validar el locale - SOLO 'es' y 'en' son válidos
  const isValidLocale = (locale: string): locale is 'es' | 'en' => {
    return locale === 'es' || locale === 'en'
  }

  const locale: 'es' | 'en' = isValidLocale(pathnameLocale) ? pathnameLocale : routing.defaultLocale

  // 2. 404 duro en producción para slugs de un solo segmento desconocidos
  if (process.env.NODE_ENV === 'production') {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean)
    const rest = segments[0] === 'es' || segments[0] === 'en' ? segments.slice(1) : segments
    if (rest.length === 1) {
      const seg = decodeURIComponent(rest[0]).toLowerCase()
      if (!STATIC_SEGMENTS.has(seg) && !CITY_SLUGS.has(seg)) {
        return notFoundResponse()
      }
    }
  }

  // 3. Inject locale header directly on NextRequest
  request.headers.set('x-detected-locale', locale)

  // 4. Apply next-intl routing only (no Supabase blocking)
  const intlResponse = nextIntlMiddleware(request)

  return intlResponse
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*|.*route\\.ts$).*)',
  ],
}
