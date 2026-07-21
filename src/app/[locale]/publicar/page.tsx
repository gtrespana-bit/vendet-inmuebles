'use client'

import { useState, useEffect } from 'react'
import LocalLink from '@/components/LocalLink'
import { useRouter } from 'next/navigation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { categoriasData } from '@/lib/categorias'
import { ESTADOS, getMunicipiosNombres } from '@/lib/ubicaciones'
import { Camera, X, UploadCloud, AlertCircle, Phone, Mail, MapPin, MessageSquare } from 'lucide-react'
import { verificarContenido, formatearAlertaModeracion } from '@/lib/moderacion'
import { emailProductoPublicado } from '@/lib/server-email'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 30 }, (_, i) => String(currentYear - i))
// Condition keys for translation (DB values are Spanish)
const conditionKeys = [
  { value: 'Nuevo', key: 'conditionNew' },
  { value: 'Como nuevo', key: 'conditionLikeNew' },
  { value: 'Bueno', key: 'conditionGood' },
  { value: 'Usado', key: 'conditionUsed' },
]

// Map Spanish subcategory labels to translation keys
const subcategoryTranslationKeys: Record<string, string> = {
  // Vehiculos
  'Carros': 'cars', 'Camionetas/SUV': 'suvs', 'Motos': 'motorcycles', 'Camiones': 'trucks',
  'Furgonetas': 'vans', 'Autobuses/Buses': 'buses', 'Repuestos y Accesorios': 'partsAccessories',
  // Tecnologia
  'Celulares': 'phones', 'Laptops': 'laptops', 'Tablets': 'tablets', 'PC de Escritorio': 'desktops',
  'Monitores': 'monitors', 'Consolas': 'consoles', 'Audio': 'audio', 'Camaras': 'cameras',
  'Impresoras': 'printers', 'Redes': 'networking', 'Accesorios y Perifericos': 'peripherals',
  'Smartwatches': 'smartwatches',
  // Moda
  'Ropa Hombre': 'menClothing', 'Ropa Mujer': 'womenClothing', 'Calzado Hombre': 'menShoes',
  'Calzado Mujer': 'womenShoes', 'Relojes': 'watches', 'Bolsos y Mochilas': 'bagsBackpacks',
  'Accesorios': 'accessories', 'Ropa Ninos': 'kidsClothing', 'Joyeria': 'jewelry',
  // Hogar
  'Muebles': 'furniture', 'Electrodomesticos': 'appliances', 'Decoracion': 'decor',
  'Cocina': 'kitchen', 'Jardin': 'garden', 'Iluminacion': 'lighting', 'Bano': 'bathroom',
  // Herramientas
  'Herramientas Electricas': 'powerTools', 'Herramientas Manuales': 'handTools',
  'Equipo de Construccion': 'construction', 'Generadores': 'generators', 'Soldadoras': 'welders',
  'Compresores': 'compressors', 'Plomeria': 'plumbing',
  // Otros
  'Deportes': 'sports', 'Juguetes': 'toys', 'Instrumentos Musicales': 'instruments',
  'Libros': 'books', 'Mascotas': 'pets', 'Bebes': 'babies', 'Oficina': 'office',
  'Salud y Belleza': 'healthBeauty', 'Antiguedades': 'antiques', 'Coleccionables': 'collectibles',
  'Boletos': 'tickets', 'Servicios': 'services', 'Otros': 'others',
}

interface ImageFile {
  file: File
  preview: string
  uploadedUrl?: string
  uploading?: boolean
  error?: boolean
}

