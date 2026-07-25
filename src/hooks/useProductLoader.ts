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
      // Columnas REALES que existen en vw_propiedades_publicas
      let query = supabase
        .from('vw_propiedades_publicas')
        .select(
          `id,
           titulo,
           descripcion,
           precio,
           moneda,
           ciudad,
           estado,
           municipio,
           zona,
           area_total,
           area_construida,
           habitaciones,
           banos,
           puestos_estacionamiento,
           piso,
           condicion,
           antiguedad_anios,
           latitud,
           longitud,
           direccion_exacta,
           slug,
           activo,
           destacado,
           visitas,
           creado_en,
           actualizado_en,
           publicado_en,
           operacion_nombre,
           operacion_slug,
           tipo_nombre,
           tipo_slug,
           tipo_icono,
           propietario_nombre,
           propietario_telefono,
           propietario_email,
           propietario_foto,
           propietario_verificado,
           propietario_tipo,
           propietario_empresa,
           main_image_url,
           imagenes,
           caracteristicas`,
          { count: 'exact' }
        )
        .eq('activo', true);

      // Filtro por tipo de operación (Venta / Alquiler)
      if (activeFilters.operacionTipo) {
        const op = activeFilters.operacionTipo.toLowerCase();
        // Usar columna real: operacion_nombre
        query = query.ilike('operacion_nombre', `%${op}%`);
      }

      // Filtro por tipo de propiedad
      if (activeFilters.tipoPropiedad) {
        query = query.ilike('tipo_nombre', `%${activeFilters.tipoPropiedad}%`);
      }

      // Filtro por categoría - mapear slug a tipo_nombre real en BD
      if (activeFilters.categoria) {
        const catStr = String(activeFilters.categoria).toLowerCase();
        // Mapeo slug URL → valor real en BD (tipo_nombre)
        const tipoMap: Record<string, string> = {
          casas: 'Casa',
          apartamentos: 'Apartamento',
          terrenos: 'Terreno',
          oficinas: 'Oficina',
          locales: 'Local',
          edificios: 'Edificio',
          quintas: 'Quinta',
          galpones: 'Galpón',
        };
        const tipoReal = tipoMap[catStr];
        if (tipoReal) {
          query = query.eq('tipo_nombre', tipoReal);
        }
      }

      // Filtro por subcategoría (eliminado - no existe en vw_propiedades_publicas)
      // if (activeFilters.subcategoria) { ... }

      // Filtro por marca (eliminado - no existe en vw_propiedades_publicas)
      // Filtro por marca (eliminado - no existe en vw_propiedades_publicas)
      // if (activeFilters.marca) { ... }

      // Búsqueda por título o descripción
      if (activeFilters.q) {
        query = query.or(
          `titulo.ilike.%${activeFilters.q}%,descripcion.ilike.%${activeFilters.q}%`
        );
      }

      // Filtro por ubicación - ciudad (usar columnas reales)
      if (activeFilters.ubicacionCiudad) {
        query = query.eq('ciudad', activeFilters.ubicacionCiudad);
      } else if (activeFilters.ubicacionEstado) {
        query = query.eq('estado', activeFilters.ubicacionEstado);
      }

      // Filtro por precio mínimo (usar columna real: precio)
      if (activeFilters.precioMin) {
        query = query.gte('precio', parseFloat(activeFilters.precioMin as string));
      }

      // Filtro por precio máximo (usar columna real: precio)
      if (activeFilters.precioMax) {
        query = query.lte('precio', parseFloat(activeFilters.precioMax as string));
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
