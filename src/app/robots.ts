import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Paneles privados y rutas de cuenta
        '/admin',
        '/dashboard',
        '/chat',
        '/mi-perfil',
        '/eliminar-cuenta',
        '/diagnostico',
        // Auth
        '/login',
        '/register',
        '/iniciar-sesion',
        '/registrarse',
        '/reset-password',
        '/confirm',
        '/confirmacion',
        // APIs y utilidades internas
        '/api/',
        // Páginas de desarrollo/prueba
        '/test-',
        // Búsqueda interna (resultados dinámicos, sin valor SEO propio)
        '/buscar',
        // PWA offline
        '/offline',
      ],
    },
    sitemap: 'https://venezuela-inmuebles.online/sitemap.xml',
    host: 'https://venezuela-inmuebles.online',
  }
}
