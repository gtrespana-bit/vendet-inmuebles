import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ParkingSquare,
  Clock3,
  Eye,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Ruler,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase-server'
import { isValidUUID } from '@/lib/validation'
import { buildPageAlternates } from '@/lib/seo-metadata'
import { claveAmenidad, leerAmenidades, ordenAmenidad } from '@/lib/amenities'
import PropertyGallery from '@/components/PropertyGallery'
import TrackInmueble from '@/components/TrackInmueble'
import PropertyDetailActions from '@/components/PropertyDetailActions'
import PropertyLocationMap from '@/components/map/PropertyLocationMap'
import { jitterPoint, resolveListingGeo } from '@/lib/geo/venezuela'
import { resolverContactoPublicacion, telHref, whatsappHref, mensajeWhatsappPredeterminado } from '@/lib/contact-methods'

// Listing edits (fotos, ambientes, servicios, contacto…) deben aparecer de
// inmediato: nada de caché de ruta ni de respuestas de Supabase.
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

interface PageProps {
  params: Promise<{ id: string; locale: string }>
}

type PropertyRecord = Record<string, any>

const getPublicProperty = cache(async function getPublicProperty(identifier: string): Promise<PropertyRecord | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  try {
    const supabase = createServerClient()
    if (isValidUUID(identifier)) {
      const byId = await supabase
        .from('vw_propiedades_publicas')
        .select('*')
        .eq('id', identifier)
        .eq('activo', true)
        .maybeSingle()

      if (byId.data) return byId.data as PropertyRecord
    }

    // Cards may use a public slug. Resolve it directly without wasting an invalid-UUID query.
    const bySlug = await supabase
      .from('vw_propiedades_publicas')
      .select('*')
      .eq('slug', identifier)
      .eq('activo', true)
      .maybeSingle()

    return (bySlug.data as PropertyRecord | null) || null
  } catch (error) {
    console.error('[property-detail] Could not load public property:', error)
    return null
  }
})

function getPropertyImages(property: PropertyRecord): string[] {
  const images: string[] = []
  const collections = [property.imagenes_urls, property.imagenes]

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue
    for (const image of collection) {
      const url = typeof image === 'string'
        ? image
        : image?.url_imagen || image?.url || image?.publicUrl || image?.src
      if (typeof url === 'string' && url.trim() && !images.includes(url)) images.push(url)
    }
  }

  const cover = property.main_image_url || property.imagen_portada || property.imagen_url
  if (typeof cover === 'string' && cover.trim() && !images.includes(cover)) images.unshift(cover)
  return images.length ? images : ['/sinimagen.webp']
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function getFormattedPrice(property: PropertyRecord, locale: string): string {
  const amount = Number(property.precio ?? property.price ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return locale === 'en' ? 'Price on request' : 'Consultar precio'

  const currency = typeof property.moneda === 'string' && /^[A-Z]{3}$/i.test(property.moneda)
    ? property.moneda.toUpperCase()
    : 'USD'
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-VE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-VE').format(amount)}`
  }
}

