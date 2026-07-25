/**
 * Tipos TypeScript para el módulo de Inmuebles
 * 
 * NOTA: Estos tipos deben coincidir con las columnas devueltas por la vista 'vw_inmuebles_api'
 */

export interface Property {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  operacion_slug: 'venta' | 'alquiler';
  tipo_slug: 'casa' | 'apartamento' | 'terreno' | 'local' | 'oficina' | 'galpon' | 'finca' | 'cabana' | 'townhouse' | 'penthouse' | 'otros';
  precio: number;
  moneda: 'USD' | 'EUR' | 'VES';
  estado: string;
  ciudad: string;
  municipio: string | null;
  direccion_exacta: string | null;
  latitud: number | null;
  longitud: number | null;
  
  // Características físicas
  area_total: number | null; // m² totales
  area_construida: number | null; // m² construidos
  habitaciones: number | null;
  banos: number | null;
  puestos_estacionamiento: number | null;
  piso: number | null;
  antiguedad_anios: number | null;
  
  // Estado y disponibilidad
  activo: boolean;
  destacado: boolean;
  
  // Amenities (JSON array) - viene de inmueble_caracteristicas si se agrega
  amenities: string[] | null;
  
  // Multimedia - viene como JSON de la vista
  imagenes_json: Array<{
    url_imagen: string;
    orden: number | null;
    es_portada: boolean | null;
  }> | null;
  
  // Campos calculados para compatibilidad con componentes existentes
  title: string;
  description: string | null;
  operation_type: 'venta' | 'alquiler';
  property_type: string;
  price: number;
  currency: string;
  state_id: string;
  state_name: string;
  city_id: string;
  city_name: string;
  municipality_id: string | null;
  municipality_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  area_size: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  floors: number | null;
  year_built: number | null;
  status: 'active' | 'inactive' | 'sold' | 'rented' | 'reserved';
  featured: boolean;
  main_image_url: string | null;
  images: string[] | null;
  video_url: string | null;
  virtual_tour_url: string | null;
  owner_id: string;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  agency_name: string | null;
  agency_logo_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  last_activity: string | null;
  views_count: number;
  contacts_count: number;
  favorites_count: number;
}

export interface PropertyFilter {
  operation_type?: 'venta' | 'alquiler';
  property_type?: string[];
  state_id?: string;
  city_id?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_area?: number;
  amenities?: string[];
  featured_only?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'featured';
}

export interface PropertyAmenity {
  id: string;
  name: string;
  icon: string | null;
  category: 'general' | 'security' | 'services' | 'recreation' | 'comfort';
}
