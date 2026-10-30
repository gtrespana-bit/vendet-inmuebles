'use client'

import { useState } from 'react'
import { ArrowRight, MessageCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'

export function FloatingChat() {
  const [open, setOpen] = useState(false)
  const t = useTranslations('floatingChat')

  return (
    <div className="floating-chat">
      {open && (
        <section
          className="floating-chat__panel bg-white border border-[#e5ddd2] shadow-2xl mb-4 overflow-hidden"
          aria-label={t('title')}
        >
          <div className="bg-[var(--burgundy)] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 bg-white/10 flex items-center justify-center" aria-hidden="true">
                <MessageCircle size={19} />
              </span>
              <div>
                <p className="font-bold text-sm">{t('title')}</p>
                <p className="text-xs text-[#e7d6ba]">{t('status')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 hover:bg-white/10 transition"
              aria-label={t('close')}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="p-4 bg-[#faf8f4]">
            <p className="text-[#5e554c] text-sm leading-relaxed">{t('greeting')}</p>
            <LocalLink
              href="/contacto"
              className="inline-flex items-center gap-2 mt-4 min-h-10 px-4 bg-[var(--burgundy)] text-white text-sm font-semibold no-underline hover:bg-[var(--burgundy-dark)] transition"
            >
              {t('contact')} <ArrowRight size={15} aria-hidden="true" />
            </LocalLink>
          </div>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-14 h-14 bg-[var(--burgundy)] text-white shadow-lg hover:bg-[var(--burgundy-dark)] transition flex items-center justify-center"
        aria-expanded={open}
        aria-label={open ? t('close') : t('open')}
      >
        {open ? <X size={24} aria-hidden="true" /> : <MessageCircle size={24} aria-hidden="true" />}
      </button>
    </div>
  )
}
