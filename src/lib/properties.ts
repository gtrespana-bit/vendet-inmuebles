/**
 * Funciones para manejar propiedades (inmuebles) desde Supabase
 * Uso exclusivo en Server Components
 */

import { createServerClient } from './supabase-server';
import type { Property, PropertyFilter } from '@/types/property';

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

  // Construir query base
  let query = supabase
    .from('propiedades')
    .select('*', { count: 'exact' })
    .eq('status', 'active');

  // Aplicar filtros
  if (operation_type) {
    query = query.eq('operation_type', operation_type);
  }
  
  if (property_type && property_type.length > 0) {
    query = query.in('property_type', property_type);
  }
  
  if (state_id) {
    query = query.eq('state_id', state_id);
  }
  
  if (city_id) {
    query = query.eq('city_id', city_id);
  }
  
  if (min_price !== undefined) {
    query = query.gte('price', min_price);
  }
  
  if (max_price !== undefined) {
    query = query.lte('price', max_price);
  }
  
  if (min_bedrooms !== undefined) {
    query = query.gte('bedrooms', min_bedrooms);
  }
  
  if (min_bathrooms !== undefined) {
    query = query.gte('bathrooms', min_bathrooms);
  }
  
  if (min_area !== undefined) {
    query = query.gte('area_total', min_area);
  }
  
  if (featured_only) {
    query = query.eq('featured', true);
  }
  
  // Filtro por amenities (array contiene valor)
  if (amenities && amenities.length > 0) {
    for (const amenity of amenities) {
      query = query.contains('amenities', [amenity]);
    }
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
      query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
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

  return {
    data: (data as Property[]) || [],
    total: count || 0,
    page,
    hasMore: (count || 0) > from + limit
  };
}

/**
 * Obtener una propiedad por slug
 */
export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('propiedades')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    console.error('Error fetching property:', error);
    throw new Error('Failed to fetch property');
  }

  return data as Property;
}

/**
 * Obtener una propiedad por ID
 */
export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('propiedades')
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

  return data as Property;
}

/**
 * Obtener propiedades destacadas
 */
export async function getFeaturedProperties(limit: number = 6): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('propiedades')
    .select('*')
    .eq('status', 'active')
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching featured properties:', error);
    return [];
  }

  return (data as Property[]) || [];
}

/**
 * Obtener propiedades relacionadas (misma ciudad y tipo)
 */
export async function getRelatedProperties(
  propertyId: string,
  cityId: string,
  propertyType: string,
  limit: number = 4
): Promise<Property[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('propiedades')
    .select('*')
    .eq('status', 'active')
    .neq('id', propertyId)
    .eq('city_id', cityId)
    .eq('property_type', propertyType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching related properties:', error);
    return [];
  }

  return (data as Property[]) || [];
}

/**
 * Incrementar contador de vistas
 */
export async function incrementPropertyViews(propertyId: string): Promise<void> {
  const supabase = createServerClient();
  
  await supabase.rpc('increment_property_views', { property_id: propertyId });
}

/**
 * Obtener estadísticas de propiedades por ciudad
 */
export async function getPropertyStatsByCity(cityId: string): Promise<{
  totalForSale: number;
  totalForRent: number;
  avgPriceSale: number;
  avgPriceRent: number;
}> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('propiedades')
    .select('operation_type, price')
    .eq('status', 'active')
    .eq('city_id', cityId);

  if (error) {
    console.error('Error fetching property stats:', error);
    return {
      totalForSale: 0,
      totalForRent: 0,
      avgPriceSale: 0,
      avgPriceRent: 0
    };
  }

  const saleProps = (data || []).filter(p => p.operation_type === 'venta');
  const rentProps = (data || []).filter(p => p.operation_type === 'alquiler');

  const avgPriceSale = saleProps.length > 0 
    ? saleProps.reduce((sum, p) => sum + p.price, 0) / saleProps.length 
    : 0;
    
  const avgPriceRent = rentProps.length > 0 
    ? rentProps.reduce((sum, p) => sum + p.price, 0) / rentProps.length 
    : 0;

  return {
    totalForSale: saleProps.length,
    totalForRent: rentProps.length,
    avgPriceSale: Math.round(avgPriceSale),
    avgPriceRent: Math.round(avgPriceRent)
  };
}

/**
 * Obtener tipos de propiedad únicos disponibles
 */
export async function getAvailablePropertyTypes(): Promise<string[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('propiedades')
    .select('property_type')
    .eq('status', 'active')
    .not('property_type', 'is', null);

  if (error) {
    console.error('Error fetching property types:', error);
    return [];
  }

  const types = new Set((data || []).map(p => p.property_type));
  return Array.from(types);
}
