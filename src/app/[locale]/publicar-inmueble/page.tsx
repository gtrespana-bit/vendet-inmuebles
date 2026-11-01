'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LocalLink from '@/components/LocalLink';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers';
import { ESTADOS, MUNICIPIOS_POR_ESTADO } from '@/lib/ubicaciones';
import LocationPicker from '@/components/map/LocationPicker';
import { resolveLocationViewport } from '@/lib/geo/venezuela';
import { compressImage } from '@/lib/image-compress';
import { limpiarMetodosContacto, validarMetodosContacto } from '@/lib/contact-methods';
import { FORM_AMENITY_GROUPS } from '@/lib/amenities';
import ContactMethodsFields, { type MetodosContactoForm } from '@/components/ContactMethodsFields';
import { trackGa4Event } from '@/lib/ga4';
import { getUrbanizacionesSugeridas } from '@/lib/urbanizaciones';
import { canPlanIncludeRichMedia, sanitizeExternalMediaUrl } from '@/lib/property-media';
import { Sparkles, Loader2, Video, Compass, Layers, Upload } from 'lucide-react';

interface ImagePreview {
  file: File;
  preview: string;
  id: string;
  score?: number; // 0-100 calidad estimada de la foto
}

// Catálogo alineado con public.tipos_inmueble (seed 001)
const TIPOS_PROPIEDAD = [
  { slug: 'casa', key: 'typeHouse' },
  { slug: 'apartamento', key: 'typeApartment' },
  { slug: 'townhouse', key: 'typeTownhouse' },
  { slug: 'terreno', key: 'typeLand' },
  { slug: 'local-comercial', key: 'typeCommercial' },
  { slug: 'oficina', key: 'typeOffice' },
  { slug: 'galpon', key: 'typeWarehouse' },
  { slug: 'habitacion', key: 'typeRoom' },
  { slug: 'finca', key: 'typeFarm' },
  { slug: 'edificio', key: 'typeBuilding' },
] as const;

const CONDICIONES = [
  { value: 'Nuevo', key: 'conditionNew' },
  { value: 'Usado - buen estado', key: 'conditionGood' },
  { value: 'Para remodelar', key: 'conditionRenovate' },
] as const;

/**
 * Estimación local y gratuita de la calidad de una foto (sin IA ni APIs de pago):
 * resolución, brillo y contraste. Da una puntuación 0-100 y sugerencias.
 */
async function scorePhoto(file: File): Promise<{ score: number; tips: string[] }> {
  const tips: string[] = [];
  let score = 70;

  try {
    const bitmap = await createImageBitmap(file);
    const w = bitmap.width;
    const h = bitmap.height;

    // Resolución
    if (w >= 1600) score += 15;
    else if (w >= 1200) score += 8;
    else { score -= 15; tips.push('lowRes'); }

    // Orientación horizontal preferida para portadas
    if (w > h) score += 5;
    else tips.push('preferLandscape');

    // Brillo y contraste con canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const sw = Math.min(w, 320);
      const sh = Math.max(1, Math.round((h / w) * sw));
      canvas.width = sw;
      canvas.height = sh;
      ctx.drawImage(bitmap, 0, 0, sw, sh);
      const { data } = ctx.getImageData(0, 0, sw, sh);
      let sum = 0;
      let sumSq = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += lum;
        sumSq += lum * lum;
      }
      const mean = sum / n;
      const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
      if (mean < 55) { score -= 12; tips.push('tooDark'); }
      else if (mean > 205) { score -= 10; tips.push('tooBright'); }
      else score += 5;
      if (std < 28) { score -= 8; tips.push('lowContrast'); }
    }
    bitmap.close?.();
  } catch {
    // Si no podemos analizarla, dejamos la puntuación base
  }

  return { score: Math.max(10, Math.min(100, Math.round(score))), tips };
}

