/**
 * Funciones para manejar propiedades (inmuebles) desde Supabase
 * Uso exclusivo en Server Components
 * 
 * NOTA: Usa la tabla 'inmuebles' que es la estructura correcta y profesional
 */

import { createServerClient } from './supabase-server';
import type { Property, PropertyFilter } from '@/types/property';

/**
 * Mapear datos de la tabla 'inmuebles' al tipo Property
 */
function mapInmuebleToProperty(inmueble: any): Property {
  // Procesar imágenes
  const imagenes = inmueble.inmueble_imagenes || [];
  const imagenPortada = imagenes.find((img: any) => img.es_portada)?.url_imagen || 
                        imagenes[0]?.url_imagen || null;
  const imagensUrls = imagenes.map((img: any) => img.url_imagen).filter(Boolean);

  return {
    id: inmueble.id,
    slug: inmueble.slug || `inmueble-${inmueble.id}`,
    title: inmueble.titulo || 'Sin título',
    description: inmueble.descripcion || null,
    operation_type: inmueble.operacion_slug === 'alquiler' ? 'alquiler' : 'venta',
    property_type: inmueble.tipo_slug || 'casa',
    price: Number(inmueble.precio) || 0,
    currency: (inmueble.moneda as Property['currency']) || 'USD',
    state_id: inmueble.estado || '',
    state_name: inmueble.estado || '',
    city_id: inmueble.ciudad || '',
    city_name: inmueble.ciudad || '',
    municipality_id: inmueble.municipio || null,
    municipality_name: inmueble.municipio || null,
    address: inmueble.direccion_exacta || null,
    latitude: inmueble.latitud ? Number(inmueble.latitud) : null,
    longitude: inmueble.longitud ? Number(inmueble.longitud) : null,
    area_total: inmueble.area_total ? Number(inmueble.area_total) : null,
    area_construida: inmueble.area_construida ? Number(inmueble.area_construida) : null,
    bedrooms: inmueble.habitaciones || null,
    bathrooms: inmueble.banos || null,
    parking_spaces: inmueble.puestos_estacionamiento || null,
    floors: inmueble.piso || null,
    year_built: inmueble.antiguedad_anios ? new Date().getFullYear() - inmueble.antiguedad_anios : null,
    status: inmueble.activo ? 'active' as const : 'inactive' as const,
    featured: inmueble.destacado || false,
    amenities: null, // Se pueden obtener de inmueble_caracteristicas si es necesario
    main_image_url: imagenPortada,
    images: imagensUrls.length > 0 ? imagensUrls : (imagenPortada ? [imagenPortada] : null),
    video_url: null,
    virtual_tour_url: null,
    owner_id: inmueble.usuario_id || '',
    owner_name: null,
    owner_phone: null,
    owner_email: null,
    agency_name: null,
    agency_logo_url: null,
    meta_title: null,
    meta_description: null,
    created_at: inmueble.creado_en || new Date().toISOString(),
    updated_at: inmueble.actualizado_en || new Date().toISOString(),
    published_at: inmueble.publicado_en || null,
    last_activity: null,
    views_count: inmueble.visitas || 0,
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

  // Construir query base - usando tabla 'inmuebles' con joins
  let query = supabase
    .from('inmuebles')
    .select(`
      *,
      operaciones(slug),
      tipos_inmueble(slug),
      inmueble_imagenes(url_imagen, es_portada, orden)
    `, { count: 'exact' })
    .eq('activo', true);

  // Aplicar filtros
  if (operation_type) {
    query = query.eq('operaciones.slug', operation_type);
  }
  
  if (property_type && property_type.length > 0) {
    query = query.in('tipos_inmueble.slug', property_type);
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

  // Filtrar por características si es necesario
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

  // Procesar datos para extraer slugs de relaciones
  const processedData = inmuebles.map(item => ({
    ...item,
    operacion_slug: Array.isArray(item.operaciones) && item.operaciones.length > 0 
      ? item.operaciones[0].slug 
      : 'venta',
    tipo_slug: Array.isArray(item.tipos_inmueble) && item.tipos_inmueble.length > 0 
      ? item.tipos_inmueble[0].slug 
      : 'casa',
  }));

  return {
    data: processedData.map(mapInmuebleToProperty),
    total: count || 0,
    page,
    hasMore: (count || 0) > from + limit
  };
}

/**
 * Obtener una propiedad por ID
 */
export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('inmuebles')
    .select(`
      *,
      operaciones(slug),
      tipos_inmueble(slug),
      inmueble_imagenes(url_imagen, es_portada, orden)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching property:', error);
    throw new Error('Failed to fetch property');
  }

  // Procesar datos para extraer slugs de relaciones
  const processedData = {
    ...data,
    operacion_slug: Array.isArray(data.operaciones) && data.operaciones.length > 0 
      ? data.operaciones[0].slug 
      : 'venta',
    tipo_slug: Array.isArray(data.tipos_inmueble) && data.tipos_inmueble.length > 0 
      ? data.tipos_inmueble[0].slug 
      : 'casa',
  };

  return mapInmuebleToProperty(processedData);
}

/**
 * Obtener propiedades destacadas
 */
export async function getFeaturedProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('inmuebles')
    .select(`
      *,
      operaciones(slug),
      tipos_inmueble(slug),
      inmueble_imagenes(url_imagen, es_portada, orden)
    `)
    .eq('activo', true)
    .eq('destacado', true)
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching featured properties:', error);
    return [];
  }

  // Procesar datos para extraer slugs de relaciones
  const processedData = (data || []).map(item => ({
    ...item,
    operacion_slug: Array.isArray(item.operaciones) && item.operaciones.length > 0 
      ? item.operaciones[0].slug 
      : 'venta',
    tipo_slug: Array.isArray(item.tipos_inmueble) && item.tipos_inmueble.length > 0 
      ? item.tipos_inmueble[0].slug 
      : 'casa',
  }));

  return processedData.map(mapInmuebleToProperty);
}

/**
 * Obtener propiedades recientes
 */
export async function getRecentProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('inmuebles')
    .select(`
      *,
      operaciones(slug),
      tipos_inmueble(slug),
      inmueble_imagenes(url_imagen, es_portada, orden)
    `)
    .eq('activo', true)
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent properties:', error);
    return [];
  }

  // Procesar datos para extraer slugs de relaciones
  const processedData = (data || []).map(item => ({
    ...item,
    operacion_slug: Array.isArray(item.operaciones) && item.operaciones.length > 0 
      ? item.operaciones[0].slug 
      : 'venta',
    tipo_slug: Array.isArray(item.tipos_inmueble) && item.tipos_inmueble.length > 0 
      ? item.tipos_inmueble[0].slug 
      : 'casa',
  }));

  return processedData.map(mapInmuebleToProperty);
}

/**
 * Obtener propiedades trending (más vistas)
 */
export async function getTrendingProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('inmuebles')
    .select(`
      *,
      operaciones(slug),
      tipos_inmueble(slug),
      inmueble_imagenes(url_imagen, es_portada, orden)
    `)
    .eq('activo', true)
    .order('visitas', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching trending properties:', error);
    return [];
  }

  // Procesar datos para extraer slugs de relaciones
  const processedData = (data || []).map(item => ({
    ...item,
    operacion_slug: Array.isArray(item.operaciones) && item.operaciones.length > 0 
      ? item.operaciones[0].slug 
      : 'venta',
    tipo_slug: Array.isArray(item.tipos_inmueble) && item.tipos_inmueble.length > 0 
      ? item.tipos_inmueble[0].slug 
      : 'casa',
  }));

  return processedData.map(mapInmuebleToProperty);
}
