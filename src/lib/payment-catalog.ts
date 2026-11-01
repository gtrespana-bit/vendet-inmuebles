/** Prices and recipient data shared by checkout and server validation. */
export const CREDIT_PACKAGES = [
  { creditos: 2, precio: 1 }, { creditos: 15, precio: 5 },
  { creditos: 40, precio: 10 }, { creditos: 100, precio: 20 },
] as const
export const PLAN_PRICES = { profesional: 9.99, agencia: 39.99 } as const
export const PAYMENT_METHODS = {
  pagomovil: { nombre: 'Pago Móvil', instrucciones: { telefono: '04126443099', cedula: 'V20794917', banco: 'Banco Provincial BBVA' } },
  binance: { nombre: 'Binance Pay', instrucciones: { id: '204147542' } },
} as const
export function recipientData() {
  return {
    pagomovil: {
      telefono: process.env.PAGO_MOVIL_TELEFONO?.trim() || PAYMENT_METHODS.pagomovil.instrucciones.telefono,
      cedula: process.env.PAGO_MOVIL_CEDULA?.trim() || PAYMENT_METHODS.pagomovil.instrucciones.cedula,
      banco: process.env.PAGO_MOVIL_BANCO?.trim() || PAYMENT_METHODS.pagomovil.instrucciones.banco,
    },
    binance: { id: process.env.BINANCE_PAY_ID?.trim() || PAYMENT_METHODS.binance.instrucciones.id },
  }
}