export default function PublicarInmueblePage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es';
  const tLanding = useTranslations('landing');
  const tPublish = useTranslations('publishProperty');
  const tCatalog = useTranslations('catalog');
  const { user, loading: authLoading } = useAuth();
  const [maxFotos, setMaxFotos] = useState(8);
  const [planLimits, setPlanLimits] = useState<any>(null);
  const [agencyMembers, setAgencyMembers] = useState<Array<{ user_id: string; nombre: string; esDueno: boolean }>>([]);
  const [agenteAsignadoId, setAgenteAsignadoId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    setAgenteAsignadoId(user.id);
    let cancelled = false;
    (async () => {
      try {
        const headers = await getSupabaseAuthHeaders();
        const r = await fetch('/api/user/plan', { headers });
        if (!r.ok) throw new Error('plan');
        const d = await r.json();
        if (!cancelled && d.limits) {
          setMaxFotos(d.limits.maxFotos);
          setPlanLimits(d);
        }
        if (!cancelled && d.agencia?.esAdmin) {
          const agRes = await fetch('/api/agencia', { headers });
          if (agRes.ok) {
            const agData = await agRes.json();
            if (!cancelled && Array.isArray(agData.miembros)) {
              setAgencyMembers(agData.miembros);
            }
          }
        }
      } catch {
        // Sin plan info seguimos con el mínimo (8 fotos)
      } finally {
        if (!cancelled) { /* loading finished */ }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [subiendoFotos, setSubiendoFotos] = useState(0); // 0 = no subiendo
  const [aiError, setAiError] = useState<string | null>(null); // error visible junto al botón de IA
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Información básica
  const [tipoOperacion, setTipoOperacion] = useState<'venta' | 'alquiler'>('venta');
  const [tipoPropiedad, setTipoPropiedad] = useState('casa');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [mejorandoIA, setMejorandoIA] = useState(false);

  // Ubicación
  const [estado, setEstado] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [zona, setZona] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  // Detalles
  const [habitaciones, setHabitaciones] = useState(1);
  const [banos, setBanos] = useState(1);
  const [areaTerreno, setAreaTerreno] = useState('');
  const [areaConstruida, setAreaConstruida] = useState('');
  const [estacionamiento, setEstacionamiento] = useState(0);
  const [condicion, setCondicion] = useState('');
  const [amueblado, setAmueblado] = useState<'no' | 'parcial' | 'total'>('no');
  const [electricidad, setElectricidad] = useState<'110' | '220' | 'ambos'>('110');
  const [agua24h, setAgua24h] = useState(false);
  const [amenidades, setAmenidades] = useState<string[]>([]);

  // Precio
  const [precio, setPrecio] = useState('');

  // Métodos de contacto de este anuncio (llamadas / WhatsApp / email / Messenger)
  const [metodosContacto, setMetodosContacto] = useState<MetodosContactoForm>({});

  // Imágenes y multimedia adicional
  const [imagenes, setImagenes] = useState<ImagePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const planoInputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [virtualTourUrl, setVirtualTourUrl] = useState('');
  const [planoUrl, setPlanoUrl] = useState('');
  const [subiendoPlano, setSubiendoPlano] = useState(false);

  const richMediaAllowed = canPlanIncludeRichMedia(
    planLimits?.effectivePublishingPlan || planLimits?.plan
  );

  const handlePlanoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError(tPublish('fileTypeError'));
      return;
    }
    setSubiendoPlano(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(tPublish('sessionExpiredError'));
      const safeFileName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
      const key = `${user.id}/planos/${Date.now()}-${safeFileName}`;
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('key', key);
      fd.append('file', compressed);
      const uploadRes = await fetch('/api/r2-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      if (!uploadRes.ok) throw new Error(tPublish('uploadError'));
      const { publicUrl } = await uploadRes.json();
      setPlanoUrl(publicUrl);
    } catch (err: any) {
      setError(err.message || tPublish('uploadError'));
    } finally {
      setSubiendoPlano(false);
    }
  };

  const toggleAmenidad = (nombre: string) => {
    setAmenidades(prev => prev.includes(nombre) ? prev.filter(a => a !== nombre) : [...prev, nombre]);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const validFiles = files.filter(file => file.type.startsWith('image/') && file.size <= 4 * 1024 * 1024);
    const remaining = Math.max(0, maxFotos - imagenes.length);
    if (validFiles.length !== files.length) {
      setError(tPublish('fileTypeError'));
    } else if (validFiles.length > remaining) {
      setError(tPublish('imageLimitError'));
    } else {
      setError(null);
    }
    const newImages: ImagePreview[] = validFiles.slice(0, remaining).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }));
    setImagenes(prev => [...prev, ...newImages]);

    // Puntuación local de calidad (gratuita, sin APIs)
    for (const img of newImages) {
      scorePhoto(img.file).then(({ score }) => {
        setImagenes(prev => prev.map(p => p.id === img.id ? { ...p, score } : p));
      });
    }
  };

  const removeImage = (id: string) => {
    const removed = imagenes.find(img => img.id === id);
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    setImagenes(prev => prev.filter(img => img.id !== id));
  };

  // Reordenar fotos: la primera es la portada
  const moveImage = (index: number, dir: -1 | 1) => {
    setImagenes(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const dragIndexRef = useRef<number | null>(null);
  const handleDragStart = (index: number) => { dragIndexRef.current = index; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (index: number) => {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === index) return;
    setImagenes(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  };

  // Descripción con IA (solo si GEMINI_API_KEY está configurada — plan gratuito de Gemini)
  const mejorarDescripcion = async () => {
    setMejorandoIA(true);
    setAiError(null);
    try {
      const headers = await getSupabaseAuthHeaders();
      const res = await fetch('/api/ai/mejorar-descripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          descripcion,
          titulo,
          tipo: tPublish(tipoPropiedadToKey(tipoPropiedad)),
          operacion: tipoOperacion === 'venta' ? 'venta' : 'alquiler',
          ubicacion: [ciudad, estado].filter(Boolean).join(', '),
          habitaciones,
          banos,
          areaConstruida: areaConstruida || null,
          areaTerreno: areaTerreno || null,
          amueblado,
          amenidades,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'IA');
      setDescripcion(data.descripcion);
    } catch (err: any) {
      // Error visible junto al botón (el banner de arriba queda fuera de vista)
      setAiError(err.message && err.message !== 'IA'
        ? err.message
        : tPublish('aiUnavailable'));
    } finally {
      setMejorandoIA(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!titulo || !descripcion || !precio || !estado || !ciudad) {
        throw new Error(tPublish('requiredError'));
      }
      if (imagenes.length === 0) {
        throw new Error(tPublish('needImageError'));
      }
      if (!user) {
        throw new Error(tPublish('loginRequiredError'));
      }

      const campoInvalido = validarMetodosContacto(metodosContacto);
      if (campoInvalido) {
        if (campoInvalido === 'telefono' || campoInvalido === 'whatsapp') throw new Error(tPublish('invalidPhone'));
        if (campoInvalido === 'email') throw new Error(tPublish('invalidEmail'));
        throw new Error(tPublish('invalidMessenger'));
      }

      if (richMediaAllowed) {
        for (const rawLink of [videoUrl, virtualTourUrl, planoUrl]) {
          if (rawLink.trim() && !sanitizeExternalMediaUrl(rawLink)) {
            throw new Error(tPublish('invalidMediaUrlError'));
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== user.id) {
        throw new Error(tPublish('sessionExpiredError'));
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };

      // Subir imágenes por el servidor (sin CORS de R2)
      const imageUrls: string[] = [];
      for (let i = 0; i < imagenes.length; i++) {
        const img = imagenes[i];
        setSubiendoFotos(i + 1);
        const safeFileName = img.file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100);
        const fileName = `${user.id}/inmuebles/${Date.now()}-${safeFileName}`;

        // Comprimir en cliente: Vercel rechaza con 413 los bodies > 4.5 MB
        const fileToUpload = await compressImage(img.file);
        const formData = new FormData();
        formData.append('key', fileName);
        formData.append('file', fileToUpload);

        const uploadRes = await fetch('/api/r2-upload', {
          method: 'POST',
          headers,
          body: formData,
        });
        if (!uploadRes.ok) {
          const detail = await uploadRes.json().catch(() => null);
          if (uploadRes.status === 413) {
            throw new Error(tPublish('uploadTooLarge'));
          }
          throw new Error(detail?.error || tPublish('uploadError'));
        }
        const { publicUrl } = await uploadRes.json();
        imageUrls.push(publicUrl);
      }
      setSubiendoFotos(0);

      // Características especiales → catálogo `caracteristicas`
      const caracteristicas: string[] = [];
      if (amueblado === 'total') caracteristicas.push('Amueblado');
      if (amueblado === 'parcial') caracteristicas.push('Amueblado parcialmente');
      if (electricidad === '110' || electricidad === 'ambos') caracteristicas.push('Electricidad 110V');
      if (electricidad === '220' || electricidad === 'ambos') caracteristicas.push('Electricidad 220V');
      if (agua24h) caracteristicas.push('Agua 24 horas');
      caracteristicas.push(...amenidades);

      // Crear propiedad en Supabase
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          userId: user.id,
          titulo,
          descripcion,
          precio: parseFloat(precio),
          tipo_operacion: tipoOperacion,
          tipo_propiedad: tipoPropiedad,
          estado,
          ciudad,
          zona: zona.trim() || null,
          habitaciones,
          banos,
          area: areaTerreno ? parseFloat(areaTerreno) : null,
          area_construida: areaConstruida ? parseFloat(areaConstruida) : null,
          puestos_estacionamiento: estacionamiento,
          condicion: condicion || null,
          caracteristicas,
          imagenes: imageUrls,
          video_url: richMediaAllowed && videoUrl.trim() ? videoUrl.trim() : null,
          virtual_tour_url: richMediaAllowed && virtualTourUrl.trim() ? virtualTourUrl.trim() : null,
          plano_url: richMediaAllowed && planoUrl.trim() ? planoUrl.trim() : null,
          latitud: pin?.lat ?? null,
          longitud: pin?.lng ?? null,
          metodos_contacto: limpiarMetodosContacto(metodosContacto),
          ...(planLimits?.agencia?.esAdmin && agenteAsignadoId
            ? { agente_asignado_id: agenteAsignadoId }
            : {}),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tPublish('createError'));
      }

      const nuevaPropiedad = await res.json();
      trackGa4Event('publish_property', {
        item_id: nuevaPropiedad.id,
        operation: tipoOperacion,
        property_type: tipoPropiedad,
        state: estado,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push(`${locale === 'en' ? '/en' : ''}/inmueble/${nuevaPropiedad.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al publicar inmueble');
    } finally {
      setLoading(false);
      setSubiendoFotos(0);
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

  const inputClass = 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent bg-white';
  const sectionTitle = 'text-lg font-heading font-normal text-gray-900 mb-3 mt-2';

  return (
    <div className="min-h-screen bg-[#F4F1E9] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <p className="home-eyebrow">{tPublish('eyebrow')}</p>
          <h1 className="text-4xl md:text-5xl font-heading font-normal tracking-tight text-gray-900 mb-3">{tPublish('title')}</h1>
          <p className="max-w-2xl text-sm leading-6 text-gray-600">{tPublish('intro')}</p>
          {planLimits && (
            <p className="mt-3 text-xs text-gray-500">
              {tPublish('planUsageNote', { plan: planLimits.effectivePublishingPlan || planLimits.plan, active: planLimits.activeCount, max: planLimits.limits?.maxAnuncios >= 999999 ? '∞' : String(planLimits.limits?.maxAnuncios ?? '?') })}
            </p>
          )}
          {planLimits?.agencia?.planAgenciaActivo && (
            <div className="mt-4 bg-white border border-[#E5DEC9] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  {locale === 'en' ? 'Agency Portfolio' : 'Cartera de Agencia'} · {planLimits.agencia.nombre}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {locale === 'en'
                    ? 'This property belongs to your agency portfolio (up to 30 photos). Calls, WhatsApp & chat route to the assigned advisor.'
                    : 'Este inmueble quedará protegido en la cartera de la agencia (hasta 30 fotos) y los clientes contactarán al agente asignado.'}
                </p>
              </div>
              {planLimits.agencia.esAdmin && agencyMembers.length > 0 && (
                <div className="shrink-0">
                  <label htmlFor="publish-assigned-agent" className="block text-[11px] font-semibold text-gray-600 mb-1">
                    {locale === 'en' ? 'Assigned advisor:' : 'Agente responsable:'}
                  </label>
                  <select
                    id="publish-assigned-agent"
                    value={agenteAsignadoId}
                    onChange={(e) => setAgenteAsignadoId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#FAF8F4] text-gray-900"
                  >
                    {agencyMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.nombre} {m.esDueno ? (locale === 'en' ? '(Owner)' : '(Titular)') : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
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

        <form onSubmit={handleSubmit} className="listing-form p-6 md:p-8 space-y-8">
          {/* ============ 1. INFORMACIÓN BÁSICA ============ */}
          <section aria-labelledby="sec-basica">
            <p className="home-eyebrow">1 · {tPublish('sectionBasics')}</p>
            <h2 id="sec-basica" className={sectionTitle}>{tPublish('sectionBasics')}</h2>

            <div className="space-y-5">
              {/* Operación */}
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

              {/* Tipo de propiedad */}
              <div>
                <label htmlFor="tipo-propiedad" className="block text-sm font-medium text-gray-700 mb-2">
                  {tPublish('propertyType')} *
                </label>
                <select
                  id="tipo-propiedad"
                  value={tipoPropiedad}
                  onChange={(e) => setTipoPropiedad(e.target.value)}
                  className={inputClass}
                  required
                >
                  {TIPOS_PROPIEDAD.map(t => (
                    <option key={t.slug} value={t.slug}>{tPublish(t.key)}</option>
                  ))}
                </select>
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
                  className={inputClass}
                  placeholder={tPublish('titlePlaceholder')}
                  required
                />
              </div>

              {/* Descripción + IA */}
              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700">
                    {tPublish('description')}
                  </label>
                  <button
                    type="button"
                    onClick={mejorarDescripcion}
                    disabled={mejorandoIA}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:bg-brand-accent/10 px-3 py-1.5 rounded-lg border border-brand-accent/40 transition disabled:opacity-50"
                  >
                    {mejorandoIA ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {tPublish('aiImprove')}
                  </button>
                </div>
                {aiError && (
                  <p role="alert" className="mt-2 text-xs text-red-600">
                    {aiError}
                  </p>
                )}
                <textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={5}
                  className={inputClass}
                  placeholder={tPublish('descriptionPlaceholder')}
                  required
                />
              </div>
            </div>
          </section>

          {/* ============ 2. UBICACIÓN ============ */}
          <section aria-labelledby="sec-ubicacion">
            <p className="home-eyebrow">2 · {tPublish('sectionLocation')}</p>
            <h2 id="sec-ubicacion" className={sectionTitle}>{tPublish('sectionLocation')}</h2>

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
                    setPin(null);
                  }}
                  className={inputClass}
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
                  onChange={(e) => {
                    setCiudad(e.target.value);
                    setPin(null);
                  }}
                  className={inputClass}
                  disabled={!estado}
                  required
                >
                  <option value="">{tPublish('selectCity')}</option>
                  {estado && [...(MUNICIPIOS_POR_ESTADO[estado] || [])]
                    .sort((a, b) => a.capital.localeCompare(b.capital, 'es'))
                    .map((mun) => (
                      <option key={mun.nombre} value={mun.capital}>
                        {mun.capital === mun.nombre ? mun.capital : `${mun.capital} (${mun.nombre})`}
                      </option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="zona" className="block text-sm font-medium text-gray-700 mb-2">
                  {tPublish('neighborhood')} <span className="text-gray-400 font-normal">({tPublish('optional')})</span>
                </label>
                <input
                  type="text"
                  id="zona"
                  list="publish-zonas-datalist"
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  maxLength={120}
                  placeholder={tPublish('neighborhoodPlaceholder')}
                  className={inputClass}
                />
                <datalist id="publish-zonas-datalist">
                  {getUrbanizacionesSugeridas(estado || undefined, ciudad || undefined).map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Mapa */}
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  {tPublish('mapTitle')}
                </label>
                <span className="text-xs text-gray-500">{tPublish('mapOptional')}</span>
              </div>
              {(() => {
                const mapViewport = resolveLocationViewport({ estado, ciudad });
                return (
                  <LocationPicker
                    value={pin}
                    center={mapViewport.center}
                    zoom={mapViewport.zoom}
                    viewKey={mapViewport.key}
                    onChange={setPin}
                    labels={{
                      approximate: tPublish('mapApproximate'),
                      exact: tPublish('mapExact'),
                      viewListing: '',
                      bedrooms: '',
                      bathrooms: '',
                      area: '',
                      empty: '',
                      zoomIn: '',
                      zoomOut: '',
                      resetView: '',
                    }}
                    hint={tPublish('mapHint')}
                    clearLabel={tPublish('mapClear')}
                    emptyLabel={tPublish('mapEmpty')}
                    placeLabel={tPublish('mapPlace')}
                  />
                );
              })()}
              <p className="mt-2 text-xs text-gray-500">{tPublish('mapDescription')}</p>
            </div>
          </section>

          {/* ============ 3. DETALLES ============ */}
          <section aria-labelledby="sec-detalles">
            <p className="home-eyebrow">3 · {tPublish('sectionDetails')}</p>
            <h2 id="sec-detalles" className={sectionTitle}>{tPublish('sectionDetails')}</h2>

            <div className="space-y-5">
              {/* Números básicos */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="habitaciones" className="block text-sm font-medium text-gray-700 mb-2">
                    {tPublish('bedrooms')}
                  </label>
                  <input
                    type="number"
                    id="habitaciones"
                    value={habitaciones}
                    onChange={(e) => setHabitaciones(parseInt(e.target.value))}
                    className={inputClass}
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
                    className={inputClass}
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="estacionamiento" className="block text-sm font-medium text-gray-700 mb-2">
                    {tPublish('parking')}
                  </label>
                  <input
                    type="number"
                    id="estacionamiento"
                    value={estacionamiento}
                    onChange={(e) => setEstacionamiento(Math.max(0, parseInt(e.target.value) || 0))}
                    className={inputClass}
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="condicion" className="block text-sm font-medium text-gray-700 mb-2">
                    {tPublish('condition')}
                  </label>
                  <select
                    id="condicion"
                    value={condicion}
                    onChange={(e) => setCondicion(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{tPublish('selectOptional')}</option>
                    {CONDICIONES.map(c => (
                      <option key={c.value} value={c.value}>{tPublish(c.key)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Áreas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="area-terreno" className="block text-sm font-medium text-gray-700 mb-2">
                    {tPublish('landArea')} <span className="text-gray-400 font-normal">({tPublish('optional')})</span>
                  </label>
                  <input
                    type="number"
                    id="area-terreno"
                    value={areaTerreno}
                    onChange={(e) => setAreaTerreno(e.target.value)}
                    className={inputClass}
                    placeholder="m²"
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="area-construida" className="block text-sm font-medium text-gray-700 mb-2">
                    {tPublish('builtArea')} <span className="text-gray-400 font-normal">({tPublish('optional')})</span>
                  </label>
                  <input
                    type="number"
                    id="area-construida"
                    value={areaConstruida}
                    onChange={(e) => setAreaConstruida(e.target.value)}
                    className={inputClass}
                    placeholder="m²"
                    min="0"
                  />
                </div>
              </div>

              {/* Amueblado */}
              <div>
                <p id="furnished-label" className="block text-sm font-medium text-gray-700 mb-2">{tPublish('furnished')}</p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="furnished-label">
                  {(['no', 'parcial', 'total'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={amueblado === opt}
                      onClick={() => setAmueblado(opt)}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
                        amueblado === opt
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-white text-gray-700 border-[#DCD6C6] hover:bg-[#F7F4EC]'
                      }`}
                    >
                      {tPublish(opt === 'no' ? 'furnishedNone' : opt === 'parcial' ? 'furnishedPartial' : 'furnishedFull')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Electricidad */}
              <div>
                <p id="power-label" className="block text-sm font-medium text-gray-700 mb-2">{tPublish('electricity')}</p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="power-label">
                  {(['110', '220', 'ambos'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={electricidad === opt}
                      onClick={() => setElectricidad(opt)}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
                        electricidad === opt
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-white text-gray-700 border-[#DCD6C6] hover:bg-[#F7F4EC]'
                      }`}
                    >
                      {tPublish(opt === 'ambos' ? 'powerBoth' : `power${opt === '110' ? '110' : '220'}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agua 24h */}
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={agua24h}
                  onChange={(e) => setAgua24h(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-accent"
                />
                <span className="text-sm font-medium text-gray-700">{tPublish('water24h')}</span>
              </label>

              {/* Ambientes, servicios y amenidades (catálogo compartido con la edición) */}
              <div className="space-y-4">
                <p id="amenities-label" className="block text-sm font-medium text-gray-700">{tPublish('amenities')}</p>
                {FORM_AMENITY_GROUPS.map((group) => (
                  <fieldset key={group.key} className="space-y-2">
                    <legend className="text-sm font-semibold text-gray-800">
                      {tCatalog(`extra.amenityGroup.${group.key}`)}
                    </legend>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {group.options.map(({ key, name }) => (
                        <label key={key} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[#DCD6C6] bg-white hover:bg-[#F7F4EC] cursor-pointer text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={amenidades.includes(name)}
                            onChange={() => toggleAmenidad(name)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-accent"
                          />
                          {tCatalog(`extra.amenity.${key}`)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          </section>

          {/* ============ 4. IMÁGENES ============ */}
          <section aria-labelledby="sec-fotos">
            <p className="home-eyebrow">4 · {tPublish('sectionPhotos')}</p>
            <h2 id="sec-fotos" className={sectionTitle}>{tPublish('sectionPhotos')}</h2>

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
              <p id="images-label" className="mt-1 text-sm text-gray-600">{tPublish('uploadPrompt')}</p>
              <p id="images-help" className="text-xs text-gray-500">{tPublish('uploadLimitUpdated', { max: maxFotos })}</p>
            </button>
            <input
              id="listing-images"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {imagenes.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {imagenes.map((img, index) => (
                  <div
                    key={img.id}
                    className="relative group cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(index)}
                  >
                    <Image
                      src={img.preview}
                      alt={tPublish('previewAlt')}
                      width={400}
                      height={300}
                      unoptimized
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 bg-brand-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {tPublish('coverPhoto')}
                      </span>
                    )}
                    {typeof img.score === 'number' && (
                      <span
                        title={tPublish('photoScoreTitle')}
                        className={`absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          img.score >= 75 ? 'bg-emerald-100 text-emerald-700'
                          : img.score >= 50 ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                        }`}
                      >
                        📸 {img.score}
                      </span>
                    )}
                    {/* Reordenar: flechas (funcionan también en móvil) */}
                    <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label={tPublish('moveEarlier')}
                        onClick={() => moveImage(index, -1)}
                        disabled={index === 0}
                        className="bg-black/60 text-white rounded p-1 disabled:opacity-30 hover:bg-black/80"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                      <button
                        type="button"
                        aria-label={tPublish('moveLater')}
                        onClick={() => moveImage(index, 1)}
                        disabled={index === imagenes.length - 1}
                        className="bg-black/60 text-white rounded p-1 disabled:opacity-30 hover:bg-black/80"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 6l6 6-6 6" /></svg>
                      </button>
                    </div>
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
            {imagenes.length > 1 && (
              <p className="mt-2 text-xs text-gray-500">{tPublish('reorderHint')}</p>
            )}

            {/* Multimedia adicional: Vídeo, Recorrido 360° y Plano */}
            <div className="mt-6 rounded-xl border border-[#E5DEC9] bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {tPublish('richMediaTitle')}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {tPublish('richMediaSubtitle')}
                  </p>
                </div>
                {!richMediaAllowed && (
                  <LocalLink
                    href="/planes"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EBD9] border border-[#E1D0A9] px-3 py-1 text-xs font-semibold text-[#755B2C] hover:bg-[#eadcc0]"
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    {tPublish('richMediaUpgradeBadge')}
                  </LocalLink>
                )}
              </div>

              {!richMediaAllowed ? (
                <p className="text-xs text-gray-600 bg-[#FAF8F3] border border-[#EAE3D5] rounded-lg p-3">
                  {tPublish('richMediaLockedNote')}
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="video-url" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Video size={15} className="text-brand-primary" aria-hidden="true" />
                      {tPublish('videoUrlLabel')} <span className="text-gray-400 font-normal">({tPublish('optional')})</span>
                    </label>
                    <input
                      type="url"
                      id="video-url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... / Instagram Reel / TikTok"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="tour-url" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Compass size={15} className="text-brand-primary" aria-hidden="true" />
                      {tPublish('virtualTourUrlLabel')} <span className="text-gray-400 font-normal">({tPublish('optional')})</span>
                    </label>
                    <input
                      type="url"
                      id="tour-url"
                      value={virtualTourUrl}
                      onChange={(e) => setVirtualTourUrl(e.target.value)}
                      placeholder="https://my.matterport.com/show/?m=... / https://kuula.co/share/..."
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="plano-url" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Layers size={15} className="text-brand-primary" aria-hidden="true" />
                      {tPublish('floorPlanUrlLabel')} <span className="text-gray-400 font-normal">({tPublish('optional')})</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        id="plano-url"
                        value={planoUrl}
                        onChange={(e) => setPlanoUrl(e.target.value)}
                        placeholder="https://..."
                        className={inputClass}
                      />
                      <input
                        ref={planoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePlanoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={subiendoPlano}
                        onClick={() => planoInputRef.current?.click()}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#DCD4C6] bg-[#FAF8F3] text-xs font-semibold text-gray-800 hover:bg-[#F1ECE0] disabled:opacity-50"
                      >
                        {subiendoPlano ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {tPublish('uploadFloorPlanBtn')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ============ 5. PRECIO ============ */}
          <section aria-labelledby="sec-precio">
            <p className="home-eyebrow">5 · {tPublish('sectionPrice')}</p>
            <h2 id="sec-precio" className={sectionTitle}>{tPublish('sectionPrice')}</h2>
            <div className="max-w-xs">
              <label htmlFor="precio" className="block text-sm font-medium text-gray-700 mb-2">
                {tPublish('price')}
              </label>
              <input
                type="number"
                id="precio"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className={inputClass}
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>
          </section>

          {/* ============ 6. CONTACTO ============ */}
          <section aria-labelledby="sec-contacto">
            <p className="home-eyebrow">6 · {tPublish('contactSection')}</p>
            <ContactMethodsFields
              idPrefix="publish-contact"
              value={metodosContacto}
              onChange={setMetodosContacto}
              labels={{
                title: tPublish('contactTitle'),
                desc: tPublish('contactDesc'),
                whatsappLabel: tPublish('whatsappLabel'),
                phoneCallsLabel: tPublish('phoneCallsLabel'),
                emailLabel: tPublish('emailLabel'),
                messengerLabel: tPublish('messengerLabel'),
                chatAuto: tPublish('chatAuto'),
              }}
            />
          </section>

          {/* Botón de envío */}
          <button
            type="submit"
            disabled={loading || subiendoFotos > 0}
            className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${
              loading || subiendoFotos > 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-brand-primary hover:bg-brand-dark'
            }`}
          >
            {subiendoFotos > 0
              ? tPublish('uploadingPhotos', { current: subiendoFotos, total: imagenes.length })
              : loading ? tPublish('publishing') : tPublish('publishButton')}
          </button>
        </form>
      </div>
    </div>
  );
}

function tipoPropiedadToKey(slug: string): string {
  const found = TIPOS_PROPIEDAD.find(t => t.slug === slug);
  return found ? found.key : 'typeHouse';
}
