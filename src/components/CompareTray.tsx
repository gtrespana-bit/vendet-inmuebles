'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowRight, Scale, Trash2, X } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { usePropertyCompare } from '@/hooks/usePropertyCompare'
import { isOptimizableImageSrc } from '@/lib/image-src'

export default function CompareTray() {
  const pathname = usePathname()
  const { items, count, max, remove, clear } = usePropertyCompare()

  const isEn = pathname === '/en' || pathname.startsWith('/en/')
  const onComparePage = pathname === '/comparar' || pathname === '/en/comparar'

  if (count === 0 || onComparePage) return null

  const compareHref = `/comparar?ids=${encodeURIComponent(items.map((i) => i.id).join(','))}`

  return (
    <aside
      aria-label={isEn ? 'Property comparison bar' : 'Barra de comparación de inmuebles'}
      className="fixed bottom-16 md:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-4xl bg-[#16294B] text-white rounded-2xl shadow-2xl border border-white/15 px-3.5 py-2.5 backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#B08542]/20 text-[#E5C17B]">
            <Scale size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide uppercase text-[#E5C17B] m-0">
              {isEn ? `Compare (${count}/${max})` : `Comparador (${count}/${max})`}
            </p>
            <p className="text-[11px] text-white/75 truncate m-0">
              {count < 2
                ? isEn
                  ? 'Select at least 1 more property to compare side by side'
                  : 'Selecciona al menos 1 inmueble más para compararlos lado a lado'
                : isEn
                  ? 'Ready to compare prices, $/m² and amenities'
                  : 'Listo para comparar precios, $/m² y amenidades'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 flex-1 justify-center overflow-x-auto py-0.5">
          {items.map((item) => {
            const img = item.image || '/sinimagen.webp'
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 bg-white/10 rounded-xl pl-1.5 pr-2 py-1 max-w-[180px]"
              >
                <div className="relative h-7 w-7 shrink-0 rounded-lg overflow-hidden bg-white/10">
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="28px"
                    unoptimized={!isOptimizableImageSrc(img)}
                    className="object-cover"
                  />
                </div>
                <span className="text-xs text-white truncate">{item.title}</span>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="text-white/65 hover:text-white p-0.5"
                  aria-label={isEn ? `Remove ${item.title}` : `Quitar ${item.title}`}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-white/75 hover:text-white hover:bg-white/10 transition"
          >
            <Trash2 size={13} aria-hidden="true" />
            <span className="hidden md:inline">{isEn ? 'Clear' : 'Limpiar'}</span>
          </button>
          <LocalLink
            href={compareHref}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#B08542] hover:bg-[#c5964d] text-[#111827] font-bold text-xs px-3.5 py-2 transition no-underline"
          >
            <span>{isEn ? `Compare (${count})` : `Comparar (${count})`}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </LocalLink>
        </div>
      </div>
    </aside>
  )
}
