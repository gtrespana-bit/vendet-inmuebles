'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ESTADOS, MUNICIPIOS_POR_ESTADO } from '@/lib/ubicaciones';

interface ImagePreview {
  file: File;
  preview: string;
  id: string;
}

export default function PublicarInmueblePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Estados del formulario
  const [tipoOperacion, setTipoOperacion] = useState<'venta' | 'alquiler'>('venta');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [estado, setEstado] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [habitaciones, setHabitaciones] = useState(1);
  const [banos, setBanos] = useState(1);
  const [area, setArea] = useState('');
  const [imagenes, setImagenes] = useState<ImagePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        id: Math.random().toString(36).substr(2, 9)
      }));
      setImagenes(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (id: string) => {
    setImagenes(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validaciones básicas
      if (!titulo || !descripcion || !precio || !estado || !ciudad) {
        throw new Error('Todos los campos obligatorios deben estar completos');
      }

      if (imagenes.length === 0) {
        throw new Error('Debes subir al menos una imagen');
      }

      // Subir imágenes a Cloudflare R2
      const imageUrls: string[] = [];
      for (const img of imagenes) {
        const fileName = `inmuebles/${Date.now()}-${img.file.name}`;
        
        // Obtener presigned URL desde API
        const presignedRes = await fetch('/api/r2-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            key: fileName, 
            contentType: img.file.type || 'image/jpeg'
          }),
        });

        if (!presignedRes.ok) {
          throw new Error('Error al generar URL de subida');
        }

        const { url: uploadUrl, publicUrl } = await presignedRes.json();

        // Subir imagen directamente a R2 usando presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: img.file,
          headers: {
            'Content-Type': img.file.type || 'image/jpeg',
          },
        });

        if (!uploadRes.ok) {
          throw new Error('Error al subir imagen a R2');
        }

        imageUrls.push(publicUrl);
      }

      // Crear propiedad en Supabase
      if (!user) {
        throw new Error('Debes iniciar sesión para publicar un inmueble');
      }

      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          titulo,
          descripcion,
          precio: parseFloat(precio),
          tipo_operacion: tipoOperacion,
          estado,
          ciudad,
          habitaciones,
          banos,
          area: area ? parseInt(area) : null,
          imagenes: imageUrls,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al crear la propiedad');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/propiedades');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al publicar inmueble');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Publicar Inmueble</h1>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            ¡Inmueble publicado exitosamente! Redirigiendo...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-xl p-6 space-y-6">
          {/* Tipo de Operación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Operación *
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setTipoOperacion('venta')}
                className={`flex-1 py-3 px-4 rounded-lg border ${
                  tipoOperacion === 'venta'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Venta
              </button>
              <button
                type="button"
                onClick={() => setTipoOperacion('alquiler')}
                className={`flex-1 py-3 px-4 rounded-lg border ${
                  tipoOperacion === 'alquiler'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Alquiler
              </button>
            </div>
          </div>

          {/* Título */}
          <div>
            <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 mb-2">
              Título del Inmueble *
            </label>
            <input
              type="text"
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Apartamento moderno en Caracas"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-2">
              Descripción *
            </label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe las características principales del inmueble..."
              required
            />
          </div>

          {/* Precio */}
          <div>
            <label htmlFor="precio" className="block text-sm font-medium text-gray-700 mb-2">
              Precio (USD) *
            </label>
            <input
              type="number"
              id="precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* Ubicación */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-2">
                Estado *
              </label>
              <select
                id="estado"
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setCiudad('');
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar estado</option>
                {ESTADOS.map((est) => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ciudad" className="block text-sm font-medium text-gray-700 mb-2">
                Ciudad/Municipio *
              </label>
              <select
                id="ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!estado}
                required
              >
                <option value="">Seleccionar ciudad</option>
                {estado && MUNICIPIOS_POR_ESTADO[estado]?.map((mun) => (
                  <option key={mun.nombre} value={mun.capital}>
                    {mun.capital} ({mun.nombre})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Características */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="habitaciones" className="block text-sm font-medium text-gray-700 mb-2">
                Habitaciones
              </label>
              <input
                type="number"
                id="habitaciones"
                value={habitaciones}
                onChange={(e) => setHabitaciones(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="banos" className="block text-sm font-medium text-gray-700 mb-2">
                Baños
              </label>
              <input
                type="number"
                id="banos"
                value={banos}
                onChange={(e) => setBanos(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-2">
                Área (m²)
              </label>
              <input
                type="number"
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Imágenes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Imágenes *
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
            >
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-1 text-sm text-gray-600">Haz clic para subir imágenes</p>
              <p className="text-xs text-gray-500">PNG, JPG hasta 5MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Vista previa de imágenes */}
            {imagenes.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {imagenes.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.preview}
                      alt="Vista previa"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón de envío */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Publicando...' : 'Publicar Inmueble'}
          </button>
        </form>
      </div>
    </div>
  );
}
