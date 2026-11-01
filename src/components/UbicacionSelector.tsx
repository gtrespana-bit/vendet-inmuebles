'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MapPin, Search, X } from 'lucide-react'
import { ESTADOS, getMunicipios } from '@/lib/ubicaciones'
import { getUrbanizacionesSugeridas } from '@/lib/urbanizaciones'

interface UbicacionSelectorProps {
  estado: string
  ciudad: string
  zona?: string
  onChange: (estado: string, ciudad: string) => void
  onZonaChange?: (zona: string) => void
  showCapital?: boolean
}

export default function UbicacionSelector({
  estado,
  ciudad,
  zona = '',
  onChange,
  onZonaChange,
}: UbicacionSelectorProps) {
  const pathname = usePathname()
  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const [zonaDraft, setZonaDraft] = useState(zona)

  useEffect(() => {
    setZonaDraft(zona)
  }, [zona])

  const todosMunicipios = useMemo(() => {
    if (!estado) return []
    return [...getMunicipios(estado)].sort((a, b) => a.capital.localeCompare(b.capital, 'es'))
  }, [estado])

  const sugerenciasZona = useMemo(
    () => getUrbanizacionesSugeridas(estado || undefined, ciudad || undefined),
    [estado, ciudad]
  )

  const applyZona = (nextValue: string) => {
    const trimmed = nextValue.trim()
    if (onZonaChange && trimmed !== zona) {
      onZonaChange(trimmed)
    }
  }

  const hasLocationFilter = Boolean(estado || ciudad || zona)

  return (
    <div className="bg-[#FAF8F3] rounded-lg p-4 border border-[#E5DED2]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6E6356] flex items-center gap-1.5 m-0">
          <MapPin size={14} className="text-[#9b7f4e]" aria-hidden="true" />
          {isEn ? 'Location & neighborhood' : 'Ubicación y urbanización'}
        </h2>
        {hasLocationFilter && (
          <button
            type="button"
            onClick={() => {
              setZonaDraft('')
              onChange('', '')
              onZonaChange?.('')
            }}
            aria-label={isEn ? 'Clear location filter' : 'Limpiar filtro de ubicación'}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#7A263A] hover:underline"
          >
            <X size={13} aria-hidden="true" />
            {isEn ? 'Clear location' : 'Limpiar ubicación'}
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 ${onZonaChange ? 'md:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
        <div>
          <label htmlFor="ubicacion-estado" className="block text-[11px] font-semibold text-[#6E6356] mb-1">
            {isEn ? 'State' : 'Estado'}
          </label>
          <select
            id="ubicacion-estado"
            value={estado}
            onChange={(e) => onChange(e.target.value, '')}
            className="w-full border border-[#DCD4C6] rounded px-3 py-2 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="">{isEn ? 'All Venezuela' : 'Toda Venezuela'}</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ubicacion-municipio" className="block text-[11px] font-semibold text-[#6E6356] mb-1">
            {isEn ? 'City / Municipality' : 'Ciudad / Municipio'}
          </label>
          <select
            id="ubicacion-municipio"
            value={ciudad}
            onChange={(e) => onChange(estado, e.target.value)}
            disabled={!estado}
            className="w-full border border-[#DCD4C6] rounded px-3 py-2 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">{isEn ? 'All cities / municipalities' : 'Todas las ciudades / municipios'}</option>
            {ciudad &&
              !todosMunicipios.some((m) => m.capital === ciudad || m.nombre === ciudad) && (
                <option value={ciudad}>{ciudad}</option>
              )}
            {todosMunicipios.map((m) => (
              <option key={m.nombre} value={m.capital}>
                {m.capital === m.nombre ? m.capital : `${m.capital} (${m.nombre})`}
              </option>
            ))}
          </select>
        </div>

        {onZonaChange && (
          <div>
            <label htmlFor="ubicacion-zona" className="block text-[11px] font-semibold text-[#6E6356] mb-1">
              {isEn ? 'Neighborhood / Zone' : 'Urbanización / Zona'}
            </label>
            <div className="relative flex items-center">
              <input
                id="ubicacion-zona"
                type="text"
                list="ubicacion-zonas-datalist"
                value={zonaDraft}
                onChange={(e) => {
                  const val = e.target.value
                  setZonaDraft(val)
                  if (sugerenciasZona.includes(val)) {
                    onZonaChange(val)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyZona(zonaDraft)
                  }
                }}
                onBlur={() => applyZona(zonaDraft)}
                placeholder={
                  isEn
                    ? 'e.g. Las Mercedes, El Parral, Mañongo…'
                    : 'Ej. Las Mercedes, El Parral, Mañongo…'
                }
                className="w-full border border-[#DCD4C6] rounded pl-3 pr-8 py-2 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
              {zonaDraft ? (
                <button
                  type="button"
                  onClick={() => {
                    setZonaDraft('')
                    onZonaChange('')
                  }}
                  aria-label={isEn ? 'Clear zone' : 'Borrar zona'}
                  className="absolute right-2 text-gray-400 hover:text-gray-700"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : (
                <Search size={13} className="absolute right-2.5 text-gray-400 pointer-events-none" aria-hidden="true" />
              )}
              <datalist id="ubicacion-zonas-datalist">
                {sugerenciasZona.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
