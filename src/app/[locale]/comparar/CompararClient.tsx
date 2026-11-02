'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  CalendarCheck,
  Check,
  Copy,
  Landmark,
  Minus,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { usePropertyCompare } from '@/hooks/usePropertyCompare'
import { isOptimizableImageSrc } from '@/lib/image-src'
import { localizePath } from '@/lib/auth-redirect'
import { calculatePricePerM2 } from '@/lib/urbanizaciones'
import {
  computeComparisonHighlights,
  type ComparableProperty,
} from '@/lib/property-compare'

interface CompararClientProps {
  locale: 'es' | 'en'
  requestedIds: string[]
  initialItems: ComparableProperty[]
}

export default function CompararClient({
  locale,
  requestedIds,
  initialItems,
}: CompararClientProps) {
  const router = useRouter()
  const isEn = locale === 'en'
  const numLocale = isEn ? 'en-US' : 'es-VE'
  const { items: storedItems, remove, clear } = usePropertyCompare()
  const [copied, setCopied] = useState(false)
  const [bcvRate, setBcvRate] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tasa-bcv')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const rate = Number(d.tasa ?? d.promedio ?? d.usd ?? 0)
        if (Number.isFinite(rate) && rate > 0) setBcvRate(rate)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // Si el usuario entra a `/comparar` sin `?ids=...`, cargar desde su selección local
  useEffect(() => {
    if (requestedIds.length === 0 && storedItems.length > 0) {
      const idsParam = storedItems.map((i) => i.id).join(',')
      router.replace(localizePath(`/comparar?ids=${encodeURIComponent(idsParam)}`, locale))
    }
  }, [requestedIds.length, storedItems, router, locale])

  const highlights = useMemo(
    () => computeComparisonHighlights(initialItems),
    [initialItems],
  )

  const handleRemoveOne = (id: string) => {
    remove(id)
    const remaining = initialItems.filter((item) => item.id !== id).map((item) => item.id)
    if (remaining.length > 0) {
      router.push(localizePath(`/comparar?ids=${encodeURIComponent(remaining.join(','))}`, locale))
    } else {
      router.push(localizePath('/comparar', locale))
    }
  }

  const handleClearAll = () => {
    clear()
    router.push(localizePath('/catalogo', locale))
  }

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // ignore
    }
  }

  const fmtPrice = (p: ComparableProperty) => {
    if (!p.price || p.price <= 0) return isEn ? 'Price on request' : 'Precio a consultar'
    const base = new Intl.NumberFormat(numLocale, {
      style: 'currency',
      currency: p.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(p.price)
    return p.operation === 'alquiler' ? `${base}${isEn ? '/mo' : '/mes'}` : base
  }

  return (
    <div className="home-shell py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <LocalLink
            href="/catalogo"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#16294B] mb-2 no-underline"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>{isEn ? 'Back to catalog' : 'Volver al catálogo'}</span>
          </LocalLink>
          <h1 className="font-heading text-2xl md:text-4xl font-normal text-[#16294B] m-0">
            {isEn ? 'Property comparison' : 'Comparador de inmuebles'}
          </h1>
          <p className="text-sm text-[#64748B] mt-1 mb-0">
            {isEn
              ? 'Compare prices, $/m², dimensions and amenities side by side.'
              : 'Analiza lado a lado precios, $/m², metraje, ubicación y amenidades antes de agendar tu visita.'}
          </p>
        </div>

        {initialItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#16294B]/20 bg-white hover:bg-[#f7f4ee] px-3.5 py-2 text-xs font-semibold text-[#16294B] transition"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>
                {copied
                  ? isEn
                    ? 'Link copied!'
                    : '¡Enlace copiado!'
                  : isEn
                    ? 'Share comparison'
                    : 'Compartir comparación'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white hover:bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition"
            >
              <Trash2 size={14} aria-hidden="true" />
              <span>{isEn ? 'Clear all' : 'Vaciar comparador'}</span>
            </button>
          </div>
        )}
      </div>

      {initialItems.length === 0 ? (
        <section className="rounded-3xl border border-[#e6dfd3] bg-[#faf8f4] p-8 md:p-12 text-center max-w-2xl mx-auto my-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16294B]/10 text-[#16294B]">
            <Scale size={26} aria-hidden="true" />
          </div>
          <h2 className="font-heading text-2xl font-normal text-[#16294B] mb-2">
            {isEn ? 'No properties selected yet' : 'Aún no has seleccionado inmuebles para comparar'}
          </h2>
          <p className="text-sm text-[#64748B] max-w-md mx-auto mb-6">
            {isEn
              ? 'Tap the scale icon on up to 4 property cards in the catalog or listing pages to compare them here.'
              : 'Pulsa el botón «Comparar» (icono de balanza) en hasta 4 tarjetas del catálogo o fichas de inmuebles para verlos frente a frente.'}
          </p>
          <LocalLink
            href="/catalogo"
            className="inline-flex items-center gap-2 rounded-xl bg-[#16294B] hover:bg-[#0f1e38] text-white font-bold text-sm px-5 py-3 no-underline transition"
          >
            <span>{isEn ? 'Explore catalog' : 'Explorar catálogo'}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </LocalLink>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e6dfd3] bg-white shadow-sm">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e6dfd3] bg-[#faf8f4]">
                <th className="w-48 p-4 align-top text-xs font-bold uppercase tracking-wider text-[#8C6526]">
                  {isEn ? 'Attribute' : 'Característica'}
                </th>
                {initialItems.map((item) => {
                  const img = item.image || '/sinimagen.webp'
                  const target = `/inmueble/${item.slug || item.id}`
                  return (
                    <th key={item.id} className="p-4 align-top min-w-[210px] max-w-[260px]">
                      <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-100 mb-3">
                        <Image
                          src={img}
                          alt={item.title}
                          fill
                          sizes="260px"
                          unoptimized={!isOptimizableImageSrc(img)}
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveOne(item.id)}
                          aria-label={isEn ? 'Remove property' : 'Quitar inmueble'}
                          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {highlights.lowestPriceId === item.id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                            <Award size={11} /> {isEn ? 'Lowest price' : 'Menor precio'}
                          </span>
                        )}
                        {highlights.lowestPricePerM2Id === item.id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-bold">
                            <Sparkles size={11} /> {isEn ? 'Best $/m²' : 'Mejor $/m²'}
                          </span>
                        )}
                        {highlights.largestAreaId === item.id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-900 px-2 py-0.5 text-[10px] font-bold">
                            {isEn ? 'Largest m²' : 'Mayor m²'}
                          </span>
                        )}
                      </div>

                      <LocalLink
                        href={target}
                        className="font-bold text-[#16294B] hover:underline line-clamp-2 text-sm no-underline"
                      >
                        {item.title}
                      </LocalLink>

                      <p className="text-lg font-extrabold text-[#8C6526] mt-1 mb-0.5">
                        {fmtPrice(item)}
                      </p>
                      {bcvRate && item.price > 0 && (
                        <p className="text-[11px] font-medium text-[#64748B] mt-0 mb-2 inline-flex items-center gap-1">
                          <Landmark size={11} className="text-[#8C6526]" aria-hidden="true" />
                          Bs.{' '}
                          {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(
                            Math.round(item.price * bcvRate),
                          )}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <LocalLink
                          href={target}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#16294B] hover:underline no-underline"
                        >
                          <span>{isEn ? 'View listing' : 'Ver ficha'}</span>
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </LocalLink>
                        <LocalLink
                          href={`${target}#agendar-visita`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#16294B] hover:bg-[#0f1e38] text-white text-[11px] font-bold px-2.5 py-1 no-underline transition"
                        >
                          <CalendarCheck size={12} aria-hidden="true" />
                          <span>{isEn ? 'Schedule visit' : 'Agendar visita'}</span>
                        </LocalLink>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee8de]">
              <tr>
                <td className="p-3.5 font-semibold text-[#475569] bg-[#fcfbf9]">
                  {isEn ? 'Operation & type' : 'Operación y tipo'}
                </td>
                {initialItems.map((item) => (
                  <td key={item.id} className="p-3.5 text-[#1E293B]">
                    <span className="font-semibold">
                      {item.operation === 'alquiler'
                        ? isEn
                          ? 'For rent'
                          : 'Alquiler'
                        : isEn
                          ? 'For sale'
                          : 'Venta'}
                    </span>
                    {item.propertyType ? ` · ${item.propertyType}` : ''}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3.5 font-semibold text-[#475569] bg-[#fcfbf9]">
                  {isEn ? 'Location / Zone' : 'Ubicación / Urbanización'}
                </td>
                {initialItems.map((item) => (
                  <td key={item.id} className="p-3.5 text-[#1E293B]">
                    {[item.zone, item.city, item.state].filter(Boolean).join(', ') || 'Venezuela'}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3.5 font-semibold text-[#475569] bg-[#fcfbf9]">
                  {isEn ? 'Price per m²' : 'Precio por m²'}
                </td>
                {initialItems.map((item) => {
                  const ppm2 =
                    item.operation === 'venta'
                      ? calculatePricePerM2(item.price, item.builtArea, item.totalArea)
                      : null
                  const isBest = highlights.lowestPricePerM2Id === item.id
                  return (
                    <td
                      key={item.id}
                      className={`p-3.5 ${isBest ? 'font-bold text-emerald-700' : 'text-[#1E293B]'}`}
                    >
                      {ppm2
                        ? `$${new Intl.NumberFormat(numLocale, { maximumFractionDigits: 0 }).format(ppm2)}/m²`
                        : '—'}
                    </td>
                  )
                })}
              </tr>

              <tr>
                <td className="p-3.5 font-semibold text-[#475569] bg-[#fcfbf9]">
                  {isEn ? 'Built / Total area' : 'Área const. / Terreno'}
                </td>
                {initialItems.map((item) => (
                  <td key={item.id} className="p-3.5 text-[#1E293B]">
                    {item.builtArea ? `${item.builtArea} m²` : '—'}
                    {item.totalArea && item.totalArea !== item.builtArea
                      ? ` / ${item.totalArea} m²`
                      : ''}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3.5 font-semibold text-[#475569] bg-[#fcfbf9]">
                  {isEn ? 'Bedrooms / Bathrooms' : 'Habitaciones / Baños'}
                </td>
                {initialItems.map((item) => (
                  <td key={item.id} className="p-3.5 text-[#1E293B]">
                    {item.bedrooms != null ? `${item.bedrooms} hab.` : '—'} {' · '}
                    {item.bathrooms != null ? `${item.bathrooms} baños` : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3.5 font-semibold text-[#475569] bg-[#fcfbf9]">
                  {isEn ? 'Parking spaces' : 'Estacionamiento'}
                </td>
                {initialItems.map((item) => (
                  <td key={item.id} className="p-3.5 text-[#1E293B]">
                    {item.parking != null ? `${item.parking}` : '—'}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="p-3.5 font-semibold text-[#475569] bg-[#fcfbf9]">
                  {isEn ? 'Multimedia & Trust' : 'Multimedia y Confianza'}
                </td>
                {initialItems.map((item) => (
                  <td key={item.id} className="p-3.5">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {item.verifiedSeller && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 font-semibold">
                          <ShieldCheck size={12} /> {isEn ? 'Verified' : 'Verificado'}
                        </span>
                      )}
                      {item.hasVideo && (
                        <span className="rounded-md bg-slate-100 text-slate-700 px-2 py-0.5 font-medium">
                          Video
                        </span>
                      )}
                      {item.hasTour && (
                        <span className="rounded-md bg-slate-100 text-slate-700 px-2 py-0.5 font-medium">
                          360°
                        </span>
                      )}
                      {item.hasFloorPlan && (
                        <span className="rounded-md bg-slate-100 text-slate-700 px-2 py-0.5 font-medium">
                          {isEn ? 'Floor plan' : 'Plano'}
                        </span>
                      )}
                      {!item.verifiedSeller && !item.hasVideo && !item.hasTour && !item.hasFloorPlan && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {highlights.allAmenities.map((amenity) => (
                <tr key={amenity}>
                  <td className="p-3 text-xs font-medium text-[#475569] bg-[#fcfbf9]">{amenity}</td>
                  {initialItems.map((item) => {
                    const has = item.amenities.includes(amenity)
                    return (
                      <td key={item.id} className="p-3">
                        {has ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                            <Check size={15} aria-hidden="true" />
                            <span>{isEn ? 'Yes' : 'Sí'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-300">
                            <Minus size={14} aria-hidden="true" />
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
