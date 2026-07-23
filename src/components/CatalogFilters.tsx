'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';

const tiposPropiedad = [
  { value: 'casas', label: 'Casas' },
  { value: 'apartamentos', label: 'Apartamentos' },
  { value: 'terrenos', label: 'Terrenos' },
  { value: 'oficinas', label: 'Oficinas' },
  { value: 'locales', label: 'Locales' },
  { value: 'edificios', label: 'Edificios' },
  { value: 'quintas', label: 'Quintas' },
  { value: 'galpones', label: 'Galpones' },
];

const operaciones = [
  { value: 'Venta', label: 'Venta' },
  { value: 'Alquiler', label: 'Alquiler' },
];

interface CatalogFiltersProps {
  categoria: string;
  operacionTipo?: string;
  precioMin: string;
  precioMax: string;
  ubicacionEstado: string;
  ubicacionCiudad: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const CatalogFilters = ({
  categoria,
  operacionTipo = '',
  precioMin,
  precioMax,
  ubicacionEstado,
  ubicacionCiudad,
  t,
}: CatalogFiltersProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasAnyFilter =
    categoria || operacionTipo || precioMin || precioMax || ubicacionEstado || ubicacionCiudad;

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4 shadow-sm">
      <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">
        {t('catalog.filters')}
      </h3>

      {/* Tipo de Operación */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Operación
        </label>
        <select
          value={operacionTipo}
          onChange={(e) => setParam('operacion', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-accent focus:border-transparent"
        >
          <option value="">Todas</option>
          {operaciones.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo de Propiedad */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Tipo de Propiedad
        </label>
        <select
          value={categoria}
          onChange={(e) => setParam('categoria', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-accent focus:border-transparent"
        >
          <option value="">Todas</option>
          {tiposPropiedad.map((tp) => (
            <option key={tp.value} value={tp.value}>
              {tp.label}
            </option>
          ))}
        </select>
      </div>

      {/* Precio Mínimo */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('catalog.minPrice')}
        </label>
        <input
          type="number"
          value={precioMin}
          onChange={(e) => setParam('precioMin', e.target.value)}
          placeholder="0"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-accent focus:border-transparent"
        />
      </div>

      {/* Precio Máximo */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {t('catalog.maxPrice')}
        </label>
        <input
          type="number"
          value={precioMax}
          onChange={(e) => setParam('precioMax', e.target.value)}
          placeholder="999999"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-accent focus:border-transparent"
        />
      </div>

      {/* Botón limpiar filtros */}
      {hasAnyFilter && (
        <button
          onClick={() => router.push(pathname)}
          className="w-full text-sm text-red-500 hover:text-red-700 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition flex items-center justify-center gap-1"
        >
          <XCircle size={14} /> {t('catalog.clearFilters')}
        </button>
      )}
    </div>
  );
};
