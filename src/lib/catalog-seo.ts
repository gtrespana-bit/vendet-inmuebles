import type { Metadata } from 'next'

/**
 * Política de indexación del catálogo (`/catalogo`) — auditoría SEO 2026-11-14, punto 4.
 *
 * Situación de partida
 * --------------------
 * `CatalogoPage.tsx` es un componente de cliente que lee hasta 17 parámetros de la query
 * (`pagina`, `orden`, `zona`, `precioMin`, `precioMax`, `estado`, `ciudad`, `operacion`,
 * `habitaciones`, `amenidades`, `q`, …). `generateMetadata` fijaba un canonical estático a
 * `/catalogo` para **todos** esos estados, pero no declaraba ninguna directiva `robots`,
 * así que cualquier combinación de filtros era indexable como una URL distinta.
 *
 * Política adoptada
 * -----------------
 * 1. **Una sola URL indexable**: `/catalogo` sin parámetros. Es la única que recibe enlaces
 *    internos desde la cabecera y el pie, y la que concentra la autoridad.
 * 2. **Canonical siempre a `/catalogo`** (sin parámetros), sea cual sea la vista. Así ninguna
 *    variante compite consigo misma.
 * 3. **Cualquier vista con parámetros → `noindex, follow`**. Son combinaciones casi infinitas
 *    de contenido duplicado o parcial, y compiten además con las páginas SEO dedicadas que ya
 *    existen (`/propiedades/venta`, `/propiedades/alquiler/<estado>/<ciudad>`, `/caracas`, …).
 *    Se mantiene `follow` para que Google pueda recorrer los enlaces a las fichas.
 * 4. **No se bloquea nada en `robots.txt`**. `Disallow` impediría que Google leyera el
 *    `noindex`; hay que permitir el rastreo para que la directiva surta efecto.
 *
 * Sobre la paginación: los controles de paginación son `<button>` con `onClick`
 * (`src/components/Pagination.tsx`), no enlaces `<a href>`, así que `?pagina=N` no se
 * descubre desde el propio catálogo. Las fichas son alcanzables igualmente porque están
 * todas en `sitemap.xml`. Si algún día la paginación pasa a ser enlace rastreable, conviene
 * revisar este punto (canonical autorreferenciado en `?pagina=N`, N ≥ 2).
 */

export type CatalogSearchParams = Record<string, string | string[] | undefined>

/** ¿Hay algún parámetro con valor efectivo en la query? */
export function hasActiveCatalogParams(searchParams: CatalogSearchParams | undefined): boolean {
  if (!searchParams) return false

  return Object.values(searchParams).some((value) => {
    if (value === undefined || value === null) return false
    if (Array.isArray(value)) return value.some((item) => item !== '')
    return value !== ''
  })
}

/**
 * Directiva `robots` para una vista del catálogo.
 * La vista canónica (`/catalogo` a secas) se indexa; el resto, `noindex, follow`.
 */
export function catalogRobots(
  searchParams: CatalogSearchParams | undefined
): NonNullable<Metadata['robots']> {
  return hasActiveCatalogParams(searchParams)
    ? { index: false, follow: true, googleBot: { index: false, follow: true } }
    : { index: true, follow: true }
}
