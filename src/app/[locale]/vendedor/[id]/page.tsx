'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import BadgeVerificado from '@/components/BadgeVerificado'
import Avatar from '@/components/Avatar'
import SellerReputation from '@/components/SellerReputation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ArrowLeft, ArrowUpRight, Mail, MapPin, MessageSquare, Phone, ShieldCheck, Star } from 'lucide-react'

type SellerProfile = {
  id: string
  nombre: string | null
  telefono: string | null
  estado: string | null
  ciudad: string | null
  verificado: boolean | null
  nivel_confianza: number | null
  creado_en: string | null
  foto_perfil_url: string | null
  badges_automaticos: string[] | null
  whatsapp_disponible: boolean | null
  telefono_disponible: boolean | null
  email_disponible: boolean | null
  email_publico: string | null
  total_vendidas: number | null
  antiguedad_dias: number | null
  ultima_actividad: string | null
}

type SellerListing = {
  id: string
  titulo: string
  precio: number | null
  moneda: string | null
  imagen_url: string | null
  main_image_url: string | null
  ciudad: string | null
  estado: string | null
  operacion_nombre: string | null
  tipo_nombre: string | null
}

export default function VendedorPage() {
  const t = useTranslations('seller')
  const locale = useLocale()
  const params = useParams()
  const sellerId = params.id as string
  const [seller, setSeller] = useState<SellerProfile | null>(null)
  const [properties, setProperties] = useState<SellerListing[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [average, setAverage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSeller() {
      if (!isSupabaseConfigured()) {
        setNotFound(true)
        setLoading(false)
        return
      }

      try {
        const { data: profile, error: profileError } = await supabase
          .from('vw_perfiles_publicos')
          .select('id, nombre, telefono, estado, ciudad, verificado, nivel_confianza, creado_en, foto_perfil_url, badges_automaticos, whatsapp_disponible, telefono_disponible, email_disponible, email_publico, total_vendidas, antiguedad_dias, ultima_actividad')
          .eq('id', sellerId)
          .maybeSingle()
        if (profileError) throw profileError
        if (!profile) {
          if (!cancelled) setNotFound(true)
          return
        }

        const [{ data: reviewRows }, { data: listingRows }] = await Promise.all([
          supabase
            .from('resenas')
            .select('id, puntuacion, comentario, producto_id, producto_titulo, creado_en')
            .eq('vendedor_id', sellerId)
            .order('creado_en', { ascending: false }),
          supabase
            .from('vw_propiedades_publicas')
            .select('id, titulo, precio, moneda, imagen_url, main_image_url, ciudad, estado, operacion_nombre, tipo_nombre')
            .eq('user_id', sellerId)
            .eq('activo', true)
            .order('creado_en', { ascending: false })
            .limit(12),
        ])

        if (cancelled) return
        const reviewList = reviewRows || []
        setSeller(profile as SellerProfile)
        setReviews(reviewList)
        setProperties((listingRows || []) as SellerListing[])
        if (reviewList.length) {
          const mean = reviewList.reduce((sum: number, review: any) => sum + Number(review.puntuacion || 0), 0) / reviewList.length
          setAverage(Math.round(mean * 10) / 10)
        }
      } catch (error) {
        console.error('[seller-profile] Could not load public profile:', error)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSeller()
    return () => { cancelled = true }
  }, [sellerId])

  const isEnglish = locale === 'en'
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'es-VE', { day: '2-digit', month: 'short', year: 'numeric' }), [isEnglish])

  if (loading) {
    return (
      <main className="seller-page" aria-busy="true">
        <div className="seller-page__inner seller-page__loading">
          <div className="seller-page__skeleton-avatar" />
          <div className="h-7 w-48 animate-pulse bg-[#eee8df]" />
          <div className="h-4 w-64 max-w-full animate-pulse bg-[#f0ebe4]" />
        </div>
      </main>
    )
  }

  if (notFound || !seller) {
    return (
      <main className="seller-page">
        <section className="seller-page__inner seller-page__not-found">
          <p className="seller-page__eyebrow">{t('publicProfile')}</p>
          <h1>{t('profileNotFound')}</h1>
          <p>{t('profileNotFoundDescription')}</p>
          <LocalLink href="/catalogo">{t('exploreProperties')} <ArrowUpRight size={15} /></LocalLink>
        </section>
      </main>
    )
  }

  const sellerName = seller.nombre || t('seller')
  const location = [seller.ciudad, seller.estado].filter(Boolean).join(', ')
  const phoneDigits = seller.telefono?.replace(/[^0-9]/g, '') || ''
  const whatsappEnabled = Boolean(seller.whatsapp_disponible && phoneDigits)
  const callEnabled = Boolean(seller.telefono_disponible && seller.telefono)
  const emailEnabled = Boolean(seller.email_disponible && seller.email_publico)
  const yearsOnSite = seller.antiguedad_dias || (seller.creado_en
    ? Math.max(0, Math.floor((Date.now() - new Date(seller.creado_en).getTime()) / 86400000))
    : 0)
  const firstPropertyChat = properties[0]
    ? `/chat?producto_id=${encodeURIComponent(properties[0].id)}&vendedor_id=${encodeURIComponent(sellerId)}`
    : null

  const reviewSchema = reviews.length ? {
    '@context': 'https://schema.org',
    '@type': seller.verificado ? 'Organization' : 'Person',
    name: sellerName,
    address: {
      '@type': 'PostalAddress',
      addressLocality: seller.ciudad || '',
      addressRegion: seller.estado || '',
      addressCountry: 'VE',
    },
    url: `https://venezuela-inmuebles.online${isEnglish ? '/en' : ''}/vendedor/${sellerId}`,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: average.toFixed(1),
      reviewCount: reviews.length,
      bestRating: '5',
      worstRating: '1',
    },
  } : null

  return (
    <main className="seller-page">
      {reviewSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema).replace(/</g, '\\u003c') }} />}
      <div className="seller-page__inner">
        <LocalLink href="/catalogo" className="seller-page__back"><ArrowLeft size={15} /> {t('backToProperties')}</LocalLink>

        <section className="seller-profile-card" aria-labelledby="seller-name">
          <div className="seller-profile-card__topline">
            <p className="seller-page__eyebrow">{t('publicProfile')}</p>
            {seller.verificado && <span className="seller-profile-card__verified"><ShieldCheck size={14} /> {t('verified')}</span>}
          </div>
          <div className="seller-profile-card__body">
            <Avatar nombre={sellerName} fotoUrl={seller.foto_perfil_url} size="xl" />
            <div className="seller-profile-card__identity">
              <h1 id="seller-name">{sellerName} {seller.verificado && <BadgeVerificado size="md" />}</h1>
              <p className="seller-profile-card__role">{t('professionalLabel')}</p>
              {location && <p className="seller-profile-card__location"><MapPin size={15} />{location}</p>}
              <div className="seller-profile-card__reputation">
                <SellerReputation
                  nivel={seller.nivel_confianza || 0}
                  numResenas={reviews.length}
                  promedioResenas={average}
                  numPubsActivas={properties.length}
                  numPubsVendidas={seller.total_vendidas || 0}
                  antiguedadDias={yearsOnSite}
                  ultimaActividad={seller.ultima_actividad}
                  verificado={seller.verificado || false}
                  badges={seller.badges_automaticos || []}
                  size="md"
                />
              </div>
              <div className="seller-profile-card__contact">
                {whatsappEnabled && (
                  <a className="seller-profile-card__whatsapp" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer">
                    WhatsApp <ArrowUpRight size={15} />
                  </a>
                )}
                {callEnabled && <a href={`tel:${seller.telefono?.replace(/[^+\d]/g, '')}`}><Phone size={14} />{t('call')}</a>}
                {emailEnabled && <a href={`mailto:${seller.email_publico}`}><Mail size={14} />{t('email')}</a>}
                {firstPropertyChat && <LocalLink href={firstPropertyChat}><MessageSquare size={14} />{t('sendMessage')}</LocalLink>}
              </div>
            </div>
          </div>
          {seller.verificado && <p className="seller-profile-card__trust"><ShieldCheck size={15} />{t('verifiedSummary')}</p>}
        </section>

        <div className="seller-profile-grid">
          <section className="seller-page__listings" aria-labelledby="seller-properties-title">
            <div className="seller-page__section-heading">
              <div>
                <p className="seller-page__eyebrow">{t('availableNow')}</p>
                <h2 id="seller-properties-title">{t('propertiesBy', { name: sellerName })}</h2>
              </div>
              <span>{properties.length}</span>
            </div>

            {properties.length === 0 ? (
              <div className="seller-page__empty">
                <p>{t('noListings')}</p>
              </div>
            ) : (
              <div className="seller-property-grid">
                {properties.map(property => {
                  const image = property.main_image_url || property.imagen_url
                  const amount = Number(property.precio || 0)
                  const currency = typeof property.moneda === 'string' && /^[A-Z]{3}$/i.test(property.moneda) ? property.moneda.toUpperCase() : 'USD'
                  const price = amount > 0
                    ? new Intl.NumberFormat(isEnglish ? 'en-US' : 'es-VE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
                    : t('priceOnRequest')
                  return (
                    <LocalLink key={property.id} href={`/inmueble/${property.id}`} className="seller-property-card">
                      <div className="seller-property-card__media">
                        {image ? <Image src={image} alt="" fill sizes="(max-width: 640px) 90vw, (max-width: 1000px) 45vw, 29vw" unoptimized /> : <span>{t('noPhoto')}</span>}
                        {property.operacion_nombre && <span className="seller-property-card__operation">{property.operacion_nombre}</span>}
                      </div>
                      <div className="seller-property-card__body">
                        <p>{[property.ciudad, property.estado].filter(Boolean).join(', ')}</p>
                        <h3>{property.titulo}</h3>
                        <div><strong>{price}</strong><ArrowUpRight size={16} /></div>
                      </div>
                    </LocalLink>
                  )
                })}
              </div>
            )}
          </section>

          <aside className="seller-page__reviews" aria-labelledby="seller-reviews-title">
            <div className="seller-page__section-heading">
              <div>
                <p className="seller-page__eyebrow">{t('community')}</p>
                <h2 id="seller-reviews-title">{t('reviews')}</h2>
              </div>
              <span><Star size={13} fill="currentColor" /> {reviews.length ? average.toFixed(1) : '—'}</span>
            </div>
            {reviews.length === 0 ? (
              <div className="seller-page__empty seller-page__empty--reviews"><Star size={24} /><p>{t('noReviews')}</p></div>
            ) : (
              <div className="seller-review-list">
                {reviews.slice(0, 6).map(review => {
                  const reviewDate = new Date(review.creado_en)
                  return (
                    <article key={review.id} className="seller-review-card">
                      <div className="seller-review-card__top">
                        <div className="seller-review-card__stars" aria-label={`${review.puntuacion} / 5`}>
                          {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={12} className={index < Math.round(review.puntuacion) ? 'is-filled' : ''} />)}
                        </div>
                        {!Number.isNaN(reviewDate.getTime()) && <time>{dateFormatter.format(reviewDate)}</time>}
                      </div>
                      {review.comentario && <p>{review.comentario}</p>}
                      {review.producto_titulo && <span>{t('reviewFor')}: {review.producto_titulo}</span>}
                    </article>
                  )
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
