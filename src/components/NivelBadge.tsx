'use client'

import { useTranslations } from 'next-intl'

const ICONOS: Record<number, string> = { 0: '🥉', 1: '🥈', 2: '🥇', 3: '💎', 4: '💠', 5: '👑' }
const NIVELES: Record<number, { nombreKey: string; bg: string; text: string; border: string }> = {
  0: { nombreKey: 'levelBronze', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  1: { nombreKey: 'levelSilver', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  2: { nombreKey: 'levelGold', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-300' },
  3: { nombreKey: 'levelPlatinum', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
  4: { nombreKey: 'levelDiamond', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  5: { nombreKey: 'levelMaster', bg: 'bg-gradient-to-r from-yellow-50 to-purple-50', text: 'text-purple-900', border: 'border-purple-300' },
}

/**
 * Badge de nivel de confianza del vendedor (0-5).
 * Componente compartido: dashboard, perfil público, etc.
 */
export default function NivelBadge({ nivel, showNumber = false }: { nivel: number; showNumber?: boolean }) {
  const t = useTranslations('dashboard')
  const n = Math.min(Math.max(nivel, 0), 5)
  const cfg = NIVELES[n]

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${cfg.bg} ${cfg.border}`}
      title={showNumber ? t('heroLevelOf', { n }) : undefined}
    >
      <span className="text-sm leading-none">{ICONOS[n]}</span>
      <span className={`font-semibold ${cfg.text}`}>{t(cfg.nombreKey)}</span>
    </span>
  )
}
