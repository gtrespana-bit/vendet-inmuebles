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
 */
function mapInmuebleToProperty(item: any): Property {
  // La vista ya devuelve imágenes como JSON array ordenado
  const imagenes = item.imagenes_json || [];
  const imagenPortada = imagenes.length > 0 ? imagenes[0].url_imagen : null;
  const imagensUrls = imagenes.map((img: any) => img.url_imagen).filter(Boolean);

  return {
    id: item.id,
    slug: item.slug || `inmueble-${item.id}`,
    title: item.titulo || 'Sin título',
    description: item.descripcion || null,
    operation_type: item.operacion_slug === 'alquiler' ? 'alquiler' : 'venta',
    property_type: (item.tipo_slug || 'casa') as Property['property_type'],
    price: Number(item.precio) || 0,
    currency: (item.moneda as Property['currency']) || 'USD',
    state_id: item.estado || '',
    state_name: item.estado || '',
    city_id: item.ciudad || '',
    city_name: item.ciudad || '',
    municipality_id: item.municipio || null,
    municipality_name: item.municipio || null,
    address: item.direccion_exacta || null,
    latitude: item.latitud ? Number(item.latitud) : null,
    longitude: item.longitud ? Number(item.longitud) : null,
    area_size: item.area_total ? Number(item.area_total) : null,
    bedrooms: item.habitaciones || null,
    bathrooms: item.banos || null,
    parking_spaces: item.puestos_estacionamiento || null,
    floors: item.piso || null,
    year_built: item.antiguedad_anios ? new Date().getFullYear() - item.antiguedad_anios : null,
    status: item.activo ? 'active' as const : 'inactive' as const,
    featured: item.destacado || false,
    amenities: null, // Se pueden obtener de inmueble_caracteristicas si es necesario
    main_image_url: imagenPortada,
    images: imagensUrls.length > 0 ? imagensUrls : (imagenPortada ? [imagenPortada] : null),
    video_url: null,
    virtual_tour_url: null,
    owner_id: item.usuario_id || '',
    owner_name: null,
    owner_phone: null,
    owner_email: null,
    agency_name: null,
    agency_logo_url: null,
    meta_title: null,
    meta_description: null,
    created_at: item.creado_en || new Date().toISOString(),
    updated_at: item.actualizado_en || new Date().toISOString(),
    published_at: item.publicado_en || null,
    last_activity: null,
    views_count: item.visitas || 0,
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
    .select('*', { count: 'exact' })
    .eq('activo', true);

  // Aplicar filtros
  if (operation_type) {
    query = query.eq('operacion_slug', operation_type);
  }
  
  if (property_type && property_type.length > 0) {
    query = query.in('tipo_slug', property_type);
  }
  
  if (state_id) {
    query = query.eq('estado', state_id);
  }
  
  if (city_id) {
    query = query.eq('ciudad', city_id);
  }
  
  if (min_price !== undefined) {
    query = query.gte('precio', min_price);
  }
  
  if (max_price !== undefined) {
    query = query.lte('precio', max_price);
  }
  
  if (featured_only) {
    query = query.eq('destacado', true);
  }

  // Ordenamiento
  switch (sort_by) {
    case 'oldest':
      query = query.order('creado_en', { ascending: true });
      break;
    case 'price_asc':
      query = query.order('precio', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('precio', { ascending: false });
      break;
    case 'featured':
      query = query.order('destacado', { ascending: false }).order('creado_en', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('creado_en', { ascending: false });
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
      (p.habitaciones || 0) >= min_bedrooms
    );
  }
  
  if (min_bathrooms !== undefined) {
    inmuebles = inmuebles.filter(p => 
      (p.banos || 0) >= min_bathrooms
    );
  }
  
  if (min_area !== undefined) {
    inmuebles = inmuebles.filter(p => 
      (Number(p.area_total) || 0) >= min_area
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
