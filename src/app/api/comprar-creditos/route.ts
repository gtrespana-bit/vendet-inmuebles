import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/api-auth'

/**
 * POST /api/comprar-creditos (retirado — F08).
 *
 * El circuito antiguo aceptaba importes y cantidades enviados por el navegador
 * y los enviaba a aprobación manual paralela. Todas las compras de créditos y
 * planes pasan ahora por `/api/pagos` (`/pagos`), donde el servidor fija el
 * catálogo, el importe exacto y la conciliación de órdenes.
 * Las transacciones antiguas ya registradas siguen siendo consultables desde
 * administración sin permitir altas nuevas por esta vía.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth.ok) return auth.response

  return NextResponse.json(
    {
      ok: false,
      code: 'DEPRECATED_CHECKOUT',
      redirect: '/pagos',
      error: 'Este método de compra fue reemplazado. Realiza tu compra desde la página de Pagos (/pagos).',
    },
    { status: 410 }
  )
}
