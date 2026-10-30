type BrandMarkProps = {
  size?: number
  className?: string
}

/**
 * Inline brand mark. Rendered as inline SVG (instead of an <img>) so the tile
 * and roof colours follow the active palette tokens set by the theme switcher.
 */
export function BrandMark({ size = 38, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'block', flex: '0 0 auto' }}
    >
      <rect width="128" height="128" rx="28" fill="var(--burgundy, #16294B)" />
      <path
        d="M22 61 64 25l42 36"
        fill="none"
        stroke="var(--gold, #B08542)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
      />
      <path d="M34 57v48h60V57L64 31 34 57Z" fill="#fff" />
      <path d="M56 78h16v27H56z" fill="var(--burgundy, #16294B)" />
      <path d="M43 67h10v10H43zM75 67h10v10H75z" fill="var(--gold, #B08542)" />
    </svg>
  )
}

export default BrandMark
