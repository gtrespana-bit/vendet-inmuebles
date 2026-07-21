'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { categoriasData } from '@/lib/categorias';
import LocalLink from './LocalLink';

interface CatalogFiltersProps {
  categoria: string;
  subcategoria: string;
  marca: string;
  precioMin: string;
  precioMax: string;
  ubicacionEstado: string;
  ubicacionCiudad: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const CatalogFilters = ({ 
  categoria, 
  subcategoria, 
  marca, 
  precioMin, 
  precioMax, 
  ubicacionEstado, 
  ubicacionCiudad,
  t
}: CatalogFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cat = categoriasData[categoria];
  const subs = cat ? cat.subs : [];
  const allMarcas = subs.flatMap(s => s.marcas || []).filter((v, i, a) => a.indexOf(v) === i).sort();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key === 'categoria') params.delete('subcategoria');
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasActiveFilters = !!(categoria || subcategoria || marca || precioMin || precioMax || ubicacionEstado || ubicacionCiudad);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm sticky top-20">
      <h3 className="font-bold text-lg text-gray-900 mb-4">🔍 {t('catalog.filters')}</h3>

      <div className="mb-4">
        <label htmlFor="filter-categoria" className="block text-sm font-bold text-gray-900 mb-1.5">
          {t('catalog.category')}
        </label>
        <select 
          id="filter-categoria" 
          value={categoria} 
          onChange={e => setParam('categoria', e.target.value)} 
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent"
        >
          <option value="">{t('catalog.all')}</option>
          {Object.entries(categoriasData).map(([key, c]) => (
            <option key={key} value={key}>
              {c.icon} {t('catalog.categories.' + key)}
            </option>
          ))}
        </select>
      </div>

      {subs.length > 0 && (
        <div className="mb-4">
          <label htmlFor="filter-subcategoria" className="block text-sm font-bold text-gray-900 mb-1.5">
            {t('catalog.subcategory')}
          </label>
          <select 
            id="filter-subcategoria" 
            value={subcategoria} 
            onChange={e => setParam('subcategoria', e.target.value)} 
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="">{t('catalog.allSubs')}</option>
            {subs.map(s => (
              <option key={s.label} value={s.label}>
                {s.icon} {t('catalog.subcategories.' + s.label)}
              </option>
            ))}
          </select>
        </div>
      )}

      {allMarcas.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label htmlFor="filter-marca" className="block text-sm font-bold text-gray-900 mb-1.5">
              {t('catalog.brandLabel')}
            </label>
            {marca && (
              <button 
                onClick={() => setParam('marca', '')} 
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <XCircle size={12} /> {t('catalog.remove')}
              </button>
            )}
          </div>
          <select 
            id="filter-marca" 
            value={marca} 
            onChange={e => setParam('marca', e.target.value)} 
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="">{t('catalog.allBrands')}</option>
            {allMarcas.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="filter-precio-min" className="block text-sm font-bold text-gray-900 mb-1.5">
          {t('catalog.priceUsd')}
        </label>
        <div className="flex gap-2">
          <input
            id="filter-precio-min"
            type="number"
            value={precioMin}
            onChange={e => setParam('precioMin', e.target.value)}
            placeholder={t('catalog.min')}
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
          <input
            type="number"
            value={precioMax}
            onChange={e => setParam('precioMax', e.target.value)}
            placeholder={t('catalog.max')}
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
      </div>

      {hasActiveFilters && (
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