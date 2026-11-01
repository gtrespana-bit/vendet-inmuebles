'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle, Zap, Star
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'

const paquetesCredito = [
  { creditos: 2, precio: 1, descripcion: 'Para empezar', popular: false },
  { creditos: 15, precio: 5, descripcion: '¡El más elegido!', popular: true },
  { creditos: 40, precio: 10, descripcion: 'Para vendedores activos', popular: false },
  { creditos: 100, precio: 20, descripcion: 'Máximo ahorro', popular: false },
]

const FALLBACK_TASA = 487.12

function ModalPago({ paquete, onClose }: { paquete: any; tasa: number; onClose: () => void }) {
  const t = useTranslations('creditos')
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Pago">
    <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4">
      <h2 className="text-xl font-bold">{paquete.creditos} {t('credits')} · ${paquete.precio}</h2>
      <LocalLink href={`/pagos?creditos=${paquete.creditos}`} className="block bg-brand-primary text-white p-3 rounded text-center">Pago Móvil / Binance Pay →</LocalLink>
      <button onClick={onClose} className="w-full p-3 border rounded">{t('closeBtn')}</button>
    </div>
  </div>
}

export default function CreditosPage() {
  const t = useTranslations('creditos')
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<any>(null)
  const [tasa, setTasa] = useState<number>(FALLBACK_TASA)
  const [tasaCargando, setTasaCargando] = useState(true)

  useEffect(() => {
    fetch('/api/tasa-bcv').then(r => r.json()).then(d => { if (d.tasa) setTasa(d.tasa) }).catch(() => {}).finally(() => setTasaCargando(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-4">{t('title1')} <span className="text-[var(--gold-text)]">{t('title2')}</span></h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: t('subtitle') }}></p>
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
                <p className="text-sm text-gray-500 mb-3" dangerouslySetInnerHTML={{ __html: t('boostDesc') }}></p>
                <span className="text-brand-primary font-bold text-2xl">{t('boostPrice')}</span>
              </div>
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-brand-primary"><Star size={28} /></div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg mb-1">{t('featureTitle')}</h3>
                <p className="text-sm text-gray-500 mb-3" dangerouslySetInnerHTML={{ __html: t('featureDesc') }}></p>
                <div className="space-y-1 text-sm">
                  <p className="text-brand-primary font-bold">4 créditos → 12h</p>
                  <p className="text-brand-primary font-bold">6 créditos → 24h</p>
                  <p className="text-brand-primary font-bold">10 créditos → 48h</p>
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
          <p className="text-center text-sm text-gray-500 mb-4">{t('rateLabel')} <span className="font-bold text-brand-primary">Bs. {tasa.toFixed(2)} por $</span></p>
        )}

        <div className="creditos-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {paquetesCredito.map((pkg) => {
            const porCredito = (pkg.precio / pkg.creditos).toFixed(2)
            const precioBs = (pkg.precio * tasa).toFixed(2)
            return (
              <div key={pkg.creditos} className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition hover:-translate-y-1 ${pkg.popular ? 'border-brand-accent' : 'border-transparent'}`}>
                {pkg.popular && <div className="bg-brand-accent text-[var(--on-gold)] text-center py-1.5 text-xs font-bold">{t('mostPopular')}</div>}
                <div className="bg-gradient-to-br from-brand-primary to-blue-800 p-6 text-white text-center">
                  <p className="text-5xl font-black">{pkg.creditos}</p>
                  <p className="text-sm opacity-80">{t('credits')}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-3xl font-black text-gray-800 mb-1">${pkg.precio} <span className="text-sm font-normal text-gray-500">USD</span></p>
                  <p className="text-sm text-gray-400 mb-4">≈ Bs. {precioBs}</p>
                  <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg py-1 px-2 inline-block">${porCredito} {t('perCredit')}</p>
                  <ul className="text-sm text-gray-600 space-y-2 mb-6 text-left">
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" /><strong>{pkg.creditos}</strong> {t('boosts')}</li>
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />{t('orFeatured').replace('{count}', String(Math.floor(pkg.creditos / 4)))}</li>
                    <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />{t('noExpiration')}</li>
                  </ul>
                  <button onClick={() => setPaqueteSeleccionado(pkg)} className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition cursor-pointer">{t('buy')}</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Métodos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('paymentMethods')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { nombre: 'Pago Móvil', emoji: '📱', ok: true },
            { nombre: 'Binance Pay', emoji: '🟡', ok: true },
            { nombre: 'Transferencia', emoji: '🏦', ok: true },
          ].map((m) => (
            <div key={m.nombre} className={`rounded-xl p-4 text-center ${m.ok ? 'bg-gray-50' : 'bg-gray-50 opacity-50'}`}>
              <span className="text-3xl block mb-2">{m.emoji}</span>
              <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
              {!m.ok && <p className="text-[10px] text-gray-400 mt-1">{t('notOperational')}</p>}
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

      {paqueteSeleccionado && <ModalPago paquete={paqueteSeleccionado} tasa={tasa} onClose={() => setPaqueteSeleccionado(null)} />}
    </div>
  )
}
