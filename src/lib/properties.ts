/**
 * Funciones para manejar propiedades (inmuebles) desde Supabase
 * Uso exclusivo en Server Components
 * 
 * NOTA: Usa la vista 'vw_inmuebles_api' que es segura (SECURITY INVOKER) 
 * y devuelve datos normalizados listos para usar.
 */

import { createServerClient } from './supabase-server';
import type { Property, PropertyFilter } from '@/types/property';

/**
 * Mapear datos de la vista 'vw_inmuebles_api' al tipo Property
 * La vista ya devuelve los campos en inglés y normalizados
 */
function mapInmuebleToProperty(item: any): Property {
  // La vista ya devuelve imágenes como JSON array ordenado
  const imagenes = item.images || [];
  const imagenPortada = Array.isArray(imagenes) && imagenes.length > 0 
    ? (imagenes[0] as any).url_imagen || item.main_image_url 
    : item.main_image_url;
  
  // Extraer URLs de imágenes si vienen como objetos
  const imagensUrls = Array.isArray(imagenes) 
    ? imagenes.map((img: any) => typeof img === 'string' ? img : img.url_imagen).filter(Boolean)
    : [];

  return {
    id: item.id,
    slug: item.slug || `inmueble-${item.id}`,
    title: item.title || 'Sin título',
    description: item.description || null,
    operation_type: (item.operation_type as 'venta' | 'alquiler') || 'venta',
    property_type: item.property_type || 'casa',
    price: Number(item.price) || 0,
    currency: (item.currency as 'USD' | 'EUR' | 'VES') || 'USD',
    state_name: item.state_name || '',
    city_name: item.city_name || '',
    municipality_name: item.municipality_name || null,
    address: item.address || null,
    latitude: item.latitude ? Number(item.latitude) : null,
    longitude: item.longitude ? Number(item.longitude) : null,
    area_size: item.area_size ? Number(item.area_size) : null,
    bedrooms: item.bedrooms ? Number(item.bedrooms) : null,
    bathrooms: item.bathrooms ? Number(item.bathrooms) : null,
    parking_spaces: item.parking_spaces ? Number(item.parking_spaces) : null,
    floors: item.floors ? Number(item.floors) : null,
    year_built: item.year_built ? Number(item.year_built) : null,
    status: (item.status as 'active' | 'inactive' | 'sold' | 'rented' | 'reserved') || 'active',
    featured: !!item.is_featured,
    amenities: item.amenities || null,
    main_image_url: imagenPortada || null,
    images: imagensUrls.length > 0 ? imagensUrls : (imagenPortada ? [imagenPortada] : null),
    video_url: item.video_url || null,
    virtual_tour_url: item.virtual_tour_url || null,
    owner_id: item.owner_id || '',
    owner_name: item.owner_name || null,
    owner_phone: item.owner_phone || null,
    owner_email: item.owner_email || null,
    agency_name: item.agency_name || null,
    agency_logo_url: item.agency_logo_url || null,
    meta_title: item.meta_title || null,
    meta_description: item.meta_description || null,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || new Date().toISOString(),
    published_at: item.published_at || null,
    last_activity: null,
    views_count: Number(item.views_count) || 0,
    contacts_count: 0,
    favorites_count: 0,
  };
}

/**
 * Obtener lista de propiedades con filtros
 */
export async function getProperties(filters: PropertyFilter = {}): Promise<{
  data: Property[];
  total: number;
  page: number;
  hasMore: boolean;
}> {
  const supabase = createServerClient();
  
  const {
    operation_type,
    property_type,
    state_id,
    city_id,
    min_price,
    max_price,
    min_bedrooms,
    min_bathrooms,
    min_area,
    amenities,
    featured_only,
    page = 1,
    limit = 20,
    sort_by = 'newest'
  } = filters;

  // Construir query base - usando la vista segura 'vw_inmuebles_api'
  let query = supabase
    .from('vw_inmuebles_api')
    .select('*', { count: 'exact' });

  // Aplicar filtros (la vista ya filtra activos por defecto, pero aseguramos)
  if (operation_type) {
    query = query.eq('operation_type', operation_type);
  }
  
  if (property_type && property_type.length > 0) {
    query = query.in('property_type', property_type);
  }
  
  if (state_id) {
    query = query.eq('state_name', state_id);
  }
  
  if (city_id) {
    query = query.eq('city_name', city_id);
  }
  
  if (min_price !== undefined) {
    query = query.gte('price', min_price);
  }
  
  if (max_price !== undefined) {
    query = query.lte('price', max_price);
  }
  
  if (featured_only) {
    query = query.eq('is_featured', true);
  }

  // Ordenamiento
  switch (sort_by) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'featured':
      query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  // Paginación
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching properties:', error);
    throw new Error('Failed to fetch properties');
  }

  // Filtrar por características si es necesario (filtros que no se pueden hacer en SQL directo)
  let inmuebles = data || [];
  
  if (min_bedrooms !== undefined) {
    inmuebles = inmuebles.filter(p => 
      (p.bedrooms || 0) >= min_bedrooms
    );
  }
  
  if (min_bathrooms !== undefined) {
    inmuebles = inmuebles.filter(p => 
      (p.bathrooms || 0) >= min_bathrooms
    );
  }
  
  if (min_area !== undefined) {
    inmuebles = inmuebles.filter(p => 
      (Number(p.area_size) || 0) >= min_area
    );
  }

  return {
    data: inmuebles.map(mapInmuebleToProperty),
    total: count || 0,
    page,
    hasMore: (count || 0) > from + limit
  };
}

/**
 * Obtener una propiedad por ID o SLUG
 */
export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = createServerClient();
  
  // Intentar buscar por ID primero
  let { data, error } = await supabase
    .from('vw_inmuebles_api')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code === 'PGRST116') {
    // Si no encuentra por ID, intentar por slug
    const { data: dataBySlug, error: errorSlug } = await supabase
      .from('vw_inmuebles_api')
      .select('*')
      .eq('slug', id)
      .single();
    
    if (errorSlug) {
      if (errorSlug.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching property by slug:', errorSlug);
      throw new Error('Failed to fetch property');
    }
    data = dataBySlug;
  } else if (error) {
    console.error('Error fetching property:', error);
    throw new Error('Failed to fetch property');
  }

  return mapInmuebleToProperty(data);
}

/**
 * Obtener propiedades destacadas
 */
export async function getFeaturedProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('vw_inmuebles_api')
    .select('*')
    .eq('activo', true)
    .eq('destacado', true)
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching featured properties:', error);
    return [];
  }

  return (data || []).map(mapInmuebleToProperty);
}

/**
 * Obtener propiedades recientes
 */
export async function getRecentProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('vw_inmuebles_api')
    .select('*')
    .eq('activo', true)
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent properties:', error);
    return [];
  }

  return (data || []).map(mapInmuebleToProperty);
}

/**
 * Obtener propiedades trending (más vistas)
 */
export async function getTrendingProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('vw_inmuebles_api')
    .select('*')
    .eq('activo', true)
    .order('visitas', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching trending properties:', error);
    return [];
  }

  return (data || []).map(mapInmuebleToProperty);
}

/**
 * Obtener una propiedad por SLUG (para SEO friendly URLs)
 */
export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  return getPropertyById(slug);
}
