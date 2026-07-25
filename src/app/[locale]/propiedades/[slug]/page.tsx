import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPropertyBySlug } from '@/lib/properties'
import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const property = await getPropertyBySlug(slug)
  
  if (!property) {
    return {
      title: 'Propiedad no encontrada',
    }
  }

  return {
    title: `${property.title} - VendeT Inmuebles`,
    description: property.description || `Ver detalles de ${property.title}`,
    openGraph: {
      images: property.main_image_url ? [property.main_image_url] : [],
    },
  }
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: 'property' })
  
  const property = await getPropertyBySlug(slug)

  if (!property) {
    notFound()
  }

  // Procesar imágenes
  const images = property.images || []
  const mainImage = property.main_image_url || (images.length > 0 ? images[0] : null)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-500">
        <Link href={`/${locale}`} className="hover:underline">Inicio</Link>
        {' / '}
        <Link href={`/${locale}/propiedades/venta`} className="hover:underline">Venta</Link>
        {' / '}
        <span className="text-gray-900">{property.title}</span>
      </nav>

      {/* Imagen Principal */}
      {mainImage ? (
        <div className="relative w-full h-[400px] md:h-[500px] rounded-lg overflow-hidden mb-8">
          <Image
            src={mainImage}
            alt={property.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      ) : (
        <div className="w-full h-[400px] bg-gray-200 rounded-lg mb-8 flex items-center justify-center">
          <span className="text-gray-400">Sin imagen disponible</span>
        </div>
      )}

      {/* Galería de imágenes */}
      {images.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {images.slice(0, 8).map((img: string, idx: number) => (
            <div key={idx} className="relative h-32 rounded-lg overflow-hidden">
              <Image
                src={img}
                alt={`${property.title} - imagen ${idx + 1}`}
                fill
                className="object-cover hover:scale-105 transition-transform cursor-pointer"
              />
            </div>
          ))}
        </div>
      )}

      {/* Información Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Detalles */}
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold mb-4">{property.title}</h1>
          
          <div className="flex items-center gap-4 mb-6">
            <span className="text-2xl font-bold text-blue-600">
              ${property.price.toLocaleString()} {property.currency}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {property.operation_type === 'venta' ? 'Venta' : 'Alquiler'}
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
              {property.property_type}
            </span>
          </div>

          <div className="flex gap-6 mb-6 text-gray-600">
            {property.bedrooms && (
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
                <span>{property.bedrooms} hab</span>
              </div>
            )}
            {property.bathrooms && (
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
                <span>{property.bathrooms} baños</span>
              </div>
            )}
            {property.area_size && (
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>{property.area_size} m²</span>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Descripción</h2>
            <p className="text-gray-700 whitespace-pre-line">{property.description}</p>
          </div>

          {/* Ubicación */}
          {(property.city_name || property.state_name || property.address) && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3">Ubicación</h2>
              <div className="text-gray-700">
                {property.city_name && <p>{property.city_name}</p>}
                {property.state_name && <p>{property.state_name}</p>}
                {property.address && <p className="text-sm text-gray-500 mt-1">{property.address}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Contacto */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-4">
            <h3 className="text-lg font-semibold mb-4">Contactar</h3>
            
            {property.owner_name && (
              <div className="mb-4">
                <p className="text-sm text-gray-500">Publicado por</p>
                <p className="font-medium">{property.owner_name}</p>
              </div>
            )}

            <form className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Tu nombre"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Tu email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <input
                  type="tel"
                  placeholder="Tu teléfono"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <textarea
                  placeholder="Mensaje"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  defaultValue={`Hola, me interesa la propiedad: ${property.title}`}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Enviar mensaje
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-2">¿Prefieres llamar?</p>
              {property.owner_phone && (
                <a
                  href={`tel:${property.owner_phone}`}
                  className="block text-center bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  📞 {property.owner_phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
