import { Metadata } from 'next';
import { notFound } from 'next/navigation';
// Usamos el cliente de servidor con service role para evitar problemas de RLS y caché
import { createServerClient } from '@/lib/supabase-server';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Home, Bath, Bed, Square, Phone, MessageCircle, CheckCircle, DollarSign, Calendar } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();
  
  // Fetch property data with all fields to check existence and active status
  const { data: propiedad, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !propiedad) {
    return { title: 'Propiedad no encontrada' };
  }

  if (!propiedad.activo) {
    return { title: 'Propiedad no encontrada' };
  }

  const operacion = propiedad.operacion_tipo?.toLowerCase() === 'venta' ? 'Venta' : 'Alquiler';
  return {
    title: `${operacion}: ${propiedad.titulo} en ${propiedad.ubicacion_ciudad}, ${propiedad.ubicacion_estado}`,
    description: propiedad.descripcion?.substring(0, 160),
    openGraph: {
      title: `${operacion}: ${propiedad.titulo}`,
      description: propiedad.descripcion?.substring(0, 160),
      type: 'website',
    },
  };
}

async function getPropertyData(id: string) {
  const supabase = createServerClient();
  
  // Obtener propiedad sin filtro de activo primero para verificar existencia
  let { data: propiedad, error } = await supabase
    .from('productos')
    .select(`
      *,
      perfiles (
        id,
        nombre,
        telefono,
        verificado,
        nivel_confianza,
        foto_perfil_url
      )
    `)
    .eq('id', id)
    .single();

  if (error || !propiedad) {
    console.error('Error al cargar propiedad o no existe:', error?.message || 'No encontrada', 'ID:', id);
    return null;
  }

  if (!propiedad.activo) {
    console.warn('Propiedad existe pero está inactiva:', id);
    return null;
  }

  return propiedad;
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const propiedad = await getPropertyData(id);

  if (!propiedad) {
    notFound();
  }

  const formatoMoneda = new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });

  const imagenes = propiedad.imagenes_urls as string[] || [];
  const caracteristicas = propiedad.caracteristicas as any || {};
  const perfil = propiedad.perfiles;
  
  const whatsappMessage = `Hola, me interesa el inmueble: ${propiedad.titulo} (${formatoMoneda.format(propiedad.precio_usd)})`;
  const whatsappLink = perfil?.telefono 
    ? `https://wa.me/${perfil.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header con Imagen Principal */}
      <div className="relative h-[400px] md:h-[500px] w-full bg-gray-200">
        {imagenes.length > 0 ? (
          <Image
            src={imagenes[0]}
            alt={propiedad.titulo}
            fill
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Sin imagen disponible
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="container mx-auto">
            <span className="inline-block px-3 py-1 bg-blue-600 rounded-full text-sm font-medium mb-2">
              {operacion || 'Venta'}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{propiedad.titulo}</h1>
            <div className="flex items-center gap-2 text-lg">
              <MapPin size={20} />
              <span>{propiedad.ubicacion_ciudad}, {propiedad.ubicacion_estado}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Precio y Datos Clave */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                  <span className="text-3xl font-bold text-gray-900">
                    ${propiedad.precio_usd?.toLocaleString()}
                  </span>
                  {propiedad.precio_bs && (
                    <p className="text-gray-500 text-sm">Bs. {propiedad.precio_bs.toLocaleString()}</p>
                  )}
                </div>
                <div className="flex gap-4">
                  {caracteristicas.habitaciones && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Bed size={20} className="text-blue-600" />
                      <span>{caracteristicas.habitaciones} Hab</span>
                    </div>
                  )}
                  {caracteristicas.banos && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Bath size={20} className="text-blue-600" />
                      <span>{caracteristicas.banos} Baños</span>
                    </div>
                  )}
                  {caracteristicas.area_m2 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Square size={20} className="text-blue-600" />
                      <span>{caracteristicas.area_m2} m²</span>
                    </div>
                  )}
                </div>
              </div>

              <hr className="my-6" />

              <h2 className="text-xl font-semibold mb-4">Descripción</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {propiedad.descripcion || 'No hay descripción disponible.'}
              </p>
            </div>

            {/* Características Detalladas */}
            {Object.keys(caracteristicas).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Características</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(caracteristicas).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="capitalize">{key.replace('_', ' ')}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              <h3 className="text-lg font-semibold mb-4">Contactar Vendedor</h3>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                  {perfil?.foto_perfil_url ? (
                    <Image
                      src={perfil.foto_perfil_url}
                      alt={perfil.nombre || 'Vendedor'}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Home size={32} />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-lg">{perfil?.nombre || 'Vendedor'}</p>
                    {perfil?.verificado && (
                      <CheckCircle size={18} className="text-blue-500" />
                    )}
                  </div>
                  {perfil?.nivel_confianza !== null && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <span>Nivel de confianza:</span>
                      <span className="font-bold text-yellow-600">{perfil.nivel_confianza}/100</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    <MessageCircle size={20} />
                    Contactar por WhatsApp
                  </a>
                )}
                
                {perfil?.telefono && (
                  <a
                    href={`tel:${perfil.telefono}`}
                    className="flex items-center justify-center gap-2 w-full border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Phone size={20} />
                    {perfil.telefono}
                  </a>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 text-sm text-gray-500">
                <p className="flex items-center gap-2 mb-2">
                  <Calendar size={16} />
                  Publicado: {new Date(propiedad.creado_en).toLocaleDateString()}
                </p>
                <p className="flex items-center gap-2">
                  <DollarSign size={16} />
                  ID: {propiedad.id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
// Force rebuild
