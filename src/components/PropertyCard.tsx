import Image from 'next/image';
import Link from 'next/link';

interface Property {
  id: string;
  titulo: string;
  slug: string;
  precio: number;
  tipo_operacion: 'venta' | 'alquiler';
  ciudad: string;
  estado: string;
  imagen_destacada_url?: string | null;
  habitaciones?: number;
  banos?: number;
  area?: number;
}

interface PropertyCardProps {
  property: Property;
  locale: string;
}

export default function PropertyCard({ property, locale }: PropertyCardProps) {
  const formatoPrecio = new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(property.precio);

  return (
    <Link href={`/${locale}/inmueble/${property.slug}`} className="group block">
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
        {/* Imagen */}
        <div className="relative h-48 w-full bg-gray-100">
          {property.imagen_destacada_url ? (
            <Image
              src={property.imagen_destacada_url}
              alt={property.titulo}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Badge de operación */}
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              property.tipo_operacion === 'venta'
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 text-white'
            }`}>
              {property.tipo_operacion === 'venta' ? 'Venta' : 'Alquiler'}
            </span>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 truncate mb-1">{property.titulo}</h3>
          <p className="text-sm text-gray-500 mb-2">{property.ciudad}, {property.estado}</p>

          <p className="text-lg font-bold text-green-600 mb-3">{formatoPrecio}</p>

          {/* Características */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            {property.habitaciones !== undefined && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>{property.habitaciones}</span>
              </div>
            )}
            {property.banos !== undefined && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{property.banos}</span>
              </div>
            )}
            {property.area !== undefined && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>{property.area} m²</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
