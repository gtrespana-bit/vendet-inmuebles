import { notFound } from 'next/navigation'

/**
 * Páginas de diagnóstico y pruebas internas: solo existen en desarrollo.
 * En producción (build `next build`) devuelven 404 real.
 */
export function devOnlyPage(): void {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
}
