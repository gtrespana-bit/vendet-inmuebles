import type { MapProperty } from '@/components/map/PropertyMap'

type DemoListing = {
  id: string
  titleEs: string
  titleEn: string
  price: number
  currency: string
  operationEs: string
  operationEn: string
  city: string
  state: string
  image: string
  bedrooms: number
  bathrooms: number
  area: number
  lat: number
  lng: number
  featured?: boolean
}

/**
 * Fichas de ejemplo para la demo pública del mapa: se muestran solo cuando la
 * base de datos no devuelve inmuebles y siempre van marcadas como muestra.
 */
const DEMO_LISTINGS: DemoListing[] = [
  {
    id: 'demo-villa-chorros',
    titleEs: 'Villa contemporánea con jardín',
    titleEn: 'Contemporary villa with garden',
    price: 890000,
    currency: 'USD',
    operationEs: 'Venta',
    operationEn: 'Sale',
    city: 'Caracas',
    state: 'Miranda',
    image: '/demo/villa-caracas.jpg',
    bedrooms: 4,
    bathrooms: 5,
    area: 620,
    lat: 10.4952,
    lng: -66.8237,
    featured: true,
  },
  {
    id: 'demo-apartamento-altamira',
    titleEs: 'Apartamento luminoso con vista a la montaña',
    titleEn: 'Bright apartment with hillside views',
    price: 1250,
    currency: 'USD',
    operationEs: 'Alquiler',
    operationEn: 'Rent',
    city: 'Caracas',
    state: 'Distrito Capital',
    image: '/demo/apartamento-salon.jpg',
    bedrooms: 3,
    bathrooms: 3,
    area: 185,
    lat: 10.4961,
    lng: -66.8517,
    featured: true,
  },
  {
    id: 'demo-penthouse-lecheria',
    titleEs: 'Penthouse con terraza privada',
    titleEn: 'Penthouse with private terrace',
    price: 465000,
    currency: 'USD',
    operationEs: 'Venta',
    operationEn: 'Sale',
    city: 'Lechería',
    state: 'Anzoátegui',
    image: '/demo/terraza-lecheria.jpg',
    bedrooms: 3,
    bathrooms: 4,
    area: 240,
    lat: 10.1833,
    lng: -64.6833,
    featured: true,
  },
  {
    id: 'demo-casa-maracaibo',
    titleEs: 'Casa familiar en Los Olivos',
    titleEn: 'Family home in Los Olivos',
    price: 285000,
    currency: 'USD',
    operationEs: 'Venta',
    operationEn: 'Sale',
    city: 'Maracaibo',
    state: 'Zulia',
    image: '/demo/villa-caracas.jpg',
    bedrooms: 4,
    bathrooms: 3,
    area: 310,
    lat: 10.6427,
    lng: -71.6125,
  },
  {
    id: 'demo-apartamento-valencia',
    titleEs: 'Apartamento en torre con vigilancia',
    titleEn: 'Apartment in a guarded tower',
    price: 950,
    currency: 'USD',
    operationEs: 'Alquiler',
    operationEn: 'Rent',
    city: 'Valencia',
    state: 'Carabobo',
    image: '/demo/apartamento-salon.jpg',
    bedrooms: 2,
    bathrooms: 2,
    area: 118,
    lat: 10.162,
    lng: -68.0077,
  },
  {
    id: 'demo-local-barquisimeto',
    titleEs: 'Local comercial en avenida principal',
    titleEn: 'Retail space on the main avenue',
    price: 1800,
    currency: 'USD',
    operationEs: 'Alquiler',
    operationEn: 'Rent',
    city: 'Barquisimeto',
    state: 'Lara',
    image: '/demo/terraza-lecheria.jpg',
    bedrooms: 0,
    bathrooms: 2,
    area: 145,
    lat: 10.0678,
    lng: -69.3475,
  },
  {
    id: 'demo-casa-porlamar',
    titleEs: 'Casa a minutos de Playa El Yaque',
    titleEn: 'Home minutes from El Yaque beach',
    price: 395000,
    currency: 'USD',
    operationEs: 'Venta',
    operationEn: 'Sale',
    city: 'Porlamar',
    state: 'Nueva Esparta',
    image: '/demo/villa-caracas.jpg',
    bedrooms: 3,
    bathrooms: 3,
    area: 265,
    lat: 10.9577,
    lng: -63.8697,
  },
  {
    id: 'demo-casa-merida',
    titleEs: 'Casa de montaña con chimenea',
    titleEn: 'Mountain house with fireplace',
    price: 210000,
    currency: 'USD',
    operationEs: 'Venta',
    operationEn: 'Sale',
    city: 'Mérida',
    state: 'Mérida',
    image: '/demo/terraza-lecheria.jpg',
    bedrooms: 3,
    bathrooms: 2,
    area: 220,
    lat: 8.5897,
    lng: -71.1561,
  },
]

export function demoMapProperties(locale: string): MapProperty[] {
  const english = locale === 'en'
  return DEMO_LISTINGS.map((item) => ({
    id: item.id,
    title: english ? item.titleEn : item.titleEs,
    price: item.price,
    currency: item.currency,
    operation: english ? item.operationEn : item.operationEs,
    location: `${item.city}, ${item.state}`,
    image: item.image,
    bedrooms: item.bedrooms || null,
    bathrooms: item.bathrooms || null,
    area: item.area,
    lat: item.lat,
    lng: item.lng,
    approximate: false,
    featured: Boolean(item.featured),
  }))
}
