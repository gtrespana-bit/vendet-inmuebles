/**
 * Funciones para manejar propiedades (inmuebles) desde Supabase
 * Uso exclusivo en Server Components
 * 
 * NOTA: Usa la tabla 'productos' que contiene los inmuebles reales
 */

import { createServerClient } from './supabase-server';
import type { Property, PropertyFilter } from '@/types/property';

/**
 * Mapear datos de la tabla 'productos' al tipo Property
 */
function mapProductoToProperty(producto: any): Property {
  return {
    id: producto.id,
    title: producto.titulo,
    description: producto.descripcion || '',
    price: producto.precio_usd || 0,
    price_bs: producto.precio_bs || null,
    state: producto.ubicacion_estado || '',
    city_id: producto.ubicacion_ciudad || '',
    location_details: producto.ubicacion_detalles || '',
    images: producto.imagenes_urls || (producto.imagen_url ? [producto.imagen_url] : []),
    featured: producto.destacado || false,
    featured_until: producto.destacado_hasta || null,
    boosted_at: producto.boosteado_en || null,
    property_type: producto.tipo_propiedad || 'Casa',
    operation_type: producto.operacion_tipo || 'venta',
    active: producto.activo || false,
    views_count: producto.visitas || 0,
    created_at: producto.creado_en || new Date().toISOString(),
    features: producto.caracteristicas || {},
    // Campos adicionales para compatibilidad
    slug: producto.id,
    bedrooms: (producto.caracteristicas as any)?.habitaciones || 0,
    bathrooms: (producto.caracteristicas as any)?.banos || 0,
    area_total: (producto.caracteristicas as any)?.area_m2 || 0,
    status: producto.activo ? 'active' : 'inactive',
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

  // Construir query base - usando tabla 'productos'
  let query = supabase
    .from('productos')
    .select('*', { count: 'exact' })
    .eq('activo', true);

  // Aplicar filtros
  if (operation_type) {
    query = query.eq('operacion_tipo', operation_type);
  }
  
  if (property_type && property_type.length > 0) {
    query = query.in('tipo_propiedad', property_type);
  }
  
  if (state_id) {
    query = query.eq('ubicacion_estado', state_id);
  }
  
  if (city_id) {
    query = query.eq('ubicacion_ciudad', city_id);
  }
  
  if (min_price !== undefined) {
    query = query.gte('precio_usd', min_price);
  }
  
  if (max_price !== undefined) {
    query = query.lte('precio_usd', max_price);
  }
  
  // Filtros por características (se aplican después porque están en JSONB)
  // Se manejan en código después de obtener los datos
  
  if (featured_only) {
    query = query.eq('destacado', true);
  }

  // Ordenamiento
  switch (sort_by) {
    case 'oldest':
      query = query.order('creado_en', { ascending: true });
      break;
    case 'price_asc':
      query = query.order('precio_usd', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('precio_usd', { ascending: false });
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
  let productos = data || [];
  
  if (min_bedrooms !== undefined) {
    productos = productos.filter(p => 
      (p.caracteristicas as any)?.habitaciones >= min_bedrooms
    );
  }
  
  if (min_bathrooms !== undefined) {
    productos = productos.filter(p => 
      (p.caracteristicas as any)?.banos >= min_bathrooms
    );
  }
  
  if (min_area !== undefined) {
    productos = productos.filter(p => 
      (p.caracteristicas as any)?.area_m2 >= min_area
    );
  }

  return {
    data: productos.map(mapProductoToProperty),
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
    .from('productos')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching property:', error);
    throw new Error('Failed to fetch property');
  }

  return mapProductoToProperty(data);
}

/**
 * Obtener propiedades destacadas
 */
export async function getFeaturedProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .eq('destacado', true)
    .or(`destacado_hasta.is.null,destacado_hasta.gt.${now}`)
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching featured properties:', error);
    return [];
  }

  return (data || []).map(mapProductoToProperty);
}

/**
 * Obtener propiedades recientes
 */
export async function getRecentProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent properties:', error);
    return [];
  }

  return (data || []).map(mapProductoToProperty);
}

/**
 * Obtener propiedades trending (más vistas)
 */
export async function getTrendingProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('visitas', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching trending properties:', error);
    return [];
  }

  return (data || []).map(mapProductoToProperty);
}
