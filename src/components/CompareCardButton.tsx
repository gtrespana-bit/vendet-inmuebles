'use client'

import { Scale, Check } from 'lucide-react'
import { usePropertyCompare } from '@/hooks/usePropertyCompare'
import { isValidCompareId } from '@/lib/property-compare'

interface CompareCardButtonProps {
  propertyId: string
  propertySlug?: string | null
  title: string
  price?: number | null
  image?: string | null
  location?: string | null
  operation?: string | null
  locale?: string
  className?: string
  variant?: 'icon' | 'pill'
}

export default function CompareCardButton({
  propertyId,
  propertySlug,
  title,
  price,
  image,
  location,
  operation,
  locale = 'es',
  className = '',
  variant = 'icon',
}: CompareCardButtonProps) {
  const { isCompared, toggle, limitNotice, max } = usePropertyCompare()

  if (!isValidCompareId(propertyId)) return null

  const active = isCompared(propertyId)
  const isEn = locale === 'en'

  const label = active
    ? isEn
      ? 'Remove from comparison'
      : 'Quitar de comparación'
    : isEn
      ? 'Compare property'
      : 'Comparar inmueble'

  const pillText = limitNotice
    ? isEn
      ? `Max ${max}`
      : `Máx. ${max}`
    : active
      ? isEn
        ? 'Comparing'
        : 'En comparador'
      : isEn
        ? 'Compare'
        : 'Comparar'

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle({
            id: propertyId,
            slug: propertySlug,
            title,
            price,
            image,
            location,
            operation,
          })
        }}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={`property-detail__action-btn ${active ? 'is-saved' : ''} ${className}`}
      >
        {active ? <Check size={16} aria-hidden="true" /> : <Scale size={16} aria-hidden="true" />}
        <span>{pillText}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({
          id: propertyId,
          slug: propertySlug,
          title,
          price,
          image,
          location,
          operation,
        })
      }}
      aria-pressed={active}
      aria-label={label}
      title={
        limitNotice
          ? isEn
            ? `You can compare up to ${max} properties at once`
            : `Puedes comparar hasta ${max} inmuebles a la vez`
          : label
      }
      className={`property-card__compare-btn ${active ? 'is-active' : ''} ${className}`}
    >
      {active ? <Check size={14} aria-hidden="true" /> : <Scale size={14} aria-hidden="true" />}
    </button>
  )
}
