'use client'

import { useCallback, useEffect, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { ArrowUpRight, Bell, BellOff, Heart, Loader2, Trash2, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import Image from 'next/image'
import { isOptimizableImageSrc } from '@/lib/image-src'

interface SavedSearchRow {
  id: string
  nombre: string
  query_string: string
  alerta_email: boolean
  frecuencia: 'inmediata' | 'diaria' | 'pausada'
  ultimo_envio_en: string | null
  creado_en: string
}

export default function TabFavoritos({ favoritos }: { favoritos: any[] }) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const isEn = locale === 'en'

  const [removing, setRemoving] = useState<string | null>(null)
  const [savedSearches, setSavedSearches] = useState<SavedSearchRow[]>([])
  const [loadingSearches, setLoadingSearches] = useState(true)
  const [updatingSearchId, setUpdatingSearchId] = useState<string | null>(null)

  const loadSavedSearches = useCallback(async () => {
    setLoadingSearches(true)
    try {
      const res = await fetch('/api/busquedas-guardadas', {
        headers: await getSupabaseAuthHeaders(),
      })
      if (!res.ok) return
      const json = await res.json()
      setSavedSearches(Array.isArray(json.items) ? json.items : [])
    } catch {
      // silencioso
    } finally {
      setLoadingSearches(false)
    }
  }, [])

  useEffect(() => {
    void loadSavedSearches()
  }, [loadSavedSearches])

  async function updateSearchFrequency(id: string, frecuencia: 'inmediata' | 'diaria' | 'pausada') {
    setUpdatingSearchId(id)
    try {
      const res = await fetch('/api/busquedas-guardadas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getSupabaseAuthHeaders()),
        },
        body: JSON.stringify({ id, frecuencia }),
      })
      if (res.ok) {
        const json = await res.json()
        setSavedSearches((prev) => prev.map((s) => (s.id === id ? json.item : s)))
      }
    } finally {
      setUpdatingSearchId(null)
    }
  }

  async function deleteSavedSearch(id: string) {
    setUpdatingSearchId(id)
    try {
      const res = await fetch(`/api/busquedas-guardadas?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: await getSupabaseAuthHeaders(),
      })
      if (res.ok) {
        setSavedSearches((prev) => prev.filter((s) => s.id !== id))
      }
    } finally {
      setUpdatingSearchId(null)
    }
  }

  async function removeFavorite(productId: string) {
    if (removing) return
    setRemoving(productId)
    try {
      const response = await fetch('/api/favorito/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({ productId, isFavorited: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || t('favoriteRemoveError'))
      window.location.reload()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('favoriteRemoveError'))
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sección 1: Búsquedas guardadas y alertas automáticas por correo */}
      <section className="dashboard-panel" aria-labelledby="dashboard-saved-searches-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="dashboard-page__eyebrow">
              {isEn ? 'Email alerts' : 'Alertas automáticas'}
            </p>
            <h2
              id="dashboard-saved-searches-title"
              className="m-0 font-heading text-2xl font-normal text-[#1A2333]"
            >
              {isEn ? 'Saved searches' : 'Búsquedas guardadas'}
            </h2>
          </div>
          <LocalLink
            href="/catalogo"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#16294B] hover:underline no-underline"
          >
            <span>{isEn ? 'New search in catalog' : 'Nueva búsqueda en el catálogo'}</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </LocalLink>
        </div>

        {loadingSearches ? (
          <div className="py-6 text-center text-xs text-slate-400">
            <Loader2 size={18} className="animate-spin mx-auto mb-1.5" />
            {isEn ? 'Loading saved alerts…' : 'Cargando alertas guardadas…'}
          </div>
        ) : savedSearches.length === 0 ? (
          <div className="rounded-2xl border border-[#e6dfd3] bg-[#faf8f4] p-5 text-sm text-[#475569]">
            <p className="m-0">
              {isEn
                ? 'Filter by city, neighborhood or budget in the catalog and tap "Save search & alerts" to get notified when matching properties are published.'
                : 'Filtra por ciudad, urbanización o presupuesto en el catálogo y pulsa «Guardar búsqueda y alerta» para recibir un correo cada vez que se publiquen inmuebles compatibles.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {savedSearches.map((item) => {
              const catalogHref = item.query_string ? `/catalogo?${item.query_string}` : '/catalogo'
              const isPaused = !item.alerta_email || item.frecuencia === 'pausada'
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#e6dfd3] bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isPaused ? (
                        <BellOff size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <Bell size={14} className="text-[#8C6526] shrink-0" aria-hidden="true" />
                      )}
                      <LocalLink
                        href={catalogHref}
                        className="font-bold text-sm text-[#16294B] hover:underline truncate no-underline"
                      >
                        {item.nombre}
                      </LocalLink>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      aria-label={isEn ? 'Alert frequency' : 'Frecuencia de alerta'}
                      disabled={updatingSearchId === item.id}
                      value={isPaused ? 'pausada' : item.frecuencia}
                      onChange={(e) =>
                        updateSearchFrequency(item.id, e.target.value as SavedSearchRow['frecuencia'])
                      }
                      className="rounded-lg border border-[#d8d2c7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1E293B]"
                    >
                      <option value="inmediata">{isEn ? 'Immediate' : 'Inmediata'}</option>
                      <option value="diaria">{isEn ? 'Daily digest' : 'Resumen diario'}</option>
                      <option value="pausada">{isEn ? 'Paused' : 'Pausada'}</option>
                    </select>

                    <LocalLink
                      href={catalogHref}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#f4f1ea] hover:bg-[#e9e3d6] text-[#16294B] px-2.5 py-1.5 text-xs font-semibold no-underline"
                    >
                      <span>{isEn ? 'Open' : 'Ver'}</span>
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </LocalLink>

                    <button
                      type="button"
                      disabled={updatingSearchId === item.id}
                      onClick={() => deleteSavedSearch(item.id)}
                      aria-label={isEn ? 'Delete saved search' : 'Eliminar alerta'}
                      className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sección 2: Inmuebles guardados en Favoritos */}
      {favoritos.length === 0 ? (
        <section className="dashboard-empty-state" aria-labelledby="dashboard-favorites-title">
          <Heart size={36} className="mx-auto mb-4 text-[#8C6526]" aria-hidden="true" />
          <p className="dashboard-page__eyebrow">{t('tabFavorites')}</p>
          <h2 id="dashboard-favorites-title">{t('favoritesEmptyTitle')}</h2>
          <p>{t('favoritesEmptyDescription')}</p>
          <LocalLink href="/catalogo">{t('exploreProperties')}</LocalLink>
        </section>
      ) : (
        <section className="dashboard-panel" aria-labelledby="dashboard-favorites-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="dashboard-page__eyebrow">{t('tabFavorites')}</p>
              <h2
                id="dashboard-favorites-title"
                className="m-0 font-heading text-2xl font-normal text-[#1A2333]"
              >
                {t('favoritesTitle')}
              </h2>
            </div>
            <span className="text-xs text-[#81776d]">{favoritos.length}</span>
          </div>
          <div className="dashboard-property-list">
            {favoritos.map((favorite: any) => {
              const property = favorite.productos
              if (!property) return null
              const price = Number(property.price || property.precio || 0)
              const formattedPrice =
                price > 0
                  ? new Intl.NumberFormat('es-VE', {
                      style: 'currency',
                      currency: property.moneda || 'USD',
                      maximumFractionDigits: 0,
                    }).format(price)
                  : t('priceOnRequest')

              return (
                <article key={favorite.producto_id} className="dashboard-property-row">
                  <LocalLink
                    href={`/inmueble/${property.slug || property.id}`}
                    className="dashboard-property-row__media"
                  >
                    {property.main_image_url ? (
                      <Image
                        src={property.main_image_url}
                        alt=""
                        fill
                        sizes="100px"
                        unoptimized={!isOptimizableImageSrc(property.main_image_url)}
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-[9px] text-gray-400">
                        {t('noPhoto')}
                      </span>
                    )}
                  </LocalLink>
                  <LocalLink
                    href={`/inmueble/${property.slug || property.id}`}
                    className="dashboard-property-row__content no-underline"
                  >
                    <h3 className="dashboard-property-row__title">{property.titulo}</h3>
                    <p className="dashboard-property-row__price">{formattedPrice}</p>
                    <div className="dashboard-property-row__meta">
                      {[property.city_name || property.ciudad, property.state_name || property.estado]
                        .filter(Boolean)
                        .map((part: string) => (
                          <span key={part}>{part}</span>
                        ))}
                    </div>
                  </LocalLink>
                  <div className="dashboard-property-row__actions">
                    <LocalLink href={`/inmueble/${property.slug || property.id}`}>
                      {t('viewProperty')}
                    </LocalLink>
                    <button
                      type="button"
                      disabled={removing === property.id}
                      onClick={() => removeFavorite(property.id)}
                      aria-label={t('removeFavorite')}
                      title={t('removeFavorite')}
                    >
                      {removing === property.id ? (
                        '…'
                      ) : (
                        <>
                          <X size={14} aria-hidden="true" />
                          <span>{t('removeFavorite')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
