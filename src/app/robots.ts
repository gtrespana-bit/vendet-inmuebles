import type { MetadataRoute } from 'next'

const PRIVATE_PATHS = [
  '/admin',
  '/dashboard',
  '/pagos',
  '/chat',
  '/mi-perfil',
  '/eliminar-cuenta',
  '/diagnostico',
  '/login',
  '/register',
  '/iniciar-sesion',
  '/registrarse',
  '/reset-password',
  '/confirm',
  '/confirmacion',
  '/buscar',
  '/offline',
  '/publicar',
  '/inmueble/editar',
]

export default function robots(): MetadataRoute.Robots {
  const localizedDisallows = PRIVATE_PATHS.flatMap((p) => [p, `/en${p}`])

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        ...localizedDisallows,
        '/api/',
        '/test-',
        '/en/test-',
      ],
    },
    sitemap: 'https://venezuela-inmuebles.online/sitemap.xml',
    host: 'https://venezuela-inmuebles.online',
  }
}
