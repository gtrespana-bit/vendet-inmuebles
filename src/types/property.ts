/**
 * Tipos TypeScript para el módulo de Inmuebles
 */

export interface Property {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  operation_type: 'venta' | 'alquiler';
  property_type: 'casa' | 'apartamento' | 'terreno' | 'local' | 'oficina' | 'galpon' | 'finca' | 'otros';
  price: number;
  currency: 'USD' | 'EUR' | 'VES';
  state_id: string;
  state_name: string;
  city_id: string;
  city_name: string;
  municipality_id: string | null;
  municipality_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  
  // Características físicas
  area_total: number | null; // m² totales
  area_construida: number | null; // m² construidos
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  floors: number | null;
  year_built: number | null;
  
  // Estado y disponibilidad
  status: 'active' | 'inactive' | 'sold' | 'rented' | 'reserved';
  featured: boolean;
  
  // Amenities (JSON array)
  amenities: string[] | null;
  
  // Multimedia
  main_image_url: string | null;
  images: string[] | null;
  video_url: string | null;
  virtual_tour_url: string | null;
  
  // Contacto y propietario
  owner_id: string;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  agency_name: string | null;
  agency_logo_url: string | null;
  
  // SEO
  meta_title: string | null;
  meta_description: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at: string | null;
  last_activity: string | null;
  
  // Métricas
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
