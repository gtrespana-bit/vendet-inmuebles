import { NextResponse } from 'next/server'
import { recipientData } from '@/lib/payment-catalog'
export const dynamic = 'force-dynamic'
export async function GET() {
  const recipients = recipientData()
  return NextResponse.json({ pagoMovil: recipients.pagomovil, binance: recipients.binance })
}
