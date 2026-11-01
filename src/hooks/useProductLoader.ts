'use client';
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';
import { applyCatalogExtraFilters } from '@/lib/catalog-extra-filters';
import { MUNICIPIOS_POR_ESTADO } from '@/lib/ubicaciones';
import { sanitizePostgrestSearchTerm } from '@/lib/urbanizaciones';
import {
  applyCatalogServerOrder,
  normalizeCatalogSort,
  sortCatalogProperties,
} from '@/lib/catalog-sort';

interface ProductFilter {
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  q?: string;
  zona?: string;
  orden?: string;
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

function resolveCityAliases(estado?: string, ciudad?: string): string[] {
  const clean = sanitizePostgrestSearchTerm(ciudad);
  if (!clean) return [];
  const aliases = new Set<string>([clean]);
  const stateLists = estado && MUNICIPIOS_POR_ESTADO[estado]
    ? [MUNICIPIOS_POR_ESTADO[estado]]
    : Object.values(MUNICIPIOS_POR_ESTADO);

  const lower = clean.toLowerCase();
  for (const list of stateLists) {
    for (const mun of list) {
      if (mun.capital.toLowerCase() === lower || mun.nombre.toLowerCase() === lower) {
        const cap = sanitizePostgrestSearchTerm(mun.capital);
        const nom = sanitizePostgrestSearchTerm(mun.nombre);
        if (cap) aliases.add(cap);
        if (nom) aliases.add(nom);
      }
    }
  }
  return Array.from(aliases);
}

export const useProductLoader = (
  initialFilters?: ProductFilter
): UseProductLoaderResult => {
  const requestId = useRef(0);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const loadProducts = useCallback(async (filters?: ProductFilter) => {
    const activeFilters = { ...initialFilters, ...filters };
    const sortKey = normalizeCatalogSort(String(activeFilters.orden || ''));
    const request = ++requestId.current;

    const cacheKey = `productos_v2_${JSON.stringify({ ...activeFilters, orden: sortKey })}`;
    const cached = clientCache.get(cacheKey) as any;
    if (cached) {
      setLoading(false);
      setProductos(cached.productos || []);
      setTotalCount(cached.totalCount || 0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('vw_propiedades_publicas')
        .select(
          `id,
           usuario_id,
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
           destacado_hasta,
           boosteado_en,
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
           vendedor_verificado,
           propietario_tipo,
           propietario_empresa,
           main_image_url,
           imagenes,
           imagenes_urls,
           video_url,
           virtual_tour_url,
           plano_url,
           caracteristicas`,
          { count: 'exact' }
        )
        .eq('activo', true);

      if (activeFilters.operacionTipo) {
        const op = sanitizePostgrestSearchTerm(activeFilters.operacionTipo).toLowerCase();
        if (op) query = query.ilike('operacion_nombre', `%${op}%`);
      }

      if (activeFilters.tipoPropiedad) {
        const tp = sanitizePostgrestSearchTerm(activeFilters.tipoPropiedad);
        if (tp) query = query.ilike('tipo_nombre', `%${tp}%`);
      }

      if (activeFilters.categoria) {
        const catStr = String(activeFilters.categoria).toLowerCase();
        const tipoMap: Record<string, string> = {
          casas: 'Casa',
          apartamentos: 'Apartamento',
          townhouses: 'Townhouse',
          terrenos: 'Terreno',
          locales: 'Local comercial',
          oficinas: 'Oficina',
          edificios: 'Edificio',
          habitaciones: 'Habitación',
          fincas: 'Finca',
          galpones: 'Galpón',
        };
        const tipoReal = tipoMap[catStr];
        if (tipoReal) {
          query = query.eq('tipo_nombre', tipoReal);
        }
      }

      // Búsqueda inteligente por texto libre (título, descripción, urbanización/zona, ciudad o estado)
      if (activeFilters.q) {
        const safeQ = sanitizePostgrestSearchTerm(activeFilters.q);
        if (safeQ) {
          query = query.or(
            `titulo.ilike.%${safeQ}%,descripcion.ilike.%${safeQ}%,zona.ilike.%${safeQ}%,ciudad.ilike.%${safeQ}%,municipio.ilike.%${safeQ}%,estado.ilike.%${safeQ}%`
          );
        }
      }

      // Filtro por urbanización / zona (incluye respaldo en título para anuncios antiguos sin columna `zona` rellenada)
      if (activeFilters.zona) {
        const safeZona = sanitizePostgrestSearchTerm(activeFilters.zona);
        if (safeZona) {
          query = query.or(`zona.ilike.%${safeZona}%,titulo.ilike.%${safeZona}%`);
        }
      }

      if (activeFilters.ubicacionEstado) {
        query = query.eq('estado', activeFilters.ubicacionEstado);
      }

      if (activeFilters.ubicacionCiudad) {
        const aliases = resolveCityAliases(
          typeof activeFilters.ubicacionEstado === 'string' ? activeFilters.ubicacionEstado : undefined,
          String(activeFilters.ubicacionCiudad)
        );
        if (aliases.length === 1) {
          query = query.or(`ciudad.ilike.${aliases[0]},municipio.ilike.${aliases[0]}`);
        } else if (aliases.length > 1) {
          const clauses = aliases.flatMap((a) => [`ciudad.ilike.${a}`, `municipio.ilike.${a}`]);
          query = query.or(clauses.join(','));
        }
      }

      if (activeFilters.precioMin && Number.isFinite(Number(activeFilters.precioMin))) {
        query = query.gte('precio', parseFloat(activeFilters.precioMin as string));
      }

      if (activeFilters.precioMax && Number.isFinite(Number(activeFilters.precioMax))) {
        query = query.lte('precio', parseFloat(activeFilters.precioMax as string));
      }

      query = applyCatalogExtraFilters(query, activeFilters as Record<string, string | undefined>);
      query = applyCatalogServerOrder(query, sortKey).limit(240);

      const { data, count, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (request !== requestId.current) return;
      const now = Date.now();
      const mapped = (data || []).map((product: any) => ({
        ...product,
        _isFeatured: Boolean(
          product.destacado &&
            (!product.destacado_hasta || new Date(product.destacado_hasta).getTime() > now)
        ),
      }));
      const productosData = sortCatalogProperties(mapped, sortKey, now);
      setProductos(productosData);
      setTotalCount(count || productosData.length);

      clientCache.set(cacheKey, {
        productos: productosData,
        totalCount: count || productosData.length,
      });
    } catch (err: any) {
      if (request !== requestId.current) return;
      setError(err.message || 'Error al cargar inmuebles');
      setProductos([]);
      setTotalCount(0);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [initialFilters]);

  return {
    productos,
    loading,
    error,
    totalCount,
    loadProducts,
  };
};
