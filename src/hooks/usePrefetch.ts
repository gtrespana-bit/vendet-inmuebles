'use client';

import { useEffect, useCallback } from 'react';
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
}

export const usePrefetch = () => {
  const prefetchPage = useCallback(async (
    page: number,
    itemsPerPage: number,
    filters: ProductFilter = {}
  ) => {
    // Verificar si ya está en caché
    const cacheKey = clientCache.generateKey({
      ...filters,
      pagina: page,
      limite: itemsPerPage
    });

    if (clientCache.has(cacheKey)) {
      return;
    }

    try {
      let query = supabase
        .from('vw_propiedades_publicas')
        .select('id, titulo, precio, main_image_url, ciudad, estado, creado_en, tipo_nombre, operacion_nombre, caracteristicas, descripcion, destacado', { count: 'exact' })
        .eq('activo', true);

      if (filters.ubicacionCiudad) {
        query = query.eq('ciudad', filters.ubicacionCiudad);
      } else if (filters.ubicacionEstado) {
        query = query.eq('estado', filters.ubicacionEstado);
      }

      if (filters.precioMin) {
        query = query.gte('precio', parseFloat(filters.precioMin));
      }
      if (filters.precioMax) {
        query = query.lte('precio', parseFloat(filters.precioMax));
      }

      // Aplicar offset para la página específica
      const offset = (page - 1) * itemsPerPage;
      query = query.order('creado_en', { ascending: false })
                   .range(offset, offset + itemsPerPage - 1);

      const { data, count, error } = await query;

      if (error) {
        console.error('Error prefetching page:', error);
        return;
      }

      // Guardar en caché
      clientCache.set(cacheKey, {
        productos: data,
        totalCount: count ?? 0
      });
    } catch (error) {
      console.error('Error prefetching page:', error);
    }
  }, []);

  return { prefetchPage };
};