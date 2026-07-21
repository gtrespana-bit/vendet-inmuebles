'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface PropertyFiltersProps {
  locale: string;
}

export default function PropertyFilters({ locale }: PropertyFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const estadosVenezuela = [
    'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 
    'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 
    'Guárico', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 
    'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Vargas', 'Yaracuy', 'Zulia'
  ];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const params = new URLSearchParams();
    
    const operacion = formData.get('operacion') as string;
    const estado = formData.get('estado') as string;
    const ciudad = formData.get('ciudad') as string;
    const precioMin = formData.get('precio_min') as string;
    const precioMax = formData.get('precio_max') as string;
    const habitaciones = formData.get('habitaciones') as string;
    const banos = formData.get('banos') as string;
    const areaMin = formData.get('area_min') as string;
    const soloVerificados = formData.get('solo_verificados');
    const busqueda = formData.get('busqueda') as string;

    if (operacion) params.set('operacion', operacion);
    if (estado) params.set('estado', estado);
    if (ciudad) params.set('ciudad', ciudad);
    if (precioMin) params.set('precio_min', precioMin);
    if (precioMax) params.set('precio_max', precioMax);
    if (habitaciones) params.set('habitaciones', habitaciones);
    if (banos) params.set('banos', banos);
    if (areaMin) params.set('area_min', areaMin);
    if (soloVerificados) params.set('solo_verificados', 'true');
    if (busqueda) params.set('busqueda', busqueda);

    router.push(`/${locale}/propiedades?${params.toString()}`);
  };

  const handleClear = () => {
    router.push(`/${locale}/propiedades`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border mb-6">
      {/* Header con botón toggle para móviles */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Filtros de Búsqueda</h2>
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-2 text-gray-600 hover:text-blue-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className={`p-4 ${isOpen ? 'block' : 'hidden lg:block'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          
          {/* Tipo de Operación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Operación</label>
            <select name="operacion" defaultValue={searchParams.get('operacion') || ''} className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500">
              <option value="">Todos</option>
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select name="estado" defaultValue={searchParams.get('estado') || ''} className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500">
              <option value="">Todos</option>
              {estadosVenezuela.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>

          {/* Ciudad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input type="text" name="ciudad" defaultValue={searchParams.get('ciudad') || ''} placeholder="Ej: Caracas" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>

          {/* Búsqueda por texto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input type="text" name="busqueda" defaultValue={searchParams.get('busqueda') || ''} placeholder="Título, descripción..." className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>

          {/* Precio Mínimo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio Mínimo ($)</label>
            <input type="number" name="precio_min" defaultValue={searchParams.get('precio_min') || ''} placeholder="0" min="0" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>

          {/* Precio Máximo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio Máximo ($)</label>
            <input type="number" name="precio_max" defaultValue={searchParams.get('precio_max') || ''} placeholder="Cualquiera" min="0" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>

          {/* Habitaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Habitaciones</label>
            <select name="habitaciones" defaultValue={searchParams.get('habitaciones') || ''} className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500">
              <option value="">Cualquiera</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5+</option>
            </select>
          </div>

          {/* Baños */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Baños</label>
            <select name="banos" defaultValue={searchParams.get('banos') || ''} className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500">
              <option value="">Cualquiera</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </div>

          {/* Área Mínima */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Área Mínima (m²)</label>
            <input type="number" name="area_min" defaultValue={searchParams.get('area_min') || ''} placeholder="0" min="0" className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>

          {/* Solo Verificados */}
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" name="solo_verificados" defaultChecked={searchParams.get('solo_verificados') === 'true'} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700">Solo verificados</span>
            </label>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 pt-4 border-t">
          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors">
            Aplicar Filtros
          </button>
          <button type="button" onClick={handleClear} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">
            Limpiar
          </button>
        </div>
      </form>
    </div>
  );
}
