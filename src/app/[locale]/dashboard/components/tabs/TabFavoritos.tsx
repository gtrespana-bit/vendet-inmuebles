'use client'

import { useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { Heart, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import Image from 'next/image'

export default function TabFavoritos({ favoritos }: { favoritos: any[] }) {
  const t = useTranslations('dashboard')
  const [removing, setRemoving] = useState<string | null>(null)

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

  if (favoritos.length === 0) {
    return (
      <section className="dashboard-empty-state" aria-labelledby="dashboard-favorites-title">
        <Heart size={36} className="mx-auto mb-4 text-[#9b8053]" aria-hidden="true" />
        <p className="dashboard-page__eyebrow">{t('tabFavorites')}</p>
        <h2 id="dashboard-favorites-title">{t('favoritesEmptyTitle')}</h2>
        <p>{t('favoritesEmptyDescription')}</p>
        <LocalLink href="/catalogo">{t('exploreProperties')}</LocalLink>
      </section>
    )
  }

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-favorites-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="dashboard-page__eyebrow">{t('tabFavorites')}</p>
          <h2 id="dashboard-favorites-title" className="m-0 font-heading text-2xl font-normal text-[#302925]">{t('favoritesTitle')}</h2>
        </div>
        <span className="text-xs text-[#81776d]">{favoritos.length}</span>
      </div>
      <div className="dashboard-property-list">
        {favoritos.map((favorite: any) => {
          const property = favorite.productos
          if (!property) return null
          const price = Number(property.price || property.precio || 0)
          const formattedPrice = price > 0
            ? new Intl.NumberFormat('es-VE', { style: 'currency', currency: property.moneda || 'USD', maximumFractionDigits: 0 }).format(price)
            : t('priceOnRequest')

          return (
            <article key={favorite.producto_id} className="dashboard-property-row">
              <LocalLink href={`/inmueble/${property.slug || property.id}`} className="dashboard-property-row__media">
                {property.main_image_url ? (
                  <Image src={property.main_image_url} alt="" fill sizes="100px" unoptimized />
                ) : <span className="grid h-full place-items-center text-[9px] text-gray-400">{t('noPhoto')}</span>}
              </LocalLink>
              <LocalLink href={`/inmueble/${property.slug || property.id}`} className="dashboard-property-row__content no-underline">
                <h3 className="dashboard-property-row__title">{property.titulo}</h3>
                <p className="dashboard-property-row__price">{formattedPrice}</p>
                <div className="dashboard-property-row__meta">
                  {[property.city_name || property.ciudad, property.state_name || property.estado].filter(Boolean).map((part: string) => <span key={part}>{part}</span>)}
                </div>
              </LocalLink>
              <div className="dashboard-property-row__actions">
                <LocalLink href={`/inmueble/${property.slug || property.id}`}>{t('viewProperty')}</LocalLink>
                <button
                  type="button"
                  disabled={removing === property.id}
                  onClick={() => removeFavorite(property.id)}
                  aria-label={t('removeFavorite')}
                  title={t('removeFavorite')}
                >
                  {removing === property.id ? '…' : <><X size={14} aria-hidden="true" /><span>{t('removeFavorite')}</span></>}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