function formatDate(value: unknown, locale: string): string | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-VE', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, locale } = await params
  const property = await getPublicProperty(id)
  if (!property) {
    return { title: locale === 'en' ? 'Property not found' : 'Inmueble no encontrado', robots: { index: false, follow: false } }
  }

  const title = String(property.titulo || (locale === 'en' ? 'Property in Venezuela' : 'Inmueble en Venezuela'))
  const location = [property.ciudad, property.estado].filter(Boolean).join(', ')
  const description = String(property.meta_descripcion || property.descripcion || '').replace(/\s+/g, ' ').slice(0, 160)
  const canonicalId = property.slug || property.id
  const localizedPath = `${locale === 'en' ? '/en' : ''}/inmueble/${canonicalId}`
  const operation = String(property.operacion_nombre || property.tipo_operacion || '').toLowerCase().includes('alquiler')
    ? (locale === 'en' ? 'For rent' : 'En alquiler')
    : (locale === 'en' ? 'For sale' : 'En venta')

  return {
    title: `${operation}: ${title}${location ? ` · ${location}` : ''}`,
    description: description || (locale === 'en'
      ? `Explore this property${location ? ` in ${location}` : ' in Venezuela'} on Venezuela Inmuebles.`
      : `Conoce este inmueble${location ? ` en ${location}` : ' en Venezuela'} en Venezuela Inmuebles.`),
    alternates: buildPageAlternates(locale, `/inmueble/${canonicalId}`),
    openGraph: {
      type: 'website',
      title: `${title} · Venezuela Inmuebles`,
      description,
      url: `https://venezuela-inmuebles.online${localizedPath}`,
      images: property.main_image_url ? [{ url: property.main_image_url, alt: title }] : undefined,
    },
  }
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { id, locale: requestedLocale } = await params
  const locale = requestedLocale === 'en' ? 'en' : 'es'
  const property = await getPublicProperty(id)
  if (!property) notFound()

  const isEnglish = locale === 'en'
  const title = String(property.titulo || (isEnglish ? 'Property in Venezuela' : 'Inmueble en Venezuela'))
  const operationName = String(property.operacion_nombre || property.tipo_operacion || '').toLowerCase()
  const isRent = operationName.includes('alquiler') || operationName.includes('rent')
  const operationLabel = isRent ? (isEnglish ? 'For rent' : 'En alquiler') : (isEnglish ? 'For sale' : 'En venta')
  const propertyType = String(property.tipo_nombre || property.tipo_propiedad || (isEnglish ? 'Property' : 'Inmueble'))
  const propertyId = String(property.id)
  const ownerId = String(property.usuario_id || property.user_id || property.propietario_id || '')
  const images = getPropertyImages(property)
  const price = getFormattedPrice(property, locale)
  const currencyCode = typeof property.moneda === 'string' && /^[A-Z]{3}$/i.test(property.moneda)
    ? property.moneda.toUpperCase()
    : 'USD'
  const location = [property.zona, property.ciudad, property.estado].filter(Boolean).join(', ')
  const ownerName = String(property.propietario_nombre || property.propietario_empresa || (isEnglish ? 'Property owner' : 'Propietario'))
  const ownerType = property.propietario_tipo === 'empresa'
    ? (isEnglish ? 'Real estate professional' : 'Profesional inmobiliario')
    : (isEnglish ? 'Private owner' : 'Propietario particular')
  const isVerified = property.propietario_verificado === true || Number(property.nivel_confianza || 0) > 50
  // Todos los ambientes/servicios guardados, ordenados como el catálogo y con
  // la etiqueta traducida cuando la característica es conocida.
  const tAmenity = await getTranslations({ locale, namespace: 'catalog.extra.amenity' })
  const features = leerAmenidades(property.caracteristicas)
    .sort((a, b) => ordenAmenidad(a) - ordenAmenidad(b))
    .map((nombre) => {
      const clave = claveAmenidad(nombre)
      if (!clave) return nombre
      try {
        return tAmenity(clave)
      } catch {
        return nombre
      }
    })
  const createdAt = formatDate(property.publicado_en || property.creado_en, locale)
  const chatPath = `/chat?producto_id=${encodeURIComponent(propertyId)}&vendedor_id=${encodeURIComponent(ownerId)}`
  const chatHref = `${isEnglish ? '/en' : ''}${chatPath}`
  // Contacto elegido en el anuncio (chat siempre activo; teléfono/WhatsApp opcionales).
  // Si la publicación no configuró métodos (null), se usa el teléfono del perfil
  // como hasta ahora; si eligió (objeto, aunque esté vacío), se respeta su elección.
  const contacto = resolverContactoPublicacion(property)
  const anuncioUrl = `https://venezuela-inmuebles.online${isEnglish ? '/en' : ''}/inmueble/${property.slug || propertyId}`
  const mensajeWa = mensajeWhatsappPredeterminado(title, anuncioUrl, isEnglish)
  const hrefLlamar = contacto.telLlamadas ? telHref(contacto.telLlamadas) : null
  const hrefWhatsapp = contacto.telWhatsapp ? whatsappHref(contacto.telWhatsapp, mensajeWa) : null
  const sellerHref = ownerId ? `${isEnglish ? '/en' : ''}/vendedor/${ownerId}` : null
  const coordinates = property.latitud && property.longitud
    ? `${property.latitud},${property.longitud}`
    : null

  const geo = resolveListingGeo({
    latitud: property.latitud,
    longitud: property.longitud,
    ciudad: property.ciudad,
    municipio: property.municipio,
    estado: property.estado,
    zona: property.zona,
  })
  const mapPoint = geo.point
    ? geo.approximate
      ? jitterPoint(geo.point, propertyId)
      : geo.point
    : null
  const mapItem = mapPoint
    ? {
        id: propertyId,
        title,
        price: Number(property.precio) || 0,
        currency: currencyCode,
        operation: operationLabel,
        location,
        image: images[0] || property.main_image_url || null,
        href: `/${isEnglish ? 'en/' : ''}inmueble/${property.slug || propertyId}`,
        bedrooms: property.habitaciones == null ? null : Number(property.habitaciones),
        bathrooms: property.banos == null ? null : Number(property.banos),
        area: property.area_total == null ? null : Number(property.area_total),
        lat: mapPoint.lat,
        lng: mapPoint.lng,
        approximate: geo.approximate,
        featured: Boolean(property.destacado),
      }
    : null
  const mapLabels = {
    approximate: isEnglish ? 'Approximate location' : 'Ubicación aproximada',
    exact: isEnglish ? 'Exact location' : 'Ubicación exacta',
    viewListing: isEnglish ? 'View listing' : 'Ver ficha',
    bedrooms: isEnglish ? 'bed' : 'hab.',
    bathrooms: isEnglish ? 'bath' : 'baños',
    area: isEnglish ? 'sq ft' : 'm²',
    empty: isEnglish ? 'No location available.' : 'Sin ubicación disponible.',
    zoomIn: isEnglish ? 'Zoom in' : 'Acercar',
    zoomOut: isEnglish ? 'Zoom out' : 'Alejar',
    resetView: isEnglish ? 'Reset view' : 'Centrar',
  }
  const osmHref = mapPoint
    ? `https://www.openstreetmap.org/?mlat=${mapPoint.lat.toFixed(5)}&mlon=${mapPoint.lng.toFixed(5)}#map=15/${mapPoint.lat.toFixed(5)}/${mapPoint.lng.toFixed(5)}`
    : coordinates
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(coordinates)}`
      : 'https://www.openstreetmap.org/'

  const labels = {
    save: isEnglish ? 'Save' : 'Guardar',
    saved: isEnglish ? 'Saved' : 'Guardado',
    share: isEnglish ? 'Share' : 'Compartir',
    copied: isEnglish ? 'Link copied' : 'Enlace copiado',
    error: isEnglish ? 'Something went wrong. Please try again.' : 'Algo salió mal. Inténtalo de nuevo.',
    signIn: isEnglish ? 'Sign in to save this property' : 'Inicia sesión para guardar este inmueble',
  }

  const factItems = [
    { label: isEnglish ? 'Bedrooms' : 'Habitaciones', value: property.habitaciones, icon: BedDouble },
    { label: isEnglish ? 'Bathrooms' : 'Baños', value: property.banos, icon: Bath },
    { label: isEnglish ? 'Built area' : 'Área construida', value: property.area_construida, suffix: 'm²', icon: Building2 },
    { label: isEnglish ? 'Land area' : 'Área total', value: property.area_total, suffix: 'm²', icon: Ruler },
    { label: isEnglish ? 'Parking spaces' : 'Puestos de estacionamiento', value: property.puestos_estacionamiento, icon: ParkingSquare },
    { label: isEnglish ? 'Floor' : 'Piso', value: property.piso, icon: Building2 },
  ].filter((fact) => isPresent(fact.value))

  return (
    <>
      <TrackInmueble id={propertyId} />
    <div className="property-detail">
      <main className="property-detail__inner">
        <nav className="property-detail__breadcrumb" aria-label={isEnglish ? 'Breadcrumb' : 'Ruta de navegación'}>
          <Link href={isEnglish ? '/en' : '/'}>{isEnglish ? 'Home' : 'Inicio'}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`${isEnglish ? '/en' : ''}/catalogo`}>{isEnglish ? 'Properties' : 'Inmuebles'}</Link>
          <span aria-hidden="true">/</span>
          <span className="property-detail__breadcrumb-current">{title}</span>
        </nav>

        <header className="property-detail__heading">
          <div className="property-detail__heading-main">
            <div className="property-detail__eyebrow-row">
              <span className="property-detail__eyebrow">{operationLabel}</span>
              <span className="property-detail__type">{propertyType}</span>
              {property.destacado && <span className="property-detail__featured"><Sparkles size={13} /> {isEnglish ? 'Featured' : 'Destacado'}</span>}
            </div>
            <h1>{title}</h1>
            {location && <p className="property-detail__location"><MapPin size={17} aria-hidden="true" /><span>{location}</span></p>}
          </div>
          <PropertyDetailActions
            propertyId={propertyId}
            title={title}
            locale={locale}
            labels={labels}
          />
        </header>

        <PropertyGallery images={images} title={title} locale={locale} />

        <div className="property-detail__content-grid">
          <div className="property-detail__main-column">
            <section className="property-detail__panel property-detail__facts" aria-labelledby="property-facts-title">
              <div className="property-detail__section-heading">
                <div>
                  <p className="property-detail__section-kicker">{isEnglish ? 'At a glance' : 'En resumen'}</p>
                  <h2 id="property-facts-title">{isEnglish ? 'Property details' : 'Características del inmueble'}</h2>
                </div>
                {property.condicion && <span className="property-detail__condition"><Check size={14} /> {String(property.condicion)}</span>}
              </div>
              {factItems.length > 0 ? (
                <div className="property-detail__fact-grid">
                  {factItems.map(({ label, value, suffix, icon: Icon }) => (
                    <div className="property-detail__fact" key={label}>
                      <span className="property-detail__fact-icon"><Icon size={19} aria-hidden="true" /></span>
                      <span className="property-detail__fact-value">
                        {new Intl.NumberFormat(isEnglish ? 'en-US' : 'es-VE').format(Number(value))}{suffix ? ` ${suffix}` : ''}
                      </span>
                      <span className="property-detail__fact-label">{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="property-detail__muted">{isEnglish ? 'The owner has not added detailed measurements yet.' : 'El propietario aún no ha añadido medidas detalladas.'}</p>
              )}
              {(isPresent(property.antiguedad_anios) || property.condicion) && (
                <div className="property-detail__extra-facts">
                  {isPresent(property.antiguedad_anios) && <span>{isEnglish ? 'Age' : 'Antigüedad'}: <strong>{property.antiguedad_anios} {isEnglish ? 'years' : 'años'}</strong></span>}
                  {property.condicion && <span>{isEnglish ? 'Condition' : 'Condición'}: <strong>{String(property.condicion)}</strong></span>}
                </div>
              )}
            </section>

            <section className="property-detail__panel" aria-labelledby="property-description-title">
              <div className="property-detail__section-heading">
                <div>
                  <p className="property-detail__section-kicker">{isEnglish ? 'The story of this space' : 'Lo que hace especial este espacio'}</p>
                  <h2 id="property-description-title">{isEnglish ? 'About this property' : 'Sobre este inmueble'}</h2>
                </div>
              </div>
              {property.descripcion ? (
                <p className="property-detail__description">{String(property.descripcion)}</p>
              ) : (
                <p className="property-detail__muted">{isEnglish ? 'No description has been provided.' : 'El propietario no ha añadido una descripción.'}</p>
              )}
            </section>

            {features.length > 0 && (
              <section className="property-detail__panel" aria-labelledby="property-features-title">
                <div className="property-detail__section-heading">
                  <div>
                    <p className="property-detail__section-kicker">{isEnglish ? 'Comfort & lifestyle' : 'Comodidad y estilo de vida'}</p>
                    <h2 id="property-features-title">{isEnglish ? 'Features and amenities' : 'Ambientes y servicios'}</h2>
                  </div>
                </div>
                <ul className="property-detail__amenities">
                  {features.map((feature, index) => <li key={`${feature}-${index}`}><Check size={15} aria-hidden="true" />{feature}</li>)}
                </ul>
              </section>
            )}

            <section className="property-detail__panel property-detail__location-panel" aria-labelledby="property-location-title">
              <div className="property-detail__section-heading">
                <div>
                  <p className="property-detail__section-kicker">{isEnglish ? 'Explore the area' : 'Explora la zona'}</p>
                  <h2 id="property-location-title">{isEnglish ? 'Location' : 'Ubicación'}</h2>
                </div>
                <MapPin size={20} aria-hidden="true" />
              </div>
              <p className="property-detail__location-name">{location || (isEnglish ? 'Venezuela' : 'Venezuela')}</p>
              {property.direccion && <p className="property-detail__muted">{String(property.direccion)}</p>}
              {mapItem && (
                <PropertyLocationMap
                  item={mapItem}
                  labels={mapLabels}
                  locale={locale}
                  osmHref={osmHref}
                  openLabel={isEnglish ? 'Open in OpenStreetMap' : 'Abrir en OpenStreetMap'}
                  approximateLabel={isEnglish ? 'Approximate area shown' : 'Se muestra la zona aproximada'}
                  note={
                    geo.approximate
                      ? isEnglish
                        ? 'The pin marks the city area; the exact address is shared by the owner.'
                        : 'El pin marca la zona de la ciudad; la dirección exacta la comparte el propietario.'
                      : undefined
                  }
                />
              )}
              {!mapItem && <p className="property-detail__muted">{isEnglish ? 'The exact location is shared by the owner.' : 'La ubicación exacta se coordina directamente con el propietario.'}</p>}
            </section>
          </div>

          <aside className="property-detail__aside" aria-label={isEnglish ? 'Contact the owner' : 'Contactar al propietario'}>
            <section className="property-contact-card">
              <div className="property-contact-card__price-row">
                <div>
                  <p className="property-contact-card__price-label">{isEnglish ? 'Asking price' : 'Precio publicado'}</p>
                  <p className="property-contact-card__price">{price}</p>
                </div>
                <span className="property-contact-card__currency">{currencyCode}</span>
              </div>
              <div className="property-contact-card__divider" />

              <div className="property-contact-card__owner">
                <div className="property-contact-card__avatar">
                  {property.propietario_foto ? (
                    <Image
                      src={String(property.propietario_foto)}
                      alt=""
                      width={54}
                      height={54}
                      unoptimized
                    />
                  ) : (
                    <span aria-hidden="true">{ownerName.trim().charAt(0).toUpperCase()}</span>
                  )}
                  {isVerified && <span className="property-contact-card__verified"><ShieldCheck size={14} /></span>}
                </div>
                <div className="property-contact-card__owner-info">
                  <p className="property-contact-card__owner-label">{isEnglish ? 'Listed by' : 'Publicado por'}</p>
                  <p className="property-contact-card__owner-name">{ownerName}</p>
                  <p className="property-contact-card__owner-type">{ownerType}</p>
                </div>
              </div>

              {isVerified && <p className="property-contact-card__trust"><ShieldCheck size={15} /> {isEnglish ? 'Identity verified' : 'Identidad verificada'}</p>}

              {ownerId && (
                <Link href={chatHref} className="property-contact-card__primary">
                  {isEnglish ? 'Open chat' : 'Abrir chat'} <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              )}
              {(hrefWhatsapp || hrefLlamar || contacto.messenger) && (
                <div className="property-contact-card__secondary-actions">
                  {hrefWhatsapp && (
                    <a className="property-contact-card__whatsapp" href={hrefWhatsapp} target="_blank" rel="noreferrer">
                      <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                    </a>
                  )}
                  {hrefLlamar && (
                    <a href={hrefLlamar}>
                      <Phone size={14} aria-hidden="true" /> {isEnglish ? 'Call' : 'Llamar'}
                    </a>
                  )}
                  {contacto.messenger && (
                    <a href={contacto.messenger} target="_blank" rel="noreferrer">
                      <MessageSquare size={14} aria-hidden="true" /> Messenger
                    </a>
                  )}
                </div>
              )}
              {contacto.email && (
                <a className="property-contact-card__email" href={`mailto:${contacto.email}`}>
                  <Mail size={14} aria-hidden="true" /> {isEnglish ? 'Send an email' : 'Enviar correo'}
                </a>
              )}
              {!ownerId && !hrefWhatsapp && !hrefLlamar && !contacto.email && !contacto.messenger && (
                <p className="property-contact-card__muted">{isEnglish ? 'Contact details are not available yet.' : 'Todavía no hay datos de contacto disponibles.'}</p>
              )}

              <p className="property-contact-card__note">
                {isEnglish ? 'Ask about viewing times, availability and any details you need.' : 'Consulta disponibilidad, horarios para visitar y cualquier detalle que necesites.'}
              </p>
            </section>

            <section className="property-detail__meta">
              <h2>{isEnglish ? 'Listing information' : 'Información del anuncio'}</h2>
              {createdAt && <p><CalendarDays size={15} /> <span>{isEnglish ? 'Published' : 'Publicado'} {createdAt}</span></p>}
              {isPresent(property.visitas) && <p><Eye size={15} /> <span>{new Intl.NumberFormat(isEnglish ? 'en-US' : 'es-VE').format(Number(property.visitas))} {isEnglish ? 'views' : 'visitas'}</span></p>}
              {isPresent(property.antiguedad_anios) && <p><Clock3 size={15} /> <span>{property.antiguedad_anios} {isEnglish ? 'years old' : 'años de antigüedad'}</span></p>}
              <p className="property-detail__meta-id">{isEnglish ? 'Reference' : 'Referencia'} · {propertyId.slice(0, 8).toUpperCase()}</p>
            </section>
          </aside>
        </div>
      </main>

      {ownerId && (
        <div className="property-detail__mobile-contact">
          <div>
            <span>{isEnglish ? 'Asking price' : 'Precio publicado'}</span>
            <strong>{price}</strong>
          </div>
          <div className="property-detail__mobile-contact__actions">
            {hrefWhatsapp && (
              <a href={hrefWhatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="property-detail__mobile-contact__icon property-detail__mobile-contact__icon--wa">
                <MessageCircle size={20} aria-hidden="true" />
              </a>
            )}
            {hrefLlamar && (
              <a href={hrefLlamar} aria-label={isEnglish ? 'Call' : 'Llamar'} className="property-detail__mobile-contact__icon">
                <Phone size={20} aria-hidden="true" />
              </a>
            )}
            <Link href={chatHref}>{isEnglish ? 'Contact' : 'Contactar'} <ArrowUpRight size={16} /></Link>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
