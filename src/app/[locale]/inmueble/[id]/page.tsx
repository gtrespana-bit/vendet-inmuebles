import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import Image from 'next/image';
import { MapPin, Home, Bath, Bed, Square, Phone, MessageCircle, CheckCircle, Mail, Building, Calendar, Eye } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: propiedad, error } = await supabase
    .from('vw_propiedades_publicas')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !propiedad || !propiedad.activo) {
    return { title: 'Propiedad no encontrada' };
  }

  const operacion = propiedad.operacion_nombre?.toLowerCase() === 'alquiler' ? 'Alquiler' : 'Venta';
  return {
    title: `${operacion}: ${propiedad.titulo} en ${propiedad.ciudad}, ${propiedad.estado}`,
    description: propiedad.descripcion?.substring(0, 160),
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: propiedad, error } = await supabase
    .from('vw_propiedades_publicas')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !propiedad || !propiedad.activo) {
    notFound();
  }

  const operacion = propiedad.operacion_nombre?.toLowerCase() === 'alquiler' ? 'Alquiler' : 'Venta';
  const formatoMoneda = new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });

  // Parsear imágenes - manejar múltiples formatos posibles
  let imagenes: string[] = [];
  
  // Caso 1: main_image_url siempre disponible
  if (propiedad.main_image_url) {
    imagenes.push(propiedad.main_image_url);
  }
  
  // Caso 2: imagenes puede ser array o string JSON
  if (propiedad.imagenes) {
    if (Array.isArray(propiedad.imagenes)) {
      // Si es array, agregar los que no estén ya
      propiedad.imagenes.forEach((url: string) => {
        if (!imagenes.includes(url)) {
          imagenes.push(url);
        }
      });
    } else if (typeof propiedad.imagenes === 'string') {
      try {
        const parsed = JSON.parse(propiedad.imagenes);
        if (Array.isArray(parsed)) {
          parsed.forEach((url: string) => {
            if (!imagenes.includes(url)) {
              imagenes.push(url);
            }
          });
        }
      } catch (e) {
        console.error('Error parsing imagenes:', e);
      }
    }
  }

  // Fallback a imagen genérica si no hay ninguna
  if (imagenes.length === 0) {
    imagenes = ['/sinimagen.webp'];
  }

  // Construir ubicación completa
  const ubicacionParts = [
    propiedad.direccion_exacta,
    propiedad.zona,
    propiedad.municipio,
    propiedad.ciudad,
    propiedad.estado
  ].filter(Boolean);
  const ubicacionCompleta = ubicacionParts.join(', ');

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header con Imagen Principal */}
      <div className="relative h-[50vh] md:h-[60vh] w-full bg-gray-200">
        <Image
          src={imagenes[0]}
          alt={propiedad.titulo}
          fill
          className="object-cover"
          priority
          unoptimized
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src !== '/sinimagen.webp') {
              target.src = '/sinimagen.webp';
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Información sobre la imagen */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-4 py-1.5 bg-blue-600 rounded-full text-sm font-semibold">
                  {operacion}
                </span>
                <span className="text-2xl md:text-3xl font-bold">
                  {formatoMoneda.format(propiedad.precio || 0)}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">{propiedad.titulo}</h1>
              {ubicacionCompleta && (
                <div className="flex items-center gap-2 text-lg">
                  <MapPin size={20} />
                  <span>{ubicacionCompleta}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="container mx-auto max-w-6xl px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Características Principales */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Características</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {propiedad.habitaciones !== null && (
                  <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <Bed size={24} className="text-blue-600 mb-2" />
                    <span className="text-2xl font-bold text-gray-900">{propiedad.habitaciones}</span>
                    <span className="text-sm text-gray-600">Habitaciones</span>
                  </div>
                )}
                {propiedad.banos !== null && (
                  <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <Bath size={24} className="text-blue-600 mb-2" />
                    <span className="text-2xl font-bold text-gray-900">{propiedad.banos}</span>
                    <span className="text-sm text-gray-600">Baños</span>
                  </div>
                )}
                {propiedad.area_total !== null && (
                  <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <Square size={24} className="text-blue-600 mb-2" />
                    <span className="text-2xl font-bold text-gray-900">{propiedad.area_total}</span>
                    <span className="text-sm text-gray-600">m² Total</span>
                  </div>
                )}
                {propiedad.area_construida !== null && (
                  <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <Home size={24} className="text-blue-600 mb-2" />
                    <span className="text-2xl font-bold text-gray-900">{propiedad.area_construida}</span>
                    <span className="text-sm text-gray-600">m² Construidos</span>
                  </div>
                )}
                {propiedad.puestos_estacionamiento !== null && (
                  <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <CheckCircle size={24} className="text-blue-600 mb-2" />
                    <span className="text-2xl font-bold text-gray-900">{propiedad.puestos_estacionamiento}</span>
                    <span className="text-sm text-gray-600">Estacionamientos</span>
                  </div>
                )}
                {propiedad.piso !== null && (
                  <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                    <Building size={24} className="text-blue-600 mb-2" />
                    <span className="text-2xl font-bold text-gray-900">{propiedad.piso}</span>
                    <span className="text-sm text-gray-600">Piso</span>
                  </div>
                )}
              </div>

              {/* Más detalles */}
              {(propiedad.condicion || propiedad.antiguedad_anios !== null) && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                  {propiedad.condicion && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={18} className="text-green-500" />
                      <span className="font-medium">Condición:</span>
                      <span>{propiedad.condicion}</span>
                    </div>
                  )}
                  {propiedad.antiguedad_anios !== null && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={18} className="text-green-500" />
                      <span className="font-medium">Antigüedad:</span>
                      <span>{propiedad.antiguedad_anios} años</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Descripción */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Descripción</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {propiedad.descripcion || 'No hay descripción disponible.'}
              </p>
            </div>

            {/* Galería */}
            {imagenes.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Galería de Imágenes</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {imagenes.slice(1).map((img: string, idx: number) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={img}
                        alt={`Vista ${idx + 2}`}
                        fill
                        className="object-cover hover:scale-110 transition-transform duration-300"
                        unoptimized
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src !== '/sinimagen.webp') {
                            target.src = '/sinimagen.webp';
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar de Contacto */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h3 className="text-lg font-semibold mb-6">Contactar Vendedor</h3>

              {/* Datos del vendedor */}
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  {propiedad.propietario_foto ? (
                    <Image
                      src={propiedad.propietario_foto}
                      alt={propiedad.propietario_nombre || 'Vendedor'}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                      <Building size={32} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-lg truncate">{propiedad.propietario_nombre || 'Vendedor'}</p>
                    {propiedad.propietario_verificado && (
                      <CheckCircle size={18} className="text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  {propiedad.propietario_empresa && (
                    <p className="text-sm text-gray-600 truncate">{propiedad.propietario_empresa}</p>
                  )}
                  <p className="text-sm text-gray-500 capitalize">
                    {propiedad.propietario_tipo === 'empresa' ? 'Empresa' : 'Particular'}
                  </p>
                </div>
              </div>

              {/* Botones de contacto */}
              <div className="space-y-3">
                {propiedad.propietario_telefono && (
                  <>
                    <a
                      href={`https://wa.me/${propiedad.propietario_telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola, me interesa: ${propiedad.titulo}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors"
                    >
                      <MessageCircle size={20} />
                      WhatsApp
                    </a>
                    <a
                      href={`tel:${propiedad.propietario_telefono}`}
                      className="flex items-center justify-center gap-2 w-full border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                    >
                      <Phone size={20} />
                      {propiedad.propietario_telefono}
                    </a>
                  </>
                )}

                {propiedad.propietario_email && (
                  <a
                    href={`mailto:${propiedad.propietario_email}`}
                    className="flex items-center justify-center gap-2 w-full border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Mail size={20} />
                    Enviar Email
                  </a>
                )}

                {!propiedad.propietario_telefono && !propiedad.propietario_email && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay datos de contacto disponibles
                  </p>
                )}
              </div>

              {/* Info adicional */}
              <div className="mt-6 pt-6 border-t border-gray-100 text-sm text-gray-500 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar size={14} />
                  <p>Publicado: {new Date(propiedad.creado_en).toLocaleDateString()}</p>
                </div>
                <p>ID: {propiedad.id.slice(0, 8)}...</p>
                {propiedad.visitas !== null && (
                  <div className="flex items-center gap-2">
                    <Eye size={14} />
                    <p>Visitas: {propiedad.visitas}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
