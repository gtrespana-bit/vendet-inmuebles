'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Award,
  Building2,
  CalendarCheck,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import Avatar from '@/components/Avatar'
import BadgeVerificado from '@/components/BadgeVerificado'

export interface PublicDirectoryAdvisor {
  id: string
  slug: string | null
  nombre: string | null
  empresa_nombre: string | null
  descripcion_agente: string | null
  tipo_cuenta: string | null
  estado: string | null
  ciudad: string | null
  foto_perfil_url: string | null
  verificado: boolean
  nivel_confianza: number
  miembro_agencia_id: string | null
  miembro_agencia_nombre: string | null
  miembro_agencia_owner_id: string | null
  licencia_corredor: string | null
  zonas_especialidad: string[]
  anos_experiencia: number | null
  propiedades_activas: number
  total_vendidas: number
  num_resenas: number
  promedio_resenas: number
  visitas_atendidas: number
}

interface AsesoresClientProps {
  initialItems: PublicDirectoryAdvisor[]
  locale: string
}

export default function AsesoresClient({ initialItems, locale }: AsesoresClientProps) {
  const isEn = locale === 'en'
  const [typeFilter, setTypeFilter] = useState<'all' | 'agencies' | 'advisors'>('all')
  const [onlyVerified, setOnlyVerified] = useState(false)
  const [stateFilter, setStateFilter] = useState('all')
  const [query, setQuery] = useState('')

  const availableStates = useMemo(() => {
    const s = new Set<string>()
    for (const item of initialItems) {
      if (item.estado) s.add(item.estado)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [initialItems])

  const filtered = useMemo(() => {
    return initialItems.filter((item) => {
      const isAgencyOwner = Boolean(
        (item.miembro_agencia_id && item.miembro_agencia_owner_id === item.id) ||
          item.tipo_cuenta === 'agencia' ||
          item.empresa_nombre,
      )
      if (typeFilter === 'agencies' && !isAgencyOwner) return false
      if (typeFilter === 'advisors' && isAgencyOwner) return false
      if (onlyVerified && !item.verificado) return false
      if (stateFilter !== 'all' && item.estado !== stateFilter) return false

      if (query.trim()) {
        const q = query.trim().toLowerCase()
        const haystack = [
          item.nombre,
          item.empresa_nombre,
          item.miembro_agencia_nombre,
          item.ciudad,
          item.estado,
          item.descripcion_agente,
          ...(item.zonas_especialidad || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [initialItems, typeFilter, onlyVerified, stateFilter, query])

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda y segmentación */}
      <div className="rounded-2xl bg-white border border-[#e5dfd3] p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-[#f7f4ee] p-1 text-xs">
          {(
            [
              { id: 'all', label: isEn ? 'All' : 'Todos' },
              { id: 'agencies', label: isEn ? 'Agencies' : 'Inmobiliarias' },
              { id: 'advisors', label: isEn ? 'Advisors' : 'Asesores' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                typeFilter === tab.id
                  ? 'bg-[#16294B] text-white'
                  : 'text-[#475569] hover:text-[#16294B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 flex-1 sm:flex-initial">
          <div className="relative flex-1 sm:w-60">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isEn ? 'Search name, city or specialty…' : 'Buscar nombre, ciudad o zona…'
              }
              className="w-full rounded-xl border border-[#dfd8cc] bg-white pl-8 pr-3 py-2 text-xs"
            />
          </div>

          {availableStates.length > 0 && (
            <select
              aria-label={isEn ? 'Filter by state' : 'Filtrar por estado'}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-xl border border-[#dfd8cc] bg-white px-3 py-2 text-xs font-medium text-[#1E293B]"
            >
              <option value="all">{isEn ? 'All states' : 'Todos los estados'}</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setOnlyVerified((v) => !v)}
            aria-pressed={onlyVerified}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              onlyVerified
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-[#16294B] border-[#dfd8cc] hover:bg-[#f7f4ee]'
            }`}
          >
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{isEn ? 'Verified only' : 'Solo verificados'}</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#e5dfd3] p-12 text-center text-sm text-[#64748B]">
          <Users size={30} className="mx-auto mb-2 text-[#94A3B8]" />
          <p className="m-0">
            {isEn
              ? 'No agencies or advisors matched your current filters.'
              : 'No encontramos agencias ni asesores con estos filtros.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((advisor) => {
            const isAgency = Boolean(
              (advisor.miembro_agencia_id && advisor.miembro_agencia_owner_id === advisor.id) ||
                advisor.tipo_cuenta === 'agencia' ||
                advisor.empresa_nombre,
            )
            const displayName = isAgency
              ? advisor.miembro_agencia_nombre ||
                advisor.empresa_nombre ||
                advisor.nombre ||
                'Inmobiliaria'
              : advisor.nombre || 'Asesor'
            const href = `/vendedor/${advisor.slug || advisor.id}`
            const place = [advisor.ciudad, advisor.estado].filter(Boolean).join(', ')

            return (
              <LocalLink
                key={advisor.id}
                href={href}
                className="group rounded-2xl bg-white border border-[#e5dfd3] hover:border-[#8C6526] hover:shadow-md p-5 flex flex-col justify-between transition no-underline"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <Avatar
                      nombre={displayName}
                      fotoUrl={advisor.foto_perfil_url}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8C6526]">
                        {isAgency ? (
                          <>
                            <Building2 size={11} />
                            {isEn ? 'Real Estate Agency' : 'Inmobiliaria'}
                          </>
                        ) : (
                          <>
                            <Users size={11} />
                            {isEn ? 'Real Estate Advisor' : 'Asesor Inmobiliario'}
                          </>
                        )}
                      </span>
                      <h2 className="text-base font-extrabold text-[#16294B] group-hover:underline truncate mt-0.5 mb-0 flex items-center gap-1.5">
                        <span className="truncate">{displayName}</span>
                        {advisor.verificado && <BadgeVerificado size="sm" />}
                      </h2>
                      {place && (
                        <p className="text-xs text-[#64748B] flex items-center gap-1 mt-1 mb-0">
                          <MapPin size={12} aria-hidden="true" />
                          <span className="truncate">{place}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {advisor.descripcion_agente && (
                    <p className="text-xs text-[#475569] line-clamp-2 mt-3 mb-0 leading-relaxed">
                      {advisor.descripcion_agente}
                    </p>
                  )}

                  {advisor.licencia_corredor && (
                    <p className="text-[11px] font-semibold text-[#16294B] flex items-center gap-1 mt-2.5 mb-0">
                      <Award size={12} className="text-[#8C6526]" />
                      <span className="truncate">{advisor.licencia_corredor}</span>
                    </p>
                  )}

                  {advisor.zonas_especialidad?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {advisor.zonas_especialidad.slice(0, 3).map((z) => (
                        <span
                          key={z}
                          className="rounded-full bg-[#f7f4ee] border border-[#e7dfd1] px-2 py-0.5 text-[10px] font-medium text-[#16294B]"
                        >
                          {z}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3.5 border-t border-[#f0ebe1] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-[#475569]">
                    <span>
                      <strong className="text-[#16294B]">{advisor.propiedades_activas}</strong>{' '}
                      {isEn ? 'active' : 'activos'}
                    </span>
                    {advisor.num_resenas > 0 && (
                      <span className="inline-flex items-center gap-1 font-bold text-[#8C6526]">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {Number(advisor.promedio_resenas).toFixed(1)} ({advisor.num_resenas})
                      </span>
                    )}
                    {advisor.visitas_atendidas > 0 && (
                      <span className="inline-flex items-center gap-1 text-teal-800 font-medium">
                        <CalendarCheck size={12} />
                        {advisor.visitas_atendidas}
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 font-bold text-[#16294B]">
                    <span>{isEn ? 'View portfolio' : 'Ver cartera'}</span>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </LocalLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
