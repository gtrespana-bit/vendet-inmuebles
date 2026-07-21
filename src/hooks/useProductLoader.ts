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
        .from('productos')
        .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado', { count: 'exact' })
        .eq('activo', true)
        .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente');

      if (filters.categoria) {
        const { data: catRow } = await supabase
          .from('categorias')
          .select('id')
          .eq('nombre', filters.categoria)
          .single();
        if (catRow) {
          query = query.eq('categoria_id', catRow.id);
        }
      }

      if (filters.subcategoria) {
        query = query.eq('subcategoria', filters.subcategoria);
      }

      if (filters.marca) {
        query = query.eq('marca', filters.marca);
      }

      if (filters.q) {
        query = query.textSearch('search_vector', filters.q, { config: 'spanish', type: 'plain' });
      }

      if (filters.ubicacionCiudad) {
        query = query.eq('ubicacion_ciudad', filters.ubicacionCiudad);
      } else if (filters.ubicacionEstado) {
        query = query.eq('ubicacion_estado', filters.ubicacionEstado);
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

      setProductos(sorted);
      setTotalCount(count ?? 0);
      
      // Save to cache
      clientCache.set(cacheKey, {
        productos: sorted,
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