export default function PublicarPage() {
  const t = useTranslations('publicar')
  const tc = useTranslations('catalog')
  const { session, user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [subcategoria, setSubcategoria] = useState('')
  const [marca, setMarca] = useState('')
  const [estadoProd, setEstadoProd] = useState('')
  const [precioUsd, setPrecioUsd] = useState('')
  const [ubicacionEstado, setUbicacionEstado] = useState('')
  const [ubicacionCiudad, setUbicacionCiudad] = useState('')
  const [imagenes, setImagenes] = useState<ImageFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactWhatsApp, setContactWhatsApp] = useState('')
  const [contactMessenger, setContactMessenger] = useState('')
  const [moderacionResultado, setModeracionResultado] = useState<{ nivel: string; palabras: string[] } | null>(null)
  const [showEmprendedor, setShowEmprendedor] = useState(false)
  const [pubCount, setPubCount] = useState(0)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login')
    }
    if (user) {
      // Contar publicaciones para el progreso emprendedor
      supabase
        .from('productos')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('activo', true)
        .then(({ count }) => setPubCount(count || 0))
    }
  }, [authLoading, session, router, user])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      imagenes.forEach(img => {
        if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)
      })
    }
  }, [imagenes])

  if (authLoading) return <div className="min-h-[60vh] flex items-center justify-center"><p>{t('loading')}</p></div>
  if (!session) return null

  const cat = categoriasData[categoria]
  const sub = cat?.subs.find(s => s.label === subcategoria)

  const camposEspeciales = sub?.campos.map(c => ({
    ...c,
    options: (c.label === 'Año' || c.label === 'Ano') ? years : (c.label.toLowerCase().includes('marca') ? [...(c.options || []), 'Otra marca'] : c.options || []),
  })) || []

  const handleCatChange = (val: string) => {
    setCategoria(val); setSubcategoria(''); setMarca(''); setSpecs({})
  }
  const handleSubChange = (val: string) => {
    setSubcategoria(val); setMarca(''); setSpecs({})
  }
  const handleSpecChange = (label: string, value: string) => {
    setSpecs(prev => ({ ...prev, [label]: value }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const maxFiles = 10 - imagenes.length
    if (maxFiles <= 0) return

    const newImages: ImageFile[] = []
    for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      newImages.push({
        file,
        preview: URL.createObjectURL(file),
      })
    }
    setImagenes(prev => [...prev, ...newImages])
  }

  const removeImage = (i: number) => {
    const img = imagenes[i]
    if (img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview)
    setImagenes(prev => prev.filter((_, idx) => idx !== i))
  }

  const uploadImages = async (): Promise<string[]> => {
    const userId = user?.id

    // Marcar todas como subiendo
    setImagenes(prev => prev.map(p => ({ ...p, uploading: true })))

    // Subir todas las imágenes en paralelo a R2 (via presigned URLs)
    const uploadPromises = imagenes.map(async (img, i) => {
      const ext = img.file.name.split('.').pop() || 'jpg'
      const key = `${userId}/${Date.now()}_${i}.${ext}`.replace(/\s+/g, '_')

      // Pedir presigned URL al servidor
      const res = await fetch('/api/r2-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, contentType: img.file.type || 'image/jpeg' }),
      })

      if (!res.ok) {
        console.error('Error obteniendo presigned URL')
        setImagenes(prev => prev.map((p, idx) => idx === i ? { ...p, error: true, uploading: false } : p))
        return null
      }

      const { url: uploadUrl, publicUrl } = await res.json()

      // Subir archivo directamente a R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: img.file,
        headers: { 'Content-Type': img.file.type || 'image/jpeg' },
      })

      if (!uploadRes.ok) {
        console.error('Error subiendo a R2:', uploadRes.status)
        setImagenes(prev => prev.map((p, idx) => idx === i ? { ...p, error: true, uploading: false } : p))
        return null
      }

      setImagenes(prev => prev.map((p, idx) => idx === i ? { ...p, uploadedUrl: publicUrl, uploading: false } : p))
      return publicUrl
    })

    const results = await Promise.all(uploadPromises)
    const urls = results.filter((url): url is string => url !== null)

    // Actualizar progreso
    setUploadProgress(Math.round((urls.length / imagenes.length) * 100))

    return urls
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setModeracionResultado(null)

    if (!isSupabaseConfigured()) {
      setError('Supabase no esta configurado. Agrega las variables de entorno.')
      setLoading(false)
      return
    }

    // MODERACIÓN: verificar contenido antes de publicar
    const textoCompleto = `${titulo} ${descripcion}`
    const resultado = verificarContenido(textoCompleto)
    setModeracionResultado(resultado)

    if (resultado.nivel === 'prohibido') {
      setError(`Tu publicación contiene contenido que viola nuestras normas. No se permite: ${resultado.palabras.join(', ')}. Si crees que es un error, contacta soporte.`)
      setLoading(false)
      return
    }

    // Si es sospechoso, se publica pero marcado como pendiente y se alerta admin
    const estadoModeracion = resultado.nivel === 'sospechoso' ? 'pendiente' : 'aprobado'
    const motivoModeracion = resultado.nivel === 'sospechoso' ? `Contenido sospechoso: ${resultado.palabras.join(', ')}` : null

    try {
      // Upload images first
      let imagenUrl: string | null = null
      let imagenesArray: string[] = []

      if (imagenes.length > 0) {
        setUploadProgress(0)
        imagenesArray = await uploadImages()
        if (imagenesArray.length > 0) {
          imagenUrl = imagenesArray[0] // Use first as cover
        }
      }

      // Get categoria_id
      const { data: catData } = await supabase
        .from('categorias')
        .select('id')
        .eq('nombre', categoria)
        .single()

      // Build metodos_contacto JSON
      const metodosContacto: Record<string, any> = {}
      if (contactEmail) metodosContacto.email = contactEmail
      if (contactPhone) metodosContacto.telefono = contactPhone
      if (contactWhatsApp) metodosContacto.whatsapp = contactWhatsApp
      if (contactMessenger) metodosContacto.messenger = contactMessenger

      // Alerta al admin si contenido sospechoso (envía notificación Telegram)
      if (estadoModeracion === 'pendiente') {
        try {
          const ALERTA_URL = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://marketplacevzla.vercel.app'}`
          await fetch('/api/moderacion-alerta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nivel: 'sospechoso',
              titulo,
              palabras: resultado.palabras,
              userId: user?.id,
              userName: user?.email || 'Desconocido',
            }),
          })
        } catch (e) {
          console.error('No se pudo enviar alerta de moderación:', e)
        }
      }

      // Insert product via API route with rate limiting
      const res = await fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          moderacionAlerta: estadoModeracion === 'pendiente' ? {
            nivel: 'sospechoso', titulo, palabras: resultado.palabras,
            userName: user?.email || 'Desconocido',
          } : undefined,
          user_id: user?.id,
          titulo,
          estado_moderacion: estadoModeracion,
          motivo_moderacion: motivoModeracion,
          descripcion,
          categoria_id: catData?.id || null,
          subcategoria,
          marca: marca.replace('otra:', '').trim() || null,
          estado: estadoProd,
          precio_usd: parseFloat(precioUsd) || null,
          ubicacion_estado: ubicacionEstado,
          ubicacion_ciudad: ubicacionCiudad,
          imagen_url: imagenUrl,
          imagenes: imagenesArray,
          metodos_contacto: Object.keys(metodosContacto).length > 0 ? metodosContacto : null,
          activo: true,
          destacado: false,
        }),
      })
      
      const apiResult = await res.json()
      
      if (res.status === 429) {
        setError(apiResult.error || 'Demasiadas publicaciones. Espera unos minutos.')
        setLoading(false)
        return
      }
      
      if (!res.ok || !apiResult.ok) {
        console.error('API error:', apiResult)
        setError('Error al guardar: ' + (apiResult.error || 'Error desconocido'))
        setLoading(false)
        return
      }
      
      const producto = apiResult.data

      // Check Pack Emprendedor (10+ publicaciones = 5 creditos gratis)
      const { count: pubCount } = await supabase
        .from('productos')
        .select('*', { count: 'exact' })
        .eq('user_id', user?.id)
        .eq('activo', true)
      
      if (pubCount && pubCount >= 10) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('emprendedor_dado, credito_balance')
          .eq('id', user?.id)
          .single()
        
        if (perfil && !perfil.emprendedor_dado) {
          setShowEmprendedor(true)
          setTimeout(() => setShowEmprendedor(false), 6000)
        }
      }

      // EMAIL: notificar que el producto fue publicado
      const nombrePublicador = user?.email?.split('@')[0] || 'Usuario'
      try {
        await emailProductoPublicado(user?.email || '', nombrePublicador, titulo, precioUsd, producto.id)
      } catch (e) {
        console.error('Error email publicación:', e)
      }
      
      router.push(`/inmueble/${producto.id}?nuevo=1`)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Error inesperado, intentalo de nuevo.')
    }

    setLoading(false)
  }

  const canGoToStep2 = categoria && subcategoria
  const canGoToStep3 = titulo && descripcion && estadoProd && precioUsd

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>

      {/* Banner: siempre gratis */}
      <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <span className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <div>
          <p className="text-sm font-bold text-green-800">{t('freeBanner')}</p>
          <p className="text-xs text-green-600">{t('freeBannerDesc')}</p>
        </div>
      </div>

      <p className="text-gray-500 text-sm mb-8">{t('stepsDesc')}</p>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Emprendedor bonus banner */}
      {showEmprendedor && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <h3 className="font-bold text-purple-800 text-lg">{t('entrepreneurTitle')}</h3>
              <p className="text-purple-700 text-sm mt-1" dangerouslySetInnerHTML={{ __html: t('entrepreneurDesc') }}></p>
              <p className="text-purple-600 text-xs mt-0.5">{t('entrepreneurMore')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {[{ num: 1, label: t('stepCategory') }, { num: 2, label: t('stepDetails') }, { num: 3, label: t('stepPhotos') }, { num: 4, label: t('stepReview') }].map(s => (
          <div key={s.num} className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setStep(s.num)} className={`w-10 h-10 rounded-full font-bold text-sm transition ${step >= s.num ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}>{s.num}</button>
            <span className={`text-sm font-medium hidden sm:inline ${step >= s.num ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</span>
            {s.num < 4 && <div className={`w-6 sm:w-8 h-0.5 ${step > s.num ? 'bg-brand-primary' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">

        {/* PASO 1: Categoria → Subcategoria → Marca */}
        {step === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900">{t('whatToPublish')}</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('category')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(categoriasData).map(([key, cfg]) => {
                  let displayLabel = cfg.label
                  try {
                    const translated = tc('categories.' + key)
                    if (translated && translated !== 'categories.' + key) {
                      displayLabel = translated
                    }
                  } catch (e) {}
                  return (
                  <button key={key} onClick={() => handleCatChange(key)} className={`p-4 rounded-xl border-2 text-center transition ${categoria === key ? 'border-brand-primary bg-blue-50' : 'border-gray-200 hover:border-brand-accent'}`}>
                    <span className="text-3xl block mb-2">{cfg.icon}</span>
                    <span className="text-sm font-bold text-gray-800">{displayLabel}</span>
                  </button>
                  )
                })}
              </div>
            </div>

            {cat && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('type')}</label>
                  <select value={subcategoria} onChange={e => handleSubChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-800">
                    <option value="">{t('selectType')}</option>
                    {cat.subs.map(s => {
                      const transKey = subcategoryTranslationKeys[s.label]
                      const displayLabel = transKey ? tc('subcategories.' + transKey) : s.label
                      return <option key={s.label} value={s.label}>{s.icon} {displayLabel}</option>
                    })}
                  </select>
                </div>
                {subcategoria && sub?.marcas.length && sub.marcas.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('brand')}</label>
                    <select value={marca.startsWith('otra:') ? 'otra:' : marca} onChange={e => setMarca(e.target.value === 'otra:' ? '' : e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white">
                      <option value="">{t('selectBrand')}</option>
                      {sub.marcas.map(m => <option key={m} value={m}>{m}</option>)}
                      <option value="otra:">{t('otherBrand')}</option>
                    </select>
                    {marca.startsWith('otra:') && (
                      <input
                        type="text"
                        value={marca.replace('otra:', '')}
                        onChange={e => setMarca('otra:' + e.target.value)}
                        placeholder={t('writeBrand')}
                        className="mt-2 w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white"
                      />
                    )}
                  </div>
                )}
              </>
            )}

            <button onClick={() => setStep(2)} disabled={!canGoToStep2} className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50">{t('next')}</button>
          </div>
        )}

        {/* PASO 2: Detalles */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900">{t('productDetails')}</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('titleField')}</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={t('titlePlaceholder')} maxLength={100} required className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white" />
              <p className="text-xs text-gray-500 mt-1">{titulo.length}/100</p>
            </div>

            {camposEspeciales.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-5 space-y-4 border border-gray-200">
                <h3 className="font-bold text-gray-900">{t('specs')} — {subcategoria}</h3>
                {camposEspeciales.map(campo => {
                  const val = specs[campo.label] || ''
                  const esOtra = val.startsWith('otra:')
                  return (
                  <div key={campo.label}>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">{campo.label}</label>
                    {campo.type === 'select' ? (
                      <>
                        <select value={esOtra ? 'otra:' : val} onChange={e => handleSpecChange(campo.label, e.target.value === 'otra:' ? '' : e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-800">
                          <option value="">{campo.placeholder}</option>
                          {campo.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          {campo.label.toLowerCase().includes('marca') && <option value="otra:">{t('otherBrand')}</option>}
                        </select>
                        {esOtra && (
                          <input
                            type="text"
                            value={val.replace('otra:', '')}
                            onChange={e => handleSpecChange(campo.label, 'otra:' + e.target.value)}
                            placeholder={`Escribe ${campo.label.toLowerCase()}...`}
                            className="mt-2 w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white"
                          />
                        )}
                      </>
                    ) : (
                      <input type={campo.type} value={val} onChange={e => handleSpecChange(campo.label, e.target.value)} placeholder={campo.placeholder} className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white" />
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('description')}</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={5} maxLength={2000} required className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 resize-none bg-white" placeholder={t('descPlaceholder')} />
              <p className="text-xs text-gray-500 mt-1">{descripcion.length}/2000</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('condition')}</label>
              <div className="grid grid-cols-2 gap-2">
                {conditionKeys.map(c => (
                  <button key={c.value} onClick={() => setEstadoProd(c.value)} className={`px-4 py-3 rounded-lg text-sm font-medium border transition ${estadoProd === c.value ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-accent'}`}>{t(c.key)}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('priceUsd')}</label>
              <input type="number" value={precioUsd} onChange={e => setPrecioUsd(e.target.value)} placeholder={t('pricePlaceholder')} min="0" step="0.01" required className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 bg-white" />
              <p className="text-xs text-gray-500 mt-1">{t('priceNote')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('state')}</label>
                <select value={ubicacionEstado} onChange={e => setUbicacionEstado(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-3 bg-white text-gray-800">
                  <option value="">{t('statePlaceholder')}</option>
                  {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t('municipality')}</label>
                <select value={ubicacionCiudad} onChange={e => setUbicacionCiudad(e.target.value)} required disabled={!ubicacionEstado} className="w-full border border-gray-300 rounded-lg px-3 py-3 bg-white text-gray-800">
                  <option value="">{t('municipalityPlaceholder')}</option>
                  {(ubicacionEstado ? getMunicipiosNombres(ubicacionEstado) : []).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Metodos de contacto por publicacion */}
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <MapPin size={18} />
                {t('contactTitle')}
              </h3>
              <p className="text-xs text-gray-500">{t('contactDesc')}</p>

              <div className="space-y-3">
                {/* WhatsApp */}
                <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3">
                  <input type="checkbox" id="useWhatsApp" checked={!!contactWhatsApp} onChange={e => setContactWhatsApp(e.target.checked ? '+' : '')} className="mt-1 rounded text-brand-primary" />
                  <label htmlFor="useWhatsApp" className="flex-1">
                    <span className="text-sm font-medium flex items-center gap-1.5">💚 WhatsApp</span>
                    {contactWhatsApp && <input type="tel" value={contactWhatsApp} onChange={e => setContactWhatsApp(e.target.value)} placeholder="+58 412 1234567" className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />}
                  </label>
                </div>

                {/* Telefono */}
                <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3">
                  <input type="checkbox" id="usePhone" checked={!!contactPhone} onChange={e => setContactPhone(e.target.checked ? '+' : '')} className="mt-1 rounded text-brand-primary" />
                  <label htmlFor="usePhone" className="flex-1">
                    <span className="text-sm font-medium flex items-center gap-1.5"><Phone size={14} /> {t('calls')}</span>
                    {contactPhone && <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+58 412 1234567" className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />}
                  </label>
                </div>

                {/* Email */}
                <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3">
                  <input type="checkbox" id="useEmail" checked={!!contactEmail} onChange={e => setContactEmail(e.target.checked ? '+' : '')} className="mt-1 rounded text-brand-primary" />
                  <label htmlFor="useEmail" className="flex-1">
                    <span className="text-sm font-medium flex items-center gap-1.5"><Mail size={14} /> Email</span>
                    {contactEmail && <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="tu@email.com" className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />}
                  </label>
                </div>

                {/* Messenger */}
                <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3">
                  <input type="checkbox" id="useMessenger" checked={!!contactMessenger} onChange={e => setContactMessenger(e.target.checked ? '+' : '')} className="mt-1 rounded text-brand-primary" />
                  <label htmlFor="useMessenger" className="flex-1">
                    <span className="text-sm font-medium flex items-center gap-1.5"><MessageSquare size={14} /> Facebook Messenger</span>
                    {contactMessenger && <input type="url" value={contactMessenger} onChange={e => setContactMessenger(e.target.value)} placeholder="https://m.me/tuusuario" className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />}
                  </label>
                </div>
              </div>

              {/* Chat interno siempre activo */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MessageSquare size={12} />
                <span>{t('chatAuto')}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-lg font-medium border border-gray-200 hover:bg-gray-50">{t('back')}</button>
              <button onClick={() => setStep(3)} disabled={!canGoToStep3} className="flex-1 bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition disabled:opacity-50">{t('next')}</button>
            </div>
          </div>
        )}

        {/* PASO 3: Fotos */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900">{t('addPhotos')}</h2>
            <p className="text-sm text-gray-500">{t('photosDesc')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {imagenes.map((img, i) => (
                <div key={i} className="aspect-square relative rounded-lg overflow-hidden group border border-gray-200">
                  <Image src={img.preview} alt="" className="w-full h-full object-cover" fill sizes="100px" unoptimized />
                  {i === 0 && img.uploadedUrl && <span className="absolute top-1 left-1 bg-brand-accent text-brand-primary text-[10px] font-bold px-1.5 py-0.5 rounded">{t('cover')}</span>}
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                      <X size={20} className="text-white" />
                    </div>
                  )}
                  {!img.uploading && (
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {imagenes.length < 10 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-accent hover:bg-yellow-50 transition">
                  <Camera size={24} className="text-gray-400" /><span className="text-xs text-gray-500 mt-1">{t('add')}</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Moderación feedback */}
            {moderacionResultado && moderacionResultado.nivel === 'sospechoso' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-fadeIn">
                <div className="flex gap-2">
                  <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">{t('moderationReview')}</p>
                    <p className="text-xs text-yellow-600 mt-1">{t('moderationDesc')}</p>
                  </div>
                </div>
              </div>
            )}

            {loading && imagenes.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">{t('uploading')} {uploadProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-brand-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-lg font-medium border border-gray-200 hover:bg-gray-50">{t('back')}</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition">{t('stepReview')}</button>
            </div>
          </div>
        )}

        {/* PASO 4: Revisar */}
        {step === 4 && (
          <div className="space-y-5 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900">{t('reviewTitle')}</h2>
            <div className="border rounded-lg p-5 space-y-3">
              {imagenes.length > 0 && <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden"><Image src={imagenes[0].preview} alt="" className="w-full h-full object-cover" fill sizes="300px" unoptimized /></div>}
              <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-500">{t('category')}:</span> {categoria} → {subcategoria}</p>
                {marca && <p><span className="text-gray-500">{t('brand')}:</span> {marca.replace('otra:', '').trim()}</p>}
                {Object.entries(specs).filter(([,v]) => v).map(([k,v]) => <p key={k}><span className="text-gray-500">{k}:</span> {v}</p>)}
                <p><span className="text-gray-500">{t('condition')}:</span> {estadoProd}</p>
                <p><span className="text-gray-500">{t('priceUsd')}:</span> <strong className="text-brand-primary text-lg">${precioUsd}</strong></p>
                <p><span className="text-gray-500">{t('location')}:</span> {ubicacionCiudad}, {ubicacionEstado}</p>
              </div>

              {/* Metodos contacto resumen */}
              {(contactEmail || contactPhone || contactWhatsApp || contactMessenger) && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{t('contactMethods')}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {contactEmail && <span className="bg-white px-2 py-1 rounded border">📧 {contactEmail}</span>}
                    {contactPhone && <span className="bg-white px-2 py-1 rounded border">📞 {contactPhone}</span>}
                    {contactWhatsApp && <span className="bg-white px-2 py-1 rounded border">💚 WhatsApp</span>}
                    {contactMessenger && <span className="bg-white px-2 py-1 rounded border">👤 Messenger</span>}
                    <span className="bg-white px-2 py-1 rounded border">{t('internalChat')}</span>
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-600"><strong>{t('description')}:</strong></p><p className="text-sm text-gray-700 mt-1">{descripcion}</p></div>
            </div>

            {moderacionResultado && moderacionResultado.nivel === 'sospechoso' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-fadeIn">
                <div className="flex gap-2">
                  <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">{t('moderationReview')}</p>
                    <p className="text-xs text-yellow-600 mt-1">{t('moderationDesc')}</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-fadeIn">
                <div className="flex gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Progreso Emprendedor */}
            {pubCount > 0 && pubCount < 10 && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-purple-800">{t('entrepreneurProgress', { count: pubCount })}</span>
                  <span className="text-purple-600">{t('entrepreneurRemaining', { remaining: 10 - pubCount })}</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${(pubCount / 10) * 100}%` }} />
                </div>
              </div>
            )}
            {pubCount >= 10 && !showEmprendedor && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4 flex items-center gap-2">
                <span className="text-sm font-semibold text-green-800">{t('entrepreneurUnlocked')}</span>
              </div>
            )}

            {loading && (
              <div>
                <p className="text-sm text-gray-500 mb-2">{t('publishing')} {uploadProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-brand-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="px-6 py-3 rounded-lg font-medium border border-gray-200 hover:bg-gray-50">{t('edit')}</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-brand-accent text-brand-primary py-3 rounded-lg font-bold hover:bg-accent/90 transition disabled:opacity-50">{loading ? t('publishing') : t('publishFree')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
