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
  operacionTipo?: string;
  tipoPropiedad?: string;
  [key: string]: string | number | boolean | undefined;
}

interface UseProductLoaderResult {
  productos: any[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  loadProducts: (filters?: ProductFilter) => Promise<void>;
}

export const useProductLoader = (
  initialFilters?: ProductFilter
): UseProductLoaderResult => {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const loadProducts = useCallback(async (filters?: ProductFilter) => {
    const activeFilters = { ...initialFilters, ...filters };

    // Generar cache key
    const cacheKey = `productos_${JSON.stringify(activeFilters)}`;
    const cached = clientCache.get(cacheKey) as any;
    if (cached) {
      setProductos(cached.productos || []);
      setTotalCount(cached.totalCount || 0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('productos')
        .select(
          `id,
           titulo,
           descripcion,
           precio_usd,
           precio_bs,
           estado,
           categoria_id,
           subcategoria,
           marca,
           ubicacion_estado,
           ubicacion_ciudad,
           ubicacion_detalles,
           activo,
           visitas,
           creado_en,
           imagen_url,
           imagenes_urls,
           destacado,
           destacado_hasta,
           boosteado_en,
           estado_moderacion,
           caracteristicas,
           tipo_propiedad,
           operacion_tipo`,
          { count: 'exact' }
        )
        .eq('activo', true)
        .eq('estado_moderacion', 'aprobado');

      // Filtro por tipo de operación (Venta / Alquiler)
      if (activeFilters.operacionTipo) {
        const op =
          activeFilters.operacionTipo.charAt(0).toUpperCase() +
          activeFilters.operacionTipo.slice(1).toLowerCase();
        query = query.eq('operacion_tipo', op);
      }

      // Filtro por tipo de propiedad
      if (activeFilters.tipoPropiedad) {
        query = query.ilike('tipo_propiedad', `%${activeFilters.tipoPropiedad}%`);
      }

      // Filtro por categoría - mapear a tipo_propiedad (texto)
      if (activeFilters.categoria) {
        const catStr = String(activeFilters.categoria);
        const catNum = parseInt(catStr, 10);
        if (!isNaN(catNum)) {
          // Es un número → filtrar por categoria_id
          query = query.eq('categoria_id', catNum);
        } else {
          // Es texto (ej: "casas", "apartamentos") → filtrar por tipo_propiedad
          query = query.ilike('tipo_propiedad', `%${catStr}%`);
        }
      }

      // Filtro por subcategoría
      if (activeFilters.subcategoria) {
        query = query.ilike('subcategoria', `%${activeFilters.subcategoria}%`);
      }

      // Filtro por marca
      if (activeFilters.marca) {
        query = query.ilike('marca', `%${activeFilters.marca}%`);
      }

      // Búsqueda por título o descripción
      if (activeFilters.q) {
        query = query.or(
          `titulo.ilike.%${activeFilters.q}%,descripcion.ilike.%${activeFilters.q}%`
        );
      }

      // Filtro por ubicación - ciudad
      if (activeFilters.ubicacionCiudad) {
        query = query.eq('ubicacion_ciudad', activeFilters.ubicacionCiudad);
      } else if (activeFilters.ubicacionEstado) {
        query = query.eq('ubicacion_estado', activeFilters.ubicacionEstado);
      }

      // Filtro por precio mínimo
      if (activeFilters.precioMin) {
        query = query.gte('precio_usd', parseFloat(activeFilters.precioMin as string));
      }

      // Filtro por precio máximo
      if (activeFilters.precioMax) {
        query = query.lte('precio_usd', parseFloat(activeFilters.precioMax as string));
      }

      // Ordenar por fecha de creación, más recientes primero
      query = query.order('creado_en', { ascending: false }).limit(100);

      const { data, count, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const productosData = data || [];
      setProductos(productosData);
      setTotalCount(count || 0);

      // Guardar en caché
      clientCache.set(cacheKey, {
        productos: productosData,
        totalCount: count || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos');
      setProductos([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [initialFilters]);

  useEffect(() => {
    loadProducts();
  }, []);

  return {
    productos,
    loading,
    error,
    totalCount,
    loadProducts,
  };
};
