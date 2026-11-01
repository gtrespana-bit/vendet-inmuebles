/** The trial belongs to the account, not to a card. Switching never resets it. */
export function trialDaysRemaining(estado: string | null | undefined, endsAt: string | null | undefined, now = Date.now()): number {
  if (estado !== 'trial' || !endsAt) return 0
  const remaining = Date.parse(endsAt) - now
  return Number.isFinite(remaining) && remaining > 0 ? Math.ceil(remaining / 86_400_000) : 0
}
