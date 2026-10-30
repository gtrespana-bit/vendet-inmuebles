'use client'

import { ProductCardLazy } from './ProductCardLazy'
import type { CatalogPropertyRecord } from '@/types/property'

interface OptimizedProductGridProps {
  productos: CatalogPropertyRecord[]
  t: (key: string) => string
  currentPage: number
  itemsPerPage: number
}

export const OptimizedProductGrid = ({ productos, t, currentPage }: OptimizedProductGridProps) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
    {productos.map((product, index) => (
      <ProductCardLazy
        key={`${product.id}-${currentPage}`}
        p={product}
        t={t}
        priority={index === 0 && currentPage === 1}
      />
    ))}
  </div>
)
