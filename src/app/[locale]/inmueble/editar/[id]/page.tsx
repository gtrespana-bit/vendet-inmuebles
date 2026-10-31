'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { useAuth } from '@/components/AuthProvider'
import LocalLink from '@/components/LocalLink'
import LocationPicker from '@/components/map/LocationPicker'
import { ESTADOS, getMunicipiosNombres } from '@/lib/ubicaciones'
import { resolveListingGeo } from '@/lib/geo/venezuela'
import { compressImage } from '@/lib/image-compress'

/** Misma lista de amenidades que el formulario de publicación */
const AMENIDADES = [
  'Gas doméstico',
  'Aire acondicionado',
  'Ventiladores',
  'Generador eléctrico',
  'Piscina',
  'Ascensor',
  'Jardín',
  'Balcón o terraza',
  'Cisterna',
  'Seguridad 24 horas',
] as const
import { useTranslations } from 'next-intl'
import {
  ArrowLeft, Save, Loader2, Camera, X, MapPin, Sparkles,
  ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react'

const CONDICIONES = [
  { value: 'Nuevo', key: 'conditionNew' },
  { value: 'Usado - buen estado', key: 'conditionGood' },
  { value: 'Para remodelar', key: 'conditionRenovate' },
  { value: 'nueva', key: 'conditionNew' },
  { value: 'como_nueva', key: 'conditionLikeNew' },
  { value: 'buen_estado', key: 'conditionGood' },
  { value: 'remodelar', key: 'conditionRenovate' },
] as const

const TIPO_KEYS: Record<string, string> = {
  casa: 'typeHouse', apartamento: 'typeApartment', townhouse: 'typeTownhouse',
  terreno: 'typeLand', 'local-comercial': 'typeCommercial', oficina: 'typeOffice',
  galpon: 'typeWarehouse', habitacion: 'typeRoom', finca: 'typeFarm', edificio: 'typeBuilding',
}
const ELECTRICIDAD = ['110v', '220v', 'ambas'] as const
const AGUA = ['24h', 'intermitente'] as const

interface ImagenEdit {
  id?: string
  url: string
  uploading?: boolean
  error?: boolean
}

interface TipoRow { id: number; slug: string; nombre: string }

export default function EditarInmueblePage({ params }: { params: { locale: string; id: string } }) {
  const { locale, id: propertyId } = params as { locale: string; id: string }
  const router = useRouter()
  const t = useTranslations('editListing')
  const tp = useTranslations('publishProperty')
  const { user, loading: authLoading } = useAuth()
  const idioma = locale === 'en' ? 'en' : 'es'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [exito, setExito] = useState(false)
  const [noExiste, setNoExiste] = useState(false)

  // Datos del formulario
  const [titulo, setTitulo] = useState('')
  const [precio, setPrecio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [areaConstruida, setAreaConstruida] = useState('')
  const [areaTerreno, setAreaTerreno] = useState('')
  const [puestos, setPuestos] = useState('')
  const [condicion, setCondicion] = useState('')
  const [electricidad, setElectricidad] = useState('')
  const [agua, setAgua] = useState('')
  const [caracteristicas, setCaracteristicas] = useState<string[]>([])
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  const [tipos, setTipos] = useState<TipoRow[]>([])
  const [imagenes, setImagenes] = useState<ImagenEdit[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragIndexRef = useRef<number | null>(null)

  const cargarTipos = useCallback(async () => {
    const { data } = await supabase.from('tipos_inmueble').select('id, slug, nombre').order('id')
    setTipos((data as TipoRow[]) || [])
  }, [])

  useEffect(() => { cargarTipos() }, [cargarTipos])

  // Cargar el inmueble
  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    let cancelado = false

    const cargar = async () => {
      const { data, error: loadError } = await supabase
        .from('inmuebles')
        .select(`
          id, usuario_id, titulo, precio, descripcion, ciudad, estado,
          area_construida, area_total, puestos_estacionamiento,
          condicion, latitud, longitud,
          tipo:tipo_id ( slug ),
          inmueble_imagenes ( id, url_imagen, orden ),
          inmueble_caracteristicas ( caracteristicas ( nombre ) )
        `)
        .eq('id', propertyId)
        .maybeSingle()

      if (cancelado) return
      if (loadError) {
        console.error('Error cargando inmueble:', loadError)
        setLoadFailed(true)
        setLoading(false)
        return
      }
      if (!data || data.usuario_id !== user.id) {
        setNoExiste(true)
        setLoading(false)
        return
      }

      setTitulo(data.titulo || '')
      setPrecio(data.precio != null ? String(data.precio) : '')
      setDescripcion(data.descripcion || '')
      setTipo((data.tipo as { slug?: string } | null)?.slug || '')
      setEstado(data.estado || '')
      setCiudad(data.ciudad || '')
      setAreaConstruida(data.area_construida != null ? String(data.area_construida) : '')
      setAreaTerreno(data.area_total != null ? String(data.area_total) : '')
      setPuestos(data.puestos_estacionamiento != null ? String(data.puestos_estacionamiento) : '')
      setCondicion(data.condicion || '')
      setLat(data.latitud != null ? Number(data.latitud) : null)
      setLng(data.longitud != null ? Number(data.longitud) : null)

      const imgs = [...((data.inmueble_imagenes as Array<{ id: string; url_imagen: string; orden: number }>) || [])]
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        .map((img) => ({ id: img.id, url: img.url_imagen }))
      setImagenes(imgs)

      const cars = ((data.inmueble_caracteristicas as Array<{ caracteristicas: { nombre: string } | null }>) || [])
        .map((r) => r.caracteristicas?.nombre)
        .filter(Boolean) as string[]
      // Older catalogue entries may differ in casing; keep unknown features intact.
      const knownNames = [...AMENIDADES, 'Electricidad 110V', 'Electricidad 220V', 'Agua 24 horas', 'Agua intermitente', 'Amueblado', 'Amueblado parcialmente']
      const canonicalCars = cars.map((name) => knownNames.find((known) => known.toLocaleLowerCase('es') === name.trim().toLocaleLowerCase('es')) || name)
      const has110 = canonicalCars.includes('Electricidad 110V')
      const has220 = canonicalCars.includes('Electricidad 220V')
      setElectricidad(has110 && has220 ? 'ambas' : has110 ? '110v' : has220 ? '220v' : '')
      setAgua(canonicalCars.includes('Agua 24 horas') ? '24h' : canonicalCars.includes('Agua intermitente') ? 'intermitente' : '')
      setCaracteristicas(canonicalCars.filter((c) => !['Electricidad 110V', 'Electricidad 220V', 'Agua 24 horas', 'Agua intermitente'].includes(c)))

      setLoading(false)
    }

    cargar()
    return () => { cancelado = true }
  }, [user, authLoading, propertyId])

  // Guardar
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !precio || !descripcion.trim()) {
      setError(tp('requiredError'))
      return
    }
    const subiendo = imagenes.some((img) => img.uploading)
    if (subiendo || imagenes.some((img) => img.error)) {
      setError(t('photoUploadPending'))
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/properties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({
          id: propertyId,
          titulo,
          descripcion,
          precio: Number(precio),
          tipo,
          estado,
          ciudad,
          area_construida: areaConstruida ? Number(areaConstruida) : null,
          area_total: areaTerreno ? Number(areaTerreno) : null,
          puestos_estacionamiento: puestos ? Number(puestos) : null,
          condicion,
          latitud: lat,
          longitud: lng,
          caracteristicas: [
            ...caracteristicas,
            ...(electricidad === '110v' || electricidad === 'ambas' ? ['Electricidad 110V'] : []),
            ...(electricidad === '220v' || electricidad === 'ambas' ? ['Electricidad 220V'] : []),
            ...(agua === '24h' ? ['Agua 24 horas'] : agua === 'intermitente' ? ['Agua intermitente'] : []),
          ],
          imagenes: imagenes.map((img) => ({ id: img.id, url: img.url })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error')
      }

      setExito(true)
      setTimeout(() => router.push(`/${locale}/inmueble/${propertyId}`), 900)
    } catch (err) {
      console.error('Error guardando edición:', err)
      setError(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  // Fotos: añadir (subida inmediata al servidor)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    for (const file of files) {
      if (imagenes.length >= 20) break
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError(tp('fileTypeError'))
        continue
      }
      if (file.size > 8 * 1024 * 1024) {
        setError(tp('fileTypeError'))
        continue
      }

      const preview = URL.createObjectURL(file)
      setImagenes((prev) => [...prev, { url: preview, uploading: true }])

      try {
        const key = `${user?.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${file.name.split('.').pop() || 'jpg'}`
        // Comprimir en cliente: Vercel rechaza con 413 los bodies > 4.5 MB
        const fileToUpload = await compressImage(file)
        const formData = new FormData()
        formData.append('key', key)
        formData.append('file', fileToUpload)

        const res = await fetch('/api/r2-upload', {
          method: 'POST',
          headers: await getSupabaseAuthHeaders(),
          body: formData,
        })
        if (!res.ok) {
          const detail = await res.json().catch(() => null)
          throw new Error(res.status === 413 ? 'too-large' : (detail?.error || 'upload failed'))
        }
        const { publicUrl } = await res.json()

        setImagenes((prev) => prev.map((img) =>
          img.url === preview ? { url: publicUrl } : img
        ))
      } catch {
        setImagenes((prev) =>
          prev.filter((img) => img.url !== preview).concat([{ url: preview, error: true }])
        )
      }
    }
  }

  const removeImage = (index: number) => {
    setImagenes((prev) => prev.filter((_, i) => i !== index))
  }

  // Reordenar: la primera es la portada
  const moveImage = (index: number, dir: -1 | 1) => {
    setImagenes((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  const handleDragStart = (index: number) => { dragIndexRef.current = index }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = (index: number) => {
    const from = dragIndexRef.current
    dragIndexRef.current = null
    if (from === null || from === index) return
    setImagenes((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(index, 0, moved)
      return next
    })
  }

  const toggleCaracteristica = (valor: string) => {
    setCaracteristicas((prev) =>
      prev.includes(valor) ? prev.filter((v) => v !== valor) : prev.length < 25 ? [...prev, valor] : prev
    )
  }

  const mejorarDescripcion = async () => {
    if (descripcion.trim().length < 10) {
      setAiError(tp('aiTooShort'))
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/ai/mejorar-descripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({
          descripcion,
          tipo: tipo || undefined,
          precio: precio ? Number(precio) : undefined,
          ciudad: ciudad || undefined,
          estado: estado || undefined,
        }),
      })
      if (res.status === 503) {
        setAiError(tp('aiUnavailable'))
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setAiError(data.error || tp('aiError'))
        return
      }
      const data = await res.json()
      setDescripcion(data.descripcion)
    } catch {
      setAiError(tp('aiError'))
    } finally {
      setAiLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  if (noExiste || !user || loadFailed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle size={40} className="mx-auto text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{loadFailed ? t('loadError') : t('notFound')}</h1>
        <LocalLink href={`/${locale}/dashboard`} className="inline-block mt-4 text-brand-primary font-semibold">
          {t('goDashboard')}
        </LocalLink>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <LocalLink
          href={`/${locale}/dashboard`}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label={t('goDashboard')}
        >
          <ArrowLeft size={20} />
        </LocalLink>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      {exito && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium">
          ✅ {t('saved')} — {t('redirecting')}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={guardar} className="space-y-8 listing-form">
        {/* Fotos */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{tp('sectionPhotos')}</h2>
          {imagenes.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
              {imagenes.map((img, index) => (
                <div
                  key={img.id || img.url}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-grab active:cursor-grabbing"
                  draggable={!img.uploading}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                >
                  <Image src={img.url} alt="" fill sizes="120px" unoptimized className="object-cover" />
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 bg-brand-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-10">
                      {tp('coverPhoto')}
                    </span>
                  )}
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center text-white text-xs font-bold">
                      ✕
                    </div>
                  )}
                  {!img.uploading && (
                    <>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label={tp('removeImage')}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X size={14} />
                      </button>
                      <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          type="button"
                          onClick={() => moveImage(index, -1)}
                          disabled={index === 0}
                          aria-label={tp('moveEarlier')}
                          className="bg-black/60 text-white rounded p-1 disabled:opacity-30 hover:bg-black/80"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 1)}
                          disabled={index === imagenes.length - 1}
                          aria-label={tp('moveLater')}
                          className="bg-black/60 text-white rounded p-1 disabled:opacity-30 hover:bg-black/80"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {imagenes.length > 1 && (
            <p className="text-xs text-gray-500 mb-3">{tp('reorderHint')}</p>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full listing-upload p-6 rounded-xl border-2 border-dashed text-sm font-medium flex flex-col items-center gap-2"
          >
            <Camera size={24} />
            {tp('uploadPrompt')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </section>

        {/* Datos básicos */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{tp('sectionBasics')}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tp('titleField')}</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={150}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('propertyType')}</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
              >
                {tipos.map((tRow) => (
                  <option key={tRow.id} value={tRow.slug}>
                    {TIPO_KEYS[tRow.slug] ? tp(TIPO_KEYS[tRow.slug]) : tRow.nombre || tRow.slug}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('price')}</label>
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                min={0}
                className="w-full px-4 py-3 rounded-xl border border-gray-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('builtArea')}</label>
              <input
                type="number"
                value={areaConstruida}
                onChange={(e) => setAreaConstruida(e.target.value)}
                min={0}
                placeholder="m²"
                className="w-full px-4 py-3 rounded-xl border border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('landArea')}</label>
              <input
                type="number"
                value={areaTerreno}
                onChange={(e) => setAreaTerreno(e.target.value)}
                min={0}
                placeholder="m²"
                className="w-full px-4 py-3 rounded-xl border border-gray-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('parking')}</label>
              <select value={puestos} onChange={(e) => setPuestos(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white">
                <option value="">{t('parkingNone')}</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('condition')}</label>
              <select value={condicion} onChange={(e) => setCondicion(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white">
                <option value="">{tp('selectOptional')}</option>
                {condicion && !CONDICIONES.some((c) => c.value === condicion) && <option value={condicion}>{condicion}</option>}
                {CONDICIONES.filter((c) => !['nueva', 'como_nueva', 'buen_estado', 'remodelar'].includes(c.value) || c.value === condicion).map((c) => (
                  <option key={c.value} value={c.value}>{c.key === 'conditionLikeNew' ? t('conditionLikeNew') : tp(c.key)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('electricity')}</label>
              <select value={electricidad} onChange={(e) => setElectricidad(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white">
                <option value="">{tp('selectOptional')}</option>
                <option value="110v">{tp('power110')}</option>
                <option value="220v">{tp('power220')}</option>
                <option value="ambas">{tp('powerBoth')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('waterLabel')}</label>
              <select value={agua} onChange={(e) => setAgua(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white">
                <option value="">{tp('selectOptional')}</option>
                <option value="24h">{tp('water24h')}</option>
                <option value="intermitente">{t('waterIntermitente')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('furnished')}</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { value: '', label: tp('furnishedNone') },
                  { value: 'Amueblado parcialmente', label: tp('furnishedPartial') },
                  { value: 'Amueblado', label: tp('furnishedFull') },
                ].map((option) => {
                  const selected = option.value ? caracteristicas.includes(option.value) : !caracteristicas.includes('Amueblado') && !caracteristicas.includes('Amueblado parcialmente')
                  return (
                    <button key={option.value} type="button" aria-pressed={selected}
                      onClick={() => setCaracteristicas((prev) => [
                        ...prev.filter((v) => v !== 'Amueblado' && v !== 'Amueblado parcialmente'),
                        ...(option.value ? [option.value] : []),
                      ])}
                      className={`px-4 py-2 rounded-lg text-sm border-2 ${selected ? 'border-brand-primary bg-brand-primary/10 font-semibold' : 'border-gray-200'}`}>
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Ubicación */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{tp('sectionLocation')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('state')}</label>
              <select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value)
                  setCiudad('')
                  setLat(null)
                  setLng(null)
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
              >
                <option value="">{tp('selectState')}</option>
                {ESTADOS.map((e2) => (
                  <option key={e2} value={e2}>{e2}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{tp('city')}</label>
              <select
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                disabled={!estado}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white disabled:bg-gray-50"
              >
                <option value="">{estado ? tp('selectCity') : t('selectEstadoFirst')}</option>
                {getMunicipiosNombres(estado).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={14} />
            {lat != null && lng != null ? tp('mapPinSet') : tp('mapHint')}
          </div>
          <LocationPicker
            value={lat != null && lng != null ? { lat, lng } : null}
            center={(() => {
              const geo = resolveListingGeo({ ciudad, estado })
              return geo.point ?? { lat: 8.6, lng: -66.2 }
            })()}
            onChange={(p) => { setLat(p?.lat ?? null); setLng(p?.lng ?? null) }}
            labels={{
              approximate: tp('mapApproximate'),
              exact: tp('mapExact'),
              viewListing: '',
              bedrooms: '',
              bathrooms: '',
              area: '',
              empty: '',
              zoomIn: '',
              zoomOut: '',
              resetView: '',
            }}
            hint={tp('mapHint')}
            clearLabel={tp('mapClear')}
            emptyLabel={tp('mapEmpty')}
            placeLabel={tp('mapPlace')}
          />
        </section>

        {/* Descripción */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{tp('description')}</h2>
            <button
              type="button"
              onClick={mejorarDescripcion}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:text-brand-primary disabled:opacity-50 px-3 py-1.5 rounded-lg border border-brand-accent/40 hover:bg-brand-accent/5"
            >
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {tp('aiImprove')}
            </button>
          </div>
          {aiError && <p className="text-xs text-red-600">{aiError}</p>}
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={6}
            maxLength={6000}
            placeholder={tp('descriptionPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-primary/40 outline-none resize-y"
          />
        </section>

        {/* Características */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{tp('amenities')}</h2>
          <p className="text-xs text-gray-500 mb-3">{t('amenitiesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {AMENIDADES.map((valor) => {
              const activo = caracteristicas.includes(valor)
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => toggleCaracteristica(valor)}
                  className={`px-3 py-1.5 rounded-full text-sm border-2 transition-colors ${
                    activo ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {valor}
                </button>
              )
            })}
          </div>
        </section>

        {/* Acciones */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <LocalLink
            href={`/${locale}/inmueble/${propertyId}`}
            className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
          >
            {t('cancel')}
          </LocalLink>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-semibold hover:bg-brand-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  )
}
