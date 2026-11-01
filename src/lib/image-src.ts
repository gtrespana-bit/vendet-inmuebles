/**
 * Utilidad isomórfica (segura en Server Components y Client Components)
 * para determinar si una URL de imagen puede pasar por el optimizador
 * de `next/image` según `images.remotePatterns` de `next.config.js`.
 *
 * IMPORTANTE: Este archivo NO debe llevar `'use client'` porque es invocado
 * directamente durante el renderizado SSR de Server Components (`PropertyCard`,
 * `LandingCiudad`, etc.).
 */

const SUPABASE_STORAGE_HOST = 'quxbqmqwiacfwbpqioev.supabase.co'

const EXACT_OPTIMIZABLE_HOSTS = new Set([
  'images.unsplash.com',
  'pub-d212837165c545e3956251da001fa37a.r2.dev',
  'pub-cafe0dcf4c8f4ee18f3a6c0761c55493.r2.dev',
  'pub-041fd1fd7ad84ea096c62d9adc68a98f.r2.dev',
])

export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (typeof src !== 'string') return false
  const trimmed = src.trim()
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return false

  // `dangerouslyAllowSVG` está en `false` en `next.config.js`; los SVG deben ir sin optimizar.
  if (/\.svg(?:[?#]|$)/i.test(trimmed)) return false

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') return false
    if (/\.svg$/i.test(parsed.pathname)) return false

    if (parsed.hostname === SUPABASE_STORAGE_HOST) {
      return parsed.pathname.startsWith('/storage/v1/object/')
    }

    return (
      EXACT_OPTIMIZABLE_HOSTS.has(parsed.hostname) ||
      parsed.hostname.endsWith('.r2.dev')
    )
  } catch {
    return false
  }
}
