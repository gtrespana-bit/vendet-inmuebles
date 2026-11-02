'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Award, Check, Clock3, Copy, ExternalLink, Globe, Languages, Sparkles } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { normalizeStorefrontSlug } from '@/lib/storefront-slug'

interface StorefrontSettingsCardProps {
  userId: string
  onToast?: (msg: string | null) => void
}

const LANGUAGE_OPTIONS = [
  { code: 'es', es: 'Español', en: 'Spanish' },
  { code: 'en', es: 'Inglés', en: 'English' },
  { code: 'pt', es: 'Portugués', en: 'Portuguese' },
  { code: 'it', es: 'Italiano', en: 'Italian' },
  { code: 'zh', es: 'Chino', en: 'Chinese' },
]

export default function StorefrontSettingsCard({ userId, onToast }: StorefrontSettingsCardProps) {
  const en = useLocale() === 'en'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canCustomizeSlug, setCanCustomizeSlug] = useState(false)
  const [slug, setSlug] = useState('')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [descripcionAgente, setDescripcionAgente] = useState('')
  const [licenciaCorredor, setLicenciaCorredor] = useState('')
  const [anosExperiencia, setAnosExperiencia] = useState<string>('')
  const [horarioAtencion, setHorarioAtencion] = useState('')
  const [idiomas, setIdiomas] = useState<string[]>(['es'])
  const [zonasInput, setZonasInput] = useState('')
  const [instagram, setInstagram] = useState('')
  const [sitioWeb, setSitioWeb] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const headers = await getSupabaseAuthHeaders()
        const res = await fetch('/api/perfil/escaparate', { headers })
        if (!res.ok) return
        const data = await res.json()
        if (!active) return
        setSlug(data.slug || '')
        setSavedSlug(data.slug || null)
        setEmpresaNombre(data.empresa_nombre || '')
        setDescripcionAgente(data.descripcion_agente || '')
        setLicenciaCorredor(data.licencia_corredor || '')
        setAnosExperiencia(
          data.anos_experiencia !== null && data.anos_experiencia !== undefined
            ? String(data.anos_experiencia)
            : '',
        )
        setHorarioAtencion(data.horario_atencion || '')
        setIdiomas(Array.isArray(data.idiomas) && data.idiomas.length > 0 ? data.idiomas : ['es'])
        setZonasInput(Array.isArray(data.zonas_especialidad) ? data.zonas_especialidad.join(', ') : '')
        setInstagram(data.redes_sociales?.instagram || '')
        setSitioWeb(data.redes_sociales?.web || '')
        setCanCustomizeSlug(Boolean(data.canCustomizeSlug))
      } catch {
        // Ignorar fallo silencioso en carga secundaria
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const publicIdentifier = savedSlug || userId
  const publicPath = `/vendedor/${publicIdentifier}`
  const previewSlug = normalizeStorefrontSlug(slug) || userId

  function toggleIdioma(code: string) {
    setIdiomas((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code)
        return next.length > 0 ? next : ['es']
      }
      return [...prev, code]
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const authHeaders = await getSupabaseAuthHeaders()
      const zonasArray = zonasInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
        .slice(0, 8)

      const res = await fetch('/api/perfil/escaparate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          slug: canCustomizeSlug ? slug : '',
          empresa_nombre: empresaNombre,
          descripcion_agente: descripcionAgente,
          licencia_corredor: licenciaCorredor,
          anos_experiencia: anosExperiencia === '' ? null : Number(anosExperiencia),
          horario_atencion: horarioAtencion,
          idiomas,
          zonas_especialidad: zonasArray,
          redes_sociales: {
            instagram,
            web: sitioWeb,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || (en ? 'Could not save storefront settings.' : 'No se pudo guardar el escaparate.'))
        return
      }
      setSavedSlug(data.slug || null)
      setSlug(data.slug || '')
      onToast?.(en ? 'Public storefront updated' : 'Escaparate profesional actualizado')
      window.setTimeout(() => onToast?.(null), 3500)
    } catch {
      setError(en ? 'Connection error while saving.' : 'Error de conexión al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function copyUrl() {
    if (typeof window === 'undefined') return
    const fullUrl = `${window.location.origin}${en ? '/en' : ''}${publicPath}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard no disponible
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Globe size={18} className="text-brand-primary" aria-hidden="true" />
            {en ? 'Pro Storefront & Advisor Credentials' : 'Escaparate Pro y Credenciales Inmobiliarias'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {en
              ? 'Customize your public storefront, vanity URL, areas of expertise, languages, and license.'
              : 'Personaliza tu escaparate público, enlace propio, zonas de especialidad, idiomas y afiliación profesional.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? (en ? 'Copied' : 'Copiado') : (en ? 'Copy link' : 'Copiar enlace')}
          </button>
          <LocalLink
            href={publicPath}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800"
          >
            {en ? 'Open storefront' : 'Ver escaparate'} <ExternalLink size={13} />
          </LocalLink>
        </div>
      </div>

      {!loading && (
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="storefront-slug" className="block text-sm font-medium text-gray-700 mb-1">
              {en ? 'Custom storefront URL' : 'Enlace personalizado del escaparate'}
            </label>
            {canCustomizeSlug ? (
              <>
                <div className="flex items-center rounded-lg border border-gray-300 bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-brand-primary">
                  <span className="px-3 py-2 text-xs sm:text-sm text-gray-500 select-none border-r border-gray-200">
                    venezuela-inmuebles.online/vendedor/
                  </span>
                  <input
                    id="storefront-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder={en ? 'your-agency-name' : 'tu-agencia-o-marca'}
                    maxLength={50}
                    className="flex-1 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {en ? 'Preview:' : 'Vista previa:'}{' '}
                  <code className="text-gray-700">/vendedor/{previewSlug}</code>
                </p>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50/70 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                <span className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-600 shrink-0" aria-hidden="true" />
                  {en
                    ? 'Custom vanity URLs (/vendedor/your-brand) are included in Professional and Agency plans.'
                    : 'El enlace propio (/vendedor/tu-marca) está incluido en los planes Profesional e Inmobiliaria.'}
                </span>
                <LocalLink href="/planes" className="font-bold underline hover:no-underline">
                  {en ? 'View plans' : 'Ver planes'}
                </LocalLink>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="storefront-empresa" className="block text-sm font-medium text-gray-700 mb-1">
                {en ? 'Agency or commercial brand' : 'Inmobiliaria o marca comercial'}
              </label>
              <input
                id="storefront-empresa"
                type="text"
                value={empresaNombre}
                onChange={(e) => setEmpresaNombre(e.target.value)}
                maxLength={80}
                placeholder={en ? 'e.g. Avila Realty Group' : 'Ej. Inmobiliaria Ávila'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label htmlFor="storefront-licencia" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Award size={14} className="text-[#8C6526]" />
                <span>{en ? 'Chamber / Broker license (optional)' : 'Cámara Inmobiliaria / Certificación (opcional)'}</span>
              </label>
              <input
                id="storefront-licencia"
                type="text"
                value={licenciaCorredor}
                onChange={(e) => setLicenciaCorredor(e.target.value)}
                maxLength={80}
                placeholder={en ? 'e.g. CIV #1420 / Certified Advisor' : 'Ej. Afiliado Cámara Inmobiliaria #1420'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="storefront-bio" className="block text-sm font-medium text-gray-700 mb-1">
              {en ? 'Professional bio' : 'Presentación profesional'}
            </label>
            <textarea
              id="storefront-bio"
              rows={2}
              value={descripcionAgente}
              onChange={(e) => setDescripcionAgente(e.target.value)}
              maxLength={500}
              placeholder={
                en
                  ? 'Residential & commercial specialist in Caracas, Valencia and San Diego…'
                  : 'Especialistas en compra, venta y alquiler residencial y comercial con asesoría legal SAREN…'
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="storefront-exp" className="block text-sm font-medium text-gray-700 mb-1">
                {en ? 'Years of experience' : 'Años de experiencia'}
              </label>
              <input
                id="storefront-exp"
                type="number"
                min={0}
                max={80}
                value={anosExperiencia}
                onChange={(e) => setAnosExperiencia(e.target.value)}
                placeholder="Ej. 8"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="storefront-horario" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Clock3 size={14} className="text-gray-500" />
                <span>{en ? 'Business hours' : 'Horario de atención'}</span>
              </label>
              <input
                id="storefront-horario"
                type="text"
                value={horarioAtencion}
                onChange={(e) => setHorarioAtencion(e.target.value)}
                maxLength={120}
                placeholder={en ? 'Mon–Sat 8:30 am – 6:00 pm' : 'Lun a Sáb · 8:30 am a 6:00 pm'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="storefront-zonas" className="block text-sm font-medium text-gray-700 mb-1">
                {en ? 'Specialty zones (comma-separated)' : 'Zonas de especialidad (separadas por coma)'}
              </label>
              <input
                id="storefront-zonas"
                type="text"
                value={zonasInput}
                onChange={(e) => setZonasInput(e.target.value)}
                placeholder={en ? 'Chacao, Las Mercedes, San Diego, El Parral' : 'Las Mercedes, Chacao, El Parral, San Diego'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Languages size={14} className="text-gray-500" />
                <span>{en ? 'Spoken languages' : 'Idiomas de atención'}</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = idiomas.includes(lang.code)
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleIdioma(lang.code)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                        active
                          ? 'bg-[#16294B] text-white border-[#16294B]'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {en ? lang.en : lang.es}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="storefront-ig" className="block text-sm font-medium text-gray-700 mb-1">
                Instagram (opcional)
              </label>
              <input
                id="storefront-ig"
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@tuinmobiliaria"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label htmlFor="storefront-web" className="block text-sm font-medium text-gray-700 mb-1">
                {en ? 'Official website (optional)' : 'Sitio web corporativo (opcional)'}
              </label>
              <input
                id="storefront-web"
                type="url"
                value={sitioWeb}
                onChange={(e) => setSitioWeb(e.target.value)}
                placeholder="https://tuinmobiliaria.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50 transition"
            >
              {saving
                ? (en ? 'Saving…' : 'Guardando…')
                : (en ? 'Save storefront' : 'Guardar escaparate')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
