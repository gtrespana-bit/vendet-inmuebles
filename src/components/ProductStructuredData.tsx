'use client'

interface ProductStructuredDataProps {
  product: {
    id: string
    titulo: string
    descripcion?: string
    precio_usd: number
    estado: string
    imagen_url?: string
    ubicacion_ciudad?: string
    ubicacion_estado?: string
    creado_en: string
    user_id: string
  }
  seller?: {
    id: string
    nombre?: string
    verificado?: boolean
  }
}

export default function ProductStructuredData({ product, seller }: ProductStructuredDataProps) {
  const conditionMap: Record<string, string> = {
    'Nuevo': 'https://schema.org/NewCondition',
    'Como nuevo': 'https://schema.org/UsedCondition',
    'Bueno': 'https://schema.org/UsedCondition',
    'Usado': 'https://schema.org/UsedCondition',
    'Para repuestos': 'https://schema.org/ForParts',
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.titulo,
    description: product.descripcion || `${product.titulo} en venta en Venezuela | Venezuela Inmuebles`,
    image: product.imagen_url || 'https://venezuela-inmuebles.online/og-image.webp',
    url: `https://venezuela-inmuebles.online/inmueble/${product.id}`,
    sku: product.id,
    brand: {
      '@type': 'Brand',
      name: 'Venezuela Inmuebles'
    },
    offers: {
      '@type': 'Offer',
      url: `https://venezuela-inmuebles.online/inmueble/${product.id}`,
      priceCurrency: 'USD',
      price: product.precio_usd,
      availability: 'https://schema.org/InStock',
      itemCondition: conditionMap[product.estado] || 'https://schema.org/UsedCondition',
      seller: seller ? {
        '@type': seller.verificado ? 'Verified' : 'Person',
        name: seller.nombre || 'Vendedor en Venezuela Inmuebles',
        url: `https://venezuela-inmuebles.online/vendedor/${seller.id}`
      } : {
        '@type': 'Organization',
        name: 'Venezuela Inmuebles'
      }
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      reviewCount: '0'
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
    />
  )
}