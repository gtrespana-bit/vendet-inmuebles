'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LocalLink from '@/components/LocalLink';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { ESTADOS, MUNICIPIOS_POR_ESTADO } from '@/lib/ubicaciones';

interface ImagePreview {
  file: File;
  preview: string;
  id: string;
}

export default function PublicarInmueblePage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es';
  const tLanding = useTranslations('landing');
  const tPublish = useTranslations('publishProperty');
  const { user, loading: authLoading, session } = useAuth();
  const [maxFotos, setMaxFotos] = useState(8);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [planLimits, setPlanLimits] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/plan')
      .then(r => r.json())
      .then(d => {
        if (d.limits) {
          setMaxFotos(d.limits.maxFotos);
          setPlanLimits(d);
        }
        setLoadingPlan(false);
      })
      .catch(() => setLoadingPlan(false));
  }, [user]);

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
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const validFiles = files.filter(file => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
    const remaining = Math.max(0, maxFotos - imagenes.length);
    if (validFiles.length !== files.length) {
      setError(tPublish('fileTypeError'));
    } else if (validFiles.length > remaining) {
      setError(tPublish('imageLimitError'));
    } else {
      setError(null);
    }
    const newImages = validFiles.slice(0, remaining).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }));
    setImagenes(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    const removed = imagenes.find(img => img.id === id);
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    setImagenes(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validaciones básicas
      if (!titulo || !descripcion || !precio || !estado || !ciudad) {
        throw new Error(tPublish('requiredError'));
      }

      if (imagenes.length === 0) {
        throw new Error(tPublish('needImageError'));
      }
      if (!user) {
        throw new Error(tPublish('loginRequiredError'));
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) {
        throw new Error(tPublish('sessionExpiredError'));
      }

      // Subir imágenes a Cloudflare R2
      const imageUrls: string[] = [];
      for (const img of imagenes) {
        const safeFileName = img.file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100);
        const fileName = `${user.id}/inmuebles/${Date.now()}-${safeFileName}`;
        
        // Obtener presigned URL desde API
        const presignedRes = await fetch('/api/r2-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            key: fileName, 
            contentType: img.file.type || 'image/jpeg'
          }),
        });

        if (!presignedRes.ok) {
          throw new Error(tPublish('signUrlError'));
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
          throw new Error(tPublish('uploadError'));
        }

        imageUrls.push(publicUrl);
      }

      // Crear propiedad en Supabase
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
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
          area: area ? parseFloat(area) : null,
          imagenes: imageUrls,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tPublish('createError'));
      }

      const nuevaPropiedad = await res.json();
      
      setSuccess(true);
      // Redirigir a la página de detalle de la propiedad recién creada
      setTimeout(() => {
        router.push(`${locale === 'en' ? '/en' : ''}/inmueble/${nuevaPropiedad.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al publicar inmueble');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-[55vh] flex items-center justify-center text-sm text-gray-500" aria-busy="true">{tPublish('loadingAccount')}</div>;
  }

  if (!user) {
    const redirect = encodeURIComponent('/publicar-inmueble');
    return (
      <div className="min-h-[65vh] flex items-center justify-center py-10">
        <section className="publish-gate">
          <p className="home-eyebrow">{tLanding('publishGateEyebrow')}</p>
          <h1>{tLanding('publishGateTitle')}</h1>
          <p>{tLanding('publishGateDescription')}</p>
          <p className="publish-gate__note">{tLanding('publishGateNote')}</p>
          <div className="publish-gate__actions">
            <LocalLink href={`/register?redirect=${redirect}`}>{tLanding('publishGateSignup')}</LocalLink>
            <LocalLink href={`/login?redirect=${redirect}`}>{tLanding('publishGateLogin')}</LocalLink>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F1E9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <p className="home-eyebrow">{tPublish('eyebrow')}</p>
          <h1 className="text-4xl md:text-5xl font-heading font-normal tracking-tight text-gray-900 mb-3">{tPublish('title')}</h1>
          <p className="max-w-2xl text-sm leading-6 text-gray-600">{tPublish('intro')}</p>
        </header>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6" role="status">
            {tPublish('success')}
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="listing-form p-6 md:p-8 space-y-6">
          {/* Tipo de Operación */}
          <div>
            <p id="operation-label" className="block text-sm font-medium text-gray-700 mb-2">
              {tPublish('operation')}
            </p>
            <div className="flex gap-4" role="group" aria-labelledby="operation-label">
              <button
                type="button"
                aria-pressed={tipoOperacion === 'venta'}
                onClick={() => setTipoOperacion('venta')}
                className={`flex-1 py-3 px-4 rounded-lg border ${
                  tipoOperacion === 'venta'
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-gray-700 border-[#DCD6C6] hover:bg-[#F7F4EC]'
                }`}
              >
                {tPublish('sale')}
              </button>
              <button
                type="button"
                aria-pressed={tipoOperacion === 'alquiler'}
                onClick={() => setTipoOperacion('alquiler')}
                className={`flex-1 py-3 px-4 rounded-lg border ${
                  tipoOperacion === 'alquiler'
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'bg-white text-gray-700 border-[#DCD6C6] hover:bg-[#F7F4EC]'
                }`}
              >
                {tPublish('rent')}
              </button>
            </div>
          </div>

          {/* Título */}
          <div>
            <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 mb-2">
              {tPublish('titleField')}
            </label>
            <input
              type="text"
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              placeholder={tPublish('titlePlaceholder')}
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-2">
              {tPublish('description')}
            </label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
              placeholder={tPublish('descriptionPlaceholder')}
              required
            />
          </div>

          {/* Precio */}
          <div>
            <label htmlFor="precio" className="block text-sm font-medium text-gray-700 mb-2">
              {tPublish('price')}
            </label>
            <input
              type="number"
              id="precio"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
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
                {tPublish('state')}
              </label>
              <select
                id="estado"
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setCiudad('');
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                required
              >
                <option value="">{tPublish('selectState')}</option>
                {ESTADOS.map((est) => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ciudad" className="block text-sm font-medium text-gray-700 mb-2">
                {tPublish('city')}
              </label>
              <select
                id="ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                disabled={!estado}
                required
              >
                <option value="">{tPublish('selectCity')}</option>
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
                {tPublish('bedrooms')}
              </label>
              <input
                type="number"
                id="habitaciones"
                value={habitaciones}
                onChange={(e) => setHabitaciones(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="banos" className="block text-sm font-medium text-gray-700 mb-2">
                {tPublish('bathrooms')}
              </label>
              <input
                type="number"
                id="banos"
                value={banos}
                onChange={(e) => setBanos(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-2">
                {tPublish('area')}
              </label>
              <input
                type="number"
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Imágenes */}
          <div>
            <p id="images-label" className="block text-sm font-medium text-gray-700 mb-2">
              {tPublish('images')}
            </p>
            <button
              type="button"
              aria-labelledby="images-label"
              aria-describedby="images-help"
              onClick={() => fileInputRef.current?.click()}
              className="listing-upload"
            >
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-1 text-sm text-gray-600">{tPublish('uploadPrompt')}</p>
              <p id="images-help" className="text-xs text-gray-500">{tPublish('uploadLimit')}</p>
            </button>
            <input
              id="listing-images"
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
                    <Image
                      src={img.preview}
                      alt={tPublish('previewAlt')}
                      width={400}
                      height={300}
                      unoptimized
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      aria-label={tPublish('removeImage')}
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
                : 'bg-brand-primary hover:bg-brand-dark'
            }`}
          >
            {loading ? tPublish('publishing') : tPublish('publishButton')}
          </button>
        </form>
      </div>
    </div>
  );
}
