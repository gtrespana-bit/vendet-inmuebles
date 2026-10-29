import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/api/'],
    },
    sitemap: 'https://venezuela-inmuebles.online/sitemap.xml',
    host: 'https://venezuela-inmuebles.online',
  }
}