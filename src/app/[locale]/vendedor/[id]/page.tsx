'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import BadgeVerificado from '@/components/BadgeVerificado'
import Avatar from '@/components/Avatar'
import SellerReputation from '@/components/SellerReputation'
import TrackedContactLink from '@/components/TrackedContactLink'
import { isOptimizableImageSrc } from '@/lib/image-src'
import { isUuidIdentifier } from '@/lib/storefront-slug'
import { computeReviewDistribution, type ResponseSpeedSummary } from '@/lib/listing-funnel'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Globe,
  Languages,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react'

type SellerProfile = {
  id: string
  slug?: string | null
  nombre: string | null
  empresa_nombre?: string | null
  descripcion_agente?: string | null
  tipo_cuenta?: string | null
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
  miembro_agencia_id?: string | null
  miembro_agencia_nombre?: string | null
  miembro_agencia_slug?: string | null
  miembro_agencia_owner_id?: string | null
  licencia_corredor?: string | null
  horario_atencion?: string | null
  idiomas?: string[] | null
  zonas_especialidad?: string[] | null
  redes_sociales?: Record<string, string> | null
  anos_experiencia?: number | null
  visitas_atendidas?: number | null
}

type TeamAdvisor = {
  id: string
  slug: string | null
  nombre: string | null
  foto_perfil_url: string | null
  verificado: boolean | null
  ciudad: string | null
}

type SellerListing = {
  id: string
  slug?: string | null
  titulo: string
  precio: number | null
  moneda: string | null
  imagen_url: string | null
  main_image_url: string | null
  ciudad: string | null
  estado: string | null
  zona?: string | null
  operacion_nombre: string | null
  operacion_slug?: string | null
  tipo_nombre: string | null
  habitaciones?: number | null
  banos?: number | null
  area_construida?: number | null
  agente_asignado_id?: string | null
  agente_nombre?: string | null
}

const LANGUAGE_LABELS: Record<string, { es: string; en: string }> = {
  es: { es: 'Español', en: 'Spanish' },
  en: { es: 'Inglés', en: 'English' },
  pt: { es: 'Portugués', en: 'Portuguese' },
  it: { es: 'Italiano', en: 'Italian' },
  zh: { es: 'Chino', en: 'Chinese' },
  fr: { es: 'Francés', en: 'French' },
  de: { es: 'Alemán', en: 'German' },
}

export default function VendedorPage() {
  const t = useTranslations('seller')
  const locale = useLocale()
  const isEnglish = locale === 'en'
  const params = useParams()
  const sellerParam = decodeURIComponent(String(params.id || '')).trim()

  const [seller, setSeller] = useState<SellerProfile | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamAdvisor[]>([])
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>('todos')
  const [operationFilter, setOperationFilter] = useState<'todos' | 'venta' | 'alquiler'>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc'>('recent')
  const [properties, setProperties] = useState<SellerListing[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [responseSpeed, setResponseSpeed] = useState<ResponseSpeedSummary | null>(null)
  const [average, setAverage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSeller() {
      if (!isSupabaseConfigured() || !sellerParam) {
        setNotFound(true)
        setLoading(false)
        return
      }

      try {
        let profileQuery = supabase
          .from('vw_perfiles_publicos')
          .select(
            'id, slug, nombre, empresa_nombre, descripcion_agente, tipo_cuenta, telefono, estado, ciudad, verificado, nivel_confianza, creado_en, foto_perfil_url, badges_automaticos, whatsapp_disponible, telefono_disponible, email_disponible, email_publico, total_vendidas, antiguedad_dias, ultima_actividad, miembro_agencia_id, miembro_agencia_nombre, miembro_agencia_slug, miembro_agencia_owner_id, licencia_corredor, horario_atencion, idiomas, zonas_especialidad, redes_sociales, anos_experiencia, visitas_atendidas',
          )

        profileQuery = isUuidIdentifier(sellerParam)
          ? profileQuery.eq('id', sellerParam)
          : profileQuery.eq('slug', sellerParam.toLowerCase())

        const { data: profile, error: profileError } = await profileQuery.maybeSingle()
        if (profileError) throw profileError
        if (!profile) {
          if (!cancelled) setNotFound(true)
          return
        }

        const resolvedSellerId = profile.id
        const isAgencyStorefront = Boolean(
          profile.miembro_agencia_id && profile.miembro_agencia_owner_id === resolvedSellerId,
        )

        const listingCols =
          'id, slug, titulo, precio, moneda, imagen_url, main_image_url, ciudad, estado, zona, operacion_nombre, operacion_slug, tipo_nombre, habitaciones, banos, area_construida, agente_asignado_id, agente_nombre'

        const listingsPromise = isAgencyStorefront
          ? supabase
              .from('vw_propiedades_publicas')
              .select(listingCols)
              .or(`user_id.eq.${resolvedSellerId},agencia_id.eq.${profile.miembro_agencia_id}`)
              .eq('activo', true)
              .order('creado_en', { ascending: false })
              .limit(60)
          : supabase
              .from('vw_propiedades_publicas')
              .select(listingCols)
              .or(`user_id.eq.${resolvedSellerId},agente_asignado_id.eq.${resolvedSellerId}`)
              .eq('activo', true)
              .order('creado_en', { ascending: false })
              .limit(60)

        const teamPromise = isAgencyStorefront
          ? supabase
              .from('vw_perfiles_publicos')
              .select('id, slug, nombre, foto_perfil_url, verificado, ciudad')
              .eq('miembro_agencia_id', profile.miembro_agencia_id)
          : Promise.resolve({ data: [] as TeamAdvisor[] })

        const enrichedReviewsPromise = fetch(
          `/api/resenas?vendedor_id=${encodeURIComponent(resolvedSellerId)}`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)

        const [enrichedRevJson, { data: listingRows }, { data: teamRows }] = await Promise.all([
          enrichedReviewsPromise,
          listingsPromise,
          teamPromise,
        ])

        let reviewList: any[] = Array.isArray(enrichedRevJson?.items) ? enrichedRevJson.items : []
        if (!enrichedRevJson) {
          const { data: fallbackReviews } = await supabase
            .from('resenas')
            .select(
              'id, puntuacion, comentario, producto_id, producto_titulo, tipo_interaccion, respuesta_vendedor, respuesta_en, creado_en',
            )
            .eq('vendedor_id', resolvedSellerId)
            .order('creado_en', { ascending: false })
          reviewList = fallbackReviews || []
        }

        if (cancelled) return
        setSeller(profile as SellerProfile)
        setTeamMembers((teamRows || []) as TeamAdvisor[])
        setProperties((listingRows || []) as SellerListing[])
        setReviews(reviewList)
        if (enrichedRevJson?.responseSpeed) {
          setResponseSpeed(enrichedRevJson.responseSpeed)
        }
        if (reviewList.length) {
          const mean =
            reviewList.reduce((sum: number, review: any) => sum + Number(review.puntuacion || 0), 0) /
            reviewList.length
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
    return () => {
      cancelled = true
    }
  }, [sellerParam])

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [isEnglish],
  )

  const distribution = useMemo(() => computeReviewDistribution(reviews), [reviews])

  const filteredProperties = useMemo(() => {
    let list = properties.slice()
    if (selectedAdvisorId !== 'todos' && seller) {
      list = list.filter((p) => (p.agente_asignado_id || seller.id) === selectedAdvisorId)
    }
    if (operationFilter !== 'todos') {
      list = list.filter((p) => {
        const op = String(p.operacion_slug || p.operacion_nombre || '').toLowerCase()
        const isRent = op.includes('alquiler') || op.includes('rent')
        return operationFilter === 'alquiler' ? isRent : !isRent
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((p) =>
        [p.titulo, p.ciudad, p.estado, p.zona, p.tipo_nombre]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(q)),
      )
    }
    if (sortBy === 'price_asc') {
      list.sort((a, b) => Number(a.precio || 0) - Number(b.precio || 0))
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0))
    }
    return list
  }, [properties, selectedAdvisorId, seller, operationFilter, searchQuery, sortBy])

  if (loading) {
    return (
      <div className="seller-page" aria-busy="true">
        <div className="seller-page__inner seller-page__loading">
          <div className="seller-page__skeleton-avatar" />
          <div className="h-7 w-48 animate-pulse bg-[#EAE6DC]" />
          <div className="h-4 w-64 max-w-full animate-pulse bg-[#f0ebe4]" />
        </div>
      </div>
    )
  }

  if (notFound || !seller) {
    return (
      <div className="seller-page">
        <section className="seller-page__inner seller-page__not-found">
          <p className="seller-page__eyebrow">{t('publicProfile')}</p>
          <h1>{t('profileNotFound')}</h1>
          <p>{t('profileNotFoundDescription')}</p>
          <LocalLink href="/catalogo">
            {t('exploreProperties')} <ArrowUpRight size={15} />
          </LocalLink>
        </section>
      </div>
    )
  }

  const isAgencyOwnerStorefront = Boolean(
    seller.miembro_agencia_id && seller.miembro_agencia_owner_id === seller.id,
  )
  const isLinkedAgentStorefront = Boolean(
    seller.miembro_agencia_id &&
      seller.miembro_agencia_owner_id &&
      seller.miembro_agencia_owner_id !== seller.id,
  )
  const sellerName = isAgencyOwnerStorefront
    ? seller.miembro_agencia_nombre || seller.empresa_nombre || seller.nombre || t('seller')
    : seller.nombre || t('seller')
  const canonicalIdentifier = seller.slug || seller.id
  const location = [seller.ciudad, seller.estado].filter(Boolean).join(', ')
  const phoneDigits = seller.telefono?.replace(/[^0-9]/g, '') || ''
  const whatsappEnabled = Boolean(seller.whatsapp_disponible && phoneDigits)
  const callEnabled = Boolean(seller.telefono_disponible && seller.telefono)
  const emailEnabled = Boolean(seller.email_disponible && seller.email_publico)
  const yearsOnSite =
    seller.antiguedad_dias ||
    (seller.creado_en
      ? Math.max(0, Math.floor((Date.now() - new Date(seller.creado_en).getTime()) / 86400000))
      : 0)
  const firstPropertyChat = properties[0]
    ? `/chat?producto_id=${encodeURIComponent(properties[0].id)}&vendedor_id=${encodeURIComponent(seller.id)}`
    : null

  const spokenLanguages = Array.isArray(seller.idiomas) && seller.idiomas.length > 0
    ? seller.idiomas
        .map((code) => LANGUAGE_LABELS[code]?.[isEnglish ? 'en' : 'es'] || code.toUpperCase())
        .join(', ')
    : null
  const specialtyZones = Array.isArray(seller.zonas_especialidad)
    ? seller.zonas_especialidad.filter(Boolean)
    : []

  const agentSchema = {
    '@context': 'https://schema.org',
    '@type': seller.verificado || seller.empresa_nombre || isAgencyOwnerStorefront ? 'RealEstateAgent' : 'Person',
    name: seller.empresa_nombre || sellerName,
    ...(seller.descripcion_agente ? { description: seller.descripcion_agente } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: seller.ciudad || '',
      addressRegion: seller.estado || '',
      addressCountry: 'VE',
    },
    url: `https://venezuela-inmuebles.online${isEnglish ? '/en' : ''}/vendedor/${canonicalIdentifier}`,
    ...(reviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: average.toFixed(1),
            reviewCount: reviews.length,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  }

  function renderOriginTag(origin?: string) {
    if (origin === 'visita_confirmada') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 text-[10px] font-bold">
          <CalendarCheck size={10} />
          {isEnglish ? 'Confirmed tour' : 'Visita confirmada'}
        </span>
      )
    }
    if (origin === 'cierre_operacion') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
          <CheckCircle2 size={10} />
          {isEnglish ? 'Closed deal' : 'Operación cerrada'}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-semibold">
        {isEnglish ? 'Verified chat' : 'Chat verificado'}
      </span>
    )
  }

  return (
    <div className="seller-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(agentSchema).replace(/</g, '\\u003c') }}
      />
      <div className="seller-page__inner">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <LocalLink href="/catalogo" className="seller-page__back">
            <ArrowLeft size={15} /> {t('backToProperties')}
          </LocalLink>
          <LocalLink
            href="/asesores"
            className="text-xs font-semibold text-brand-primary hover:underline inline-flex items-center gap-1"
          >
            <Users size={13} />
            <span>{isEnglish ? 'All verified agencies & advisors' : 'Ver directorio de asesores'}</span>
          </LocalLink>
        </div>

        <section className="seller-profile-card" aria-labelledby="seller-name">
          <div className="seller-profile-card__topline">
            <p className="seller-page__eyebrow">{t('publicProfile')}</p>
            <div className="flex flex-wrap items-center gap-2">
              {responseSpeed && responseSpeed.tier !== 'insufficient_data' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 text-xs font-bold">
                  <Clock3 size={12} aria-hidden="true" />
                  {isEnglish
                    ? `Replies in ~${
                        (responseSpeed.medianMinutes || 0) < 60
                          ? `${responseSpeed.medianMinutes} min`
                          : `${Math.round(((responseSpeed.medianMinutes || 0) / 60) * 10) / 10} h`
                      }`
                    : `Responde en ~${
                        (responseSpeed.medianMinutes || 0) < 60
                          ? `${responseSpeed.medianMinutes} min`
                          : `${Math.round(((responseSpeed.medianMinutes || 0) / 60) * 10) / 10} h`
                      }`}
                </span>
              )}
              <span
                className={`seller-profile-card__verification ${
                  seller.verificado
                    ? 'seller-profile-card__verified'
                    : 'seller-profile-card__unverified'
                }`}
                aria-label={seller.verificado ? t('verified') : t('notVerified')}
              >
                {seller.verificado ? (
                  <ShieldCheck size={14} aria-hidden="true" />
                ) : (
                  <Shield size={14} aria-hidden="true" />
                )}
                {seller.verificado ? t('verified') : t('notVerified')}
              </span>
            </div>
          </div>

          <div className="seller-profile-card__body">
            <Avatar nombre={sellerName} fotoUrl={seller.foto_perfil_url} size="xl" />
            <div className="seller-profile-card__identity">
              <h1 id="seller-name">
                {sellerName} {seller.verificado && <BadgeVerificado size="md" />}
              </h1>
              {isLinkedAgentStorefront && seller.miembro_agencia_nombre ? (
                <LocalLink
                  href={`/vendedor/${seller.miembro_agencia_slug || seller.miembro_agencia_owner_id}`}
                  className="seller-profile-card__role inline-flex items-center gap-1.5 text-brand-primary font-semibold hover:underline"
                >
                  <Building2 size={14} aria-hidden="true" />
                  <span>
                    {isEnglish
                      ? `Official advisor at ${seller.miembro_agencia_nombre}`
                      : `Agente oficial de ${seller.miembro_agencia_nombre}`}
                  </span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </LocalLink>
              ) : isAgencyOwnerStorefront ? (
                <p className="seller-profile-card__role flex items-center gap-1.5">
                  <Building2 size={14} aria-hidden="true" />
                  <span>
                    {isEnglish ? 'Official Real Estate Agency' : 'Agencia Inmobiliaria Oficial'}
                  </span>
                </p>
              ) : seller.empresa_nombre ? (
                <p className="seller-profile-card__role flex items-center gap-1.5">
                  <Building2 size={14} aria-hidden="true" />
                  <span>{seller.empresa_nombre}</span>
                </p>
              ) : (
                <p className="seller-profile-card__role">{t('professionalLabel')}</p>
              )}

              {location && (
                <p className="seller-profile-card__location">
                  <MapPin size={15} />
                  {location}
                </p>
              )}

              {seller.descripcion_agente && (
                <p className="text-sm text-gray-600 mt-2 max-w-2xl leading-relaxed">
                  {seller.descripcion_agente}
                </p>
              )}

              {/* Credenciales profesionales del Escaparate Pro */}
              {(seller.licencia_corredor ||
                seller.anos_experiencia != null ||
                seller.horario_atencion ||
                spokenLanguages ||
                (seller.visitas_atendidas ?? 0) > 0) && (
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-700">
                  {seller.licencia_corredor && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf8f4] border border-[#e5dec9] px-2.5 py-1 font-semibold text-[#16294B]">
                      <Award size={13} className="text-[#8C6526]" />
                      {seller.licencia_corredor}
                    </span>
                  )}
                  {seller.anos_experiencia != null && seller.anos_experiencia > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf8f4] border border-[#e5dec9] px-2.5 py-1 font-medium">
                      {isEnglish
                        ? `${seller.anos_experiencia} yrs experience`
                        : `${seller.anos_experiencia} años de experiencia`}
                    </span>
                  )}
                  {(seller.visitas_atendidas ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 font-semibold text-teal-800">
                      <CalendarCheck size={13} />
                      {seller.visitas_atendidas}{' '}
                      {isEnglish ? 'confirmed tours' : 'visitas confirmadas'}
                    </span>
                  )}
                  {spokenLanguages && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf8f4] border border-[#e5dec9] px-2.5 py-1">
                      <Languages size={13} className="text-gray-500" />
                      {spokenLanguages}
                    </span>
                  )}
                  {seller.horario_atencion && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf8f4] border border-[#e5dec9] px-2.5 py-1">
                      <Clock3 size={13} className="text-gray-500" />
                      {seller.horario_atencion}
                    </span>
                  )}
                </div>
              )}

              {specialtyZones.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mr-1">
                    {isEnglish ? 'Specialties:' : 'Zonas clave:'}
                  </span>
                  {specialtyZones.map((zone) => (
                    <span
                      key={zone}
                      className="rounded-full bg-[#16294B]/8 text-[#16294B] px-2.5 py-0.5 text-xs font-medium"
                    >
                      {zone}
                    </span>
                  ))}
                </div>
              )}

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
                  <TrackedContactLink
                    className="seller-profile-card__whatsapp"
                    href={`https://wa.me/${phoneDigits}`}
                    channel="whatsapp"
                    sellerId={seller.id}
                    external
                  >
                    WhatsApp <ArrowUpRight size={15} />
                  </TrackedContactLink>
                )}
                {callEnabled && (
                  <TrackedContactLink
                    href={`tel:${seller.telefono?.replace(/[^+\d]/g, '')}`}
                    channel="llamar"
                    sellerId={seller.id}
                    external
                  >
                    <Phone size={14} />
                    {t('call')}
                  </TrackedContactLink>
                )}
                {emailEnabled && (
                  <TrackedContactLink
                    href={`mailto:${seller.email_publico}`}
                    channel="email"
                    sellerId={seller.id}
                    external
                  >
                    <Mail size={14} />
                    {t('email')}
                  </TrackedContactLink>
                )}
                {firstPropertyChat && (
                  <LocalLink href={firstPropertyChat}>
                    <MessageSquare size={14} />
                    {t('sendMessage')}
                  </LocalLink>
                )}
                {seller.redes_sociales?.instagram && (
                  <a
                    href={seller.redes_sociales.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1"
                  >
                    Instagram <ArrowUpRight size={13} />
                  </a>
                )}
                {seller.redes_sociales?.web && (
                  <a
                    href={seller.redes_sociales.web}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1"
                  >
                    <Globe size={13} /> Web
                  </a>
                )}
              </div>
            </div>
          </div>
          {seller.verificado && (
            <p className="seller-profile-card__trust">
              <ShieldCheck size={15} />
              {t('verifiedSummary')}
            </p>
          )}
        </section>

        {isAgencyOwnerStorefront && teamMembers.length > 1 && (
          <section
            className="bg-white border border-[#E5DEC9] rounded-2xl p-6 mb-7"
            aria-labelledby="agency-team-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <p className="seller-page__eyebrow flex items-center gap-1.5">
                  <Users size={13} />
                  {isEnglish ? 'Official Advisory Team' : 'Equipo de Asesores'}
                </p>
                <h2 id="agency-team-heading" className="text-xl font-bold text-gray-900">
                  {isEnglish ? `Advisors at ${sellerName}` : `Asesores de ${sellerName}`}
                </h2>
              </div>
              {selectedAdvisorId !== 'todos' && (
                <button
                  type="button"
                  onClick={() => setSelectedAdvisorId('todos')}
                  className="text-xs font-bold text-brand-primary hover:underline"
                >
                  {isEnglish ? 'Show all agency listings' : 'Ver toda la cartera'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {teamMembers.map((member) => {
                const active = selectedAdvisorId === member.id
                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                      active
                        ? 'bg-[#FAF8F4] border-brand-primary ring-1 ring-brand-primary'
                        : 'bg-[#FAF8F4]/60 border-[#ECE5D5] hover:border-[#D4C8AE]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedAdvisorId(active ? 'todos' : member.id)}
                      className="flex items-center gap-2.5 text-left"
                    >
                      <Avatar
                        nombre={member.nombre || 'A'}
                        fotoUrl={member.foto_perfil_url}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1">
                          {member.nombre}
                          {member.verificado && (
                            <ShieldCheck size={13} className="text-emerald-600" />
                          )}
                        </p>
                        {member.ciudad && (
                          <p className="text-[11px] text-gray-500">{member.ciudad}</p>
                        )}
                      </div>
                    </button>
                    {member.id !== seller.id && (
                      <LocalLink
                        href={`/vendedor/${member.slug || member.id}`}
                        className="text-gray-400 hover:text-brand-primary p-1"
                        aria-label={member.nombre || 'Advisor'}
                      >
                        <ArrowUpRight size={14} />
                      </LocalLink>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="seller-profile-grid">
          <section className="seller-page__listings" aria-labelledby="seller-properties-title">
            <div className="seller-page__section-heading">
              <div>
                <p className="seller-page__eyebrow">{t('availableNow')}</p>
                <h2 id="seller-properties-title">{t('propertiesBy', { name: sellerName })}</h2>
              </div>
              <span>{filteredProperties.length}</span>
            </div>

            {/* Barra de filtrado rápido del Escaparate Pro */}
            {properties.length > 1 && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-white border border-[#E5DEC9] p-2.5">
                <div className="inline-flex rounded-lg bg-[#FAF8F4] p-0.5 text-xs">
                  {(
                    [
                      { id: 'todos', label: isEnglish ? 'All' : 'Todos' },
                      { id: 'venta', label: isEnglish ? 'For Sale' : 'Venta' },
                      { id: 'alquiler', label: isEnglish ? 'For Rent' : 'Alquiler' },
                    ] as const
                  ).map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setOperationFilter(op.id)}
                      className={`rounded-md px-3 py-1 font-semibold transition ${
                        operationFilter === op.id
                          ? 'bg-[#16294B] text-white'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial">
                  <div className="relative flex-1 sm:w-48">
                    <Search
                      size={13}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isEnglish ? 'Zone or type…' : 'Zona o tipo…'}
                      className="w-full rounded-lg border border-gray-200 bg-white pl-7 pr-2.5 py-1 text-xs"
                    />
                  </div>
                  <select
                    aria-label={isEnglish ? 'Sort portfolio' : 'Ordenar cartera'}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
                  >
                    <option value="recent">{isEnglish ? 'Newest' : 'Recientes'}</option>
                    <option value="price_asc">{isEnglish ? 'Lowest price' : 'Menor precio'}</option>
                    <option value="price_desc">{isEnglish ? 'Highest price' : 'Mayor precio'}</option>
                  </select>
                </div>
              </div>
            )}

            {filteredProperties.length === 0 ? (
              <div className="seller-page__empty">
                <p>{t('noListings')}</p>
              </div>
            ) : (
              <div className="seller-property-grid">
                {filteredProperties.map((property) => {
                  const image = property.main_image_url || property.imagen_url
                  const amount = Number(property.precio || 0)
                  const currency =
                    typeof property.moneda === 'string' && /^[A-Z]{3}$/i.test(property.moneda)
                      ? property.moneda.toUpperCase()
                      : 'USD'
                  const price =
                    amount > 0
                      ? new Intl.NumberFormat(isEnglish ? 'en-US' : 'es-VE', {
                          style: 'currency',
                          currency,
                          maximumFractionDigits: 0,
                        }).format(amount)
                      : t('priceOnRequest')
                  return (
                    <LocalLink
                      key={property.id}
                      href={`/inmueble/${property.slug || property.id}`}
                      className="seller-property-card"
                    >
                      <div className="seller-property-card__media">
                        {image ? (
                          <Image
                            src={image}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 90vw, (max-width: 1000px) 45vw, 29vw"
                            unoptimized={!isOptimizableImageSrc(image)}
                          />
                        ) : (
                          <span>{t('noPhoto')}</span>
                        )}
                        {property.operacion_nombre && (
                          <span className="seller-property-card__operation">
                            {property.operacion_nombre}
                          </span>
                        )}
                      </div>
                      <div className="seller-property-card__body">
                        <p>
                          {[property.zona, property.ciudad, property.estado]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                        <h3>{property.titulo}</h3>
                        {isAgencyOwnerStorefront &&
                          property.agente_nombre &&
                          property.agente_asignado_id !== seller.id && (
                            <span className="text-[11px] text-gray-500 block mb-1">
                              {isEnglish
                                ? `Advisor: ${property.agente_nombre}`
                                : `Atiende: ${property.agente_nombre}`}
                            </span>
                          )}
                        <div>
                          <strong>{price}</strong>
                          <ArrowUpRight size={16} />
                        </div>
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
              <span>
                <Star size={13} fill="currentColor" /> {reviews.length ? average.toFixed(1) : '—'}
              </span>
            </div>

            {distribution.total > 0 && (
              <div className="mb-4 rounded-xl bg-[#FAF8F4] border border-[#E5DEC9] p-3.5 space-y-1.5">
                {([5, 4, 3, 2, 1] as const).map((star) => {
                  const cnt = distribution.countsByStar[star]
                  const pct =
                    distribution.total > 0 ? Math.round((cnt / distribution.total) * 100) : 0
                  return (
                    <div key={star} className="flex items-center gap-2 text-[11px]">
                      <span className="w-7 font-bold text-gray-700">{star}★</span>
                      <div className="flex-1 h-1.5 rounded-full bg-[#E8E2D4] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#C59B27]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-gray-500">{cnt}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="seller-page__empty seller-page__empty--reviews">
                <Star size={24} />
                <p>{t('noReviews')}</p>
              </div>
            ) : (
              <div className="seller-review-list">
                {reviews.slice(0, 10).map((review) => {
                  const reviewDate = new Date(review.creado_en)
                  return (
                    <article key={review.id} className="seller-review-card">
                      <div className="seller-review-card__top">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="seller-review-card__stars"
                            aria-label={`${review.puntuacion} / 5`}
                          >
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                size={12}
                                className={
                                  index < Math.round(review.puntuacion) ? 'is-filled' : ''
                                }
                              />
                            ))}
                          </div>
                          {review.autor_nombre && (
                            <span className="text-[11px] font-semibold text-gray-700">
                              {review.autor_nombre}
                            </span>
                          )}
                        </div>
                        {!Number.isNaN(reviewDate.getTime()) && (
                          <time>{dateFormatter.format(reviewDate)}</time>
                        )}
                      </div>

                      <div className="mt-1 mb-1.5">{renderOriginTag(review.tipo_interaccion)}</div>

                      {review.comentario && <p>{review.comentario}</p>}
                      {review.producto_titulo && (
                        <span>
                          {t('reviewFor')}: {review.producto_titulo}
                        </span>
                      )}

                      {review.respuesta_vendedor && (
                        <div className="mt-2.5 rounded-lg bg-[#FAF8F4] border-l-2 border-[#16294B] px-3 py-2 text-xs">
                          <strong className="block text-[#16294B] text-[11px] mb-0.5">
                            {isEnglish ? 'Advisor response:' : 'Respuesta del asesor:'}
                          </strong>
                          <p className="m-0 text-gray-700">{review.respuesta_vendedor}</p>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
