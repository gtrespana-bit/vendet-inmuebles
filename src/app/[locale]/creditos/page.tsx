'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Zap, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import { CREDIT_PACKAGES } from '@/lib/payment-catalog'

const POPULAR_CREDITS = 15
const FALLBACK_TASA = 487.12

export default function CreditosPage() {
  const t = useTranslations('creditos')
  const [tasa, setTasa] = useState<number>(FALLBACK_TASA)
  const [tasaCargando, setTasaCargando] = useState(true)

  useEffect(() => {
    fetch('/api/tasa-bcv')
      .then((r) => r.json())
      .then((d) => { if (d.tasa) setTasa(d.tasa) })
      .catch(() => {})
      .finally(() => setTasaCargando(false))
  }, [])

  const richTags = {
    strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-4">
          {t('title1')} <span className="text-[var(--gold-text)]">{t('title2')}</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto">
          {t.rich('subtitle', richTags)}
        </p>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('whatFor')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-yellow-50 text-[var(--gold-text)]"><Zap size={28} /></div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{t('boostTitle')}</h3>
                <p className="text-sm text-gray-500 mb-3">{t.rich('boostDesc', richTags)}</p>
                <span className="text-brand-primary font-bold text-2xl">{t('boostPrice')}</span>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-brand-primary"><Star size={28} /></div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{t('featureTitle')}</h3>
                <p className="text-sm text-gray-500 mb-3">{t.rich('featureDesc', richTags)}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-brand-primary font-bold">{t('tier12h')}</p>
                  <p className="text-brand-primary font-bold">{t('tier24h')}</p>
                  <p className="text-brand-primary font-bold">{t('tier48h')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Paquetes */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">{t('choosePackage')}</h2>
        {tasaCargando ? (
          <p className="text-center text-sm text-gray-400 mb-4 animate-pulse">{t('loadingRate')}</p>
        ) : (
          <p className="text-center text-sm text-gray-500 mb-4">
            {t('rateLabel')} <span className="font-bold text-brand-primary">Bs. {tasa.toFixed(2)} / USD</span>
          </p>
        )}

        <div className="creditos-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CREDIT_PACKAGES.map((pkg) => {
            const popular = pkg.creditos === POPULAR_CREDITS
            const porCredito = (pkg.precio / pkg.creditos).toFixed(2)
            const precioBs = (pkg.precio * tasa).toFixed(2)
            const featuredCount = Math.floor(pkg.creditos / 4)
            return (
              <div
                key={pkg.creditos}
                className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition hover:-translate-y-1 ${popular ? 'border-brand-accent' : 'border-transparent'}`}
              >
                {popular && (
                  <div className="bg-brand-accent text-[var(--on-gold)] text-center py-1.5 text-xs font-bold">
                    {t('mostPopular')}
                  </div>
                )}
                <div className="bg-gradient-to-br from-brand-primary to-blue-800 p-6 text-white text-center">
                  <p className="text-5xl font-black">{pkg.creditos}</p>
                  <p className="text-sm opacity-80">{t('credits')}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-3xl font-black text-gray-800 mb-1">
                    ${pkg.precio} <span className="text-sm font-normal text-gray-500">USD</span>
                  </p>
                  <p className="text-sm text-gray-400 mb-4">≈ Bs. {precioBs}</p>
                  <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg py-1 px-2 inline-block">
                    ${porCredito} {t('perCredit')}
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 mb-6 text-left">
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      <span><strong>{pkg.creditos}</strong> {t('boosts')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      <span>{featuredCount > 0 ? t('orFeatured', { count: featuredCount }) : t('accumulableFeatured')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      <span>{t('noExpiration')}</span>
                    </li>
                  </ul>
                  <LocalLink
                    href={`/pagos?creditos=${pkg.creditos}`}
                    className="block w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition text-center"
                  >
                    {t('buy')}
                  </LocalLink>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Métodos reales */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('paymentMethods')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
          {[
            { nombre: 'Pago Móvil', emoji: '📱' },
            { nombre: 'Binance Pay', emoji: '🟡' },
          ].map((m) => (
            <div key={m.nombre} className="rounded-xl p-4 text-center bg-gray-50">
              <span className="text-3xl block mb-2">{m.emoji}</span>
              <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
          <h3 className="font-bold text-brand-primary text-sm mb-2">{t('howItWorks')}</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
            <li>{t('step4')}</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
