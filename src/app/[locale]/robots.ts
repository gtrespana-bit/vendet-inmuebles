import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/catalogo',
          '/inmueble/',
          '/buscar',
          '/como-funciona',
          '/faq',
          '/contacto',
          '/creditos',
          '/publicar',
          '/sobre-nosotros',
          '/terminos-y-condiciones',
          '/politica-de-privacidad',
        ],
        disallow: [
          '/dashboard',
          '/admin',
          '/chat',
          '/mi-perfil',
          '/api/',
          '/confirm',
          '/(auth)/',
        ],
      },
    ],
    sitemap: 'https://vendet.online/sitemap.xml',
  }
}
