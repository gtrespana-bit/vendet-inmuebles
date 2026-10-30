'use client'

import LocalLink from '@/components/LocalLink'
import { ArrowUpRight, MessageSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function TabMensajes() {
  const t = useTranslations('dashboard')

  return (
    <section className="dashboard-empty-state" aria-labelledby="dashboard-messages-title">
      <MessageSquare size={35} className="mx-auto mb-4 text-[#9b8053]" aria-hidden="true" />
      <p className="dashboard-page__eyebrow">{t('tabMessages')}</p>
      <h2 id="dashboard-messages-title">{t('messagesPanelTitle')}</h2>
      <p>{t('messagesPanelDescription')}</p>
      <LocalLink href="/chat">{t('messagesOpenChat')} <ArrowUpRight size={15} className="ml-2" aria-hidden="true" /></LocalLink>
    </section>
  )
}
