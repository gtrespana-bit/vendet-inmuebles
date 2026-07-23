'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';

interface ProductFilter {
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  q?: string;
  precioMin?: string;
  precioMax?: string;
  ubicacionEstado?: string;
  ubicacionCiudad?: string;
  [key: string]: string | number | boolean | undefined;
}

interface UseProductLoaderResult {
  productos: any[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  loadProducts: (filters: ProductFilter) => Promise<void>;
}

export const useProductLoader = (): UseProductLoaderResult => {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const loadProducts = useCallback(async (filters: ProductFilter) => {
    // Check cache first
    const cacheKey = clientCache.generateKey(filters);
    const cachedData = clientCache.get<any>(cacheKey);
    
    if (cachedData) {
      setProductos(cachedData.productos);
      setTotalCount(cachedData.totalCount);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('properties')
        .select('id, title as titulo, price as precio_usd, state_id as estado, images, city_id as ubicacion_ciudad, created_at as creado_en, property_type as subcategoria, featured_on as boosteado_en, featured as destacado, featured_until as destacado_hasta, verified_seller as vendedor_verificado', { count: 'exact' })
        .eq('status', 'active');

      // Aplicar filtros para properties
      if (filters.categoria) {
        // Para properties, categoria puede ser operation_type (venta/alquiler)
        if (['venta', 'alquiler'].includes(filters.categoria.toLowerCase())) {
          query = query.eq('operation_type', filters.categoria.toLowerCase());
        }
        // O puede ser property_type (casa, apartamento, etc.)
        else if (['casa', 'apartamento', 'terreno', 'local', 'oficina', 'galpon'].includes(filters.categoria.toLowerCase())) {
          query = query.eq('property_type', filters.categoria.toLowerCase());
        }
      }

      if (filters.subcategoria) {
        // Para properties, subcategoria es property_type
        query = query.eq('property_type', filters.subcategoria);
      }

      if (filters.marca) {
        // Para properties, marca no aplica, pero podemos filtrar por city_id si es un estado/ciudad
        query = query.eq('city_id', filters.marca);
      }

      if (filters.q) {
        // Búsqueda por título o descripción
        query = query.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
      }

      if (filters.ubicacionCiudad) {
        query = query.eq('city_id', filters.ubicacionCiudad);
      } else if (filters.ubicacionEstado) {
        query = query.eq('state_id', filters.ubicacionEstado);
      }

      if (filters.precioMin) {
        query = query.gte('precio_usd', parseFloat(filters.precioMin));
      }
      if (filters.precioMax) {
        query = query.lte('precio_usd', parseFloat(filters.precioMax));
      }

      query = query.order('creado_en', { ascending: false }).limit(100);

      const { data, count, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Ordenar productos según la lógica de prioridad
      const now = new Date().toISOString();
      const sorted = (data || []).sort((a: any, b: any) => {
        const aBoost = a.boosteado_en || null;
        const bBoost = b.boosteado_en || null;
        if (aBoost && !bBoost) return -1;
        if (!aBoost && bBoost) return 1;
        if (aBoost && bBoost) return bBoost.localeCompare(aBoost);
        const aDest = a.destacado && a.destacado_hasta && a.destacado_hasta > now;
        const bDest = b.destacado && b.destacado_hasta && b.destacado_hasta > now;
        if (aDest && !bDest) return -1;
        if (!aDest && bDest) return 1;
        if (aDest && bDest) return b.destacado_hasta!.localeCompare(a.destacado_hasta!);
        return b.creado_en.localeCompare(a.creado_en);
      });

      // Procesar images array para obtener imagen_url
      const processed = sorted.map((p: any) => ({
        ...p,
        imagen_url: p.images?.[0] || null,
        ubicacion_estado: p.estado // state_id ya está en estado
      }));

      setProductos(processed);
      setTotalCount(count ?? 0);
      
      // Save to cache
      clientCache.set(cacheKey, {
        productos: processed,
        totalCount: count ?? 0
      });
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setProductos([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    productos,
    loading,
    error,
    totalCount,
    loadProducts
  };
};