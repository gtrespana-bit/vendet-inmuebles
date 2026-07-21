'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle, Zap, Star, X, Copy, Upload, Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

const paquetesCredito = [
  { creditos: 2, precio: 1, descripcion: 'Para empezar', popular: false },
  { creditos: 15, precio: 5, descripcion: '¡El más elegido!', popular: true },
  { creditos: 40, precio: 10, descripcion: 'Para vendedores activos', popular: false },
  { creditos: 100, precio: 20, descripcion: 'Máximo ahorro', popular: false },
]

const metodosPago = [
  {
    id: 'pagomovil', nombre: 'Pago Móvil', emoji: '📱',
    instrucciones: { telefono: '04126443099', cedula: 'V20794917', banco: 'Banco Provincial BBVA' },
  },
  { id: 'binance', nombre: 'Binance Pay', emoji: '🟡', instrucciones: { id: '204147542' } },
]

const FALLBACK_TASA = 487.12

function ModalPago({ paquete, tasa, onClose }: { paquete: any; tasa: number; onClose: () => void }) {
  const t = useTranslations('creditos')
  const router = useRouter()
  const [metodo, setMetodo] = useState('')
  const [copiado, setCopiado] = useState('')
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const precioBs = (paquete.precio * tasa).toFixed(2)
  const selectedMetodo = metodosPago.find(m => m.id === metodo)
  const isPagoMovil = metodo === 'pagomovil'

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiado(label)
    setTimeout(() => setCopiado(''), 2000)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB'); return }
    setComprobanteFile(file)
    setComprobantePreview(URL.createObjectURL(file))
  }

  const procesarCompra = async () => {
    if (!metodo) { alert('Selecciona un método de pago'); return }
    if (!comprobanteFile) { alert('Sube el comprobante'); return }

    setEnviando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/login?redirect=/creditos`); return }

      const fileExt = comprobanteFile.name.split('.').pop()
      const fileName = `comprobante_${user.id}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(fileName, comprobanteFile, { contentType: comprobanteFile.type })
      if (uploadError) { alert('Error subiendo: ' + uploadError.message); setEnviando(false); return }

      const { data: { publicUrl } } = supabase.storage.from('comprobantes').getPublicUrl(fileName)

      const res = await fetch('/api/comprar-creditos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          creditos: paquete.creditos,
          precioUsd: paquete.precio,
          metodoPago: selectedMetodo?.nombre || metodo,
          comprobanteUrl: publicUrl,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setEnviado(true)
      } else {
        alert('Error: ' + (data.error || 'Error procesando'))
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Error desconocido'))
    }
    setEnviando(false)
  }

  if (enviado) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center">
        <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl p-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-brand-primary" />
          </div>
          <h3 className="text-xl font-bold text-brand-primary mb-2">{t('receiptSent')}</h3>
          <p className="text-sm text-gray-600 mb-4" dangerouslySetInnerHTML={{ __html: t('receiptDesc').replace('{count}', String(paquete.creditos)) }}>
          </p>
          <button onClick={onClose} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-dark transition">{t('closeBtn')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{paquete.creditos} {t('credits')} — ${paquete.precio} USD</h3>
            <p className="text-sm text-gray-500">≈ Bs. {precioBs}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Método de pago */}
          <div>
            <h4 className="font-bold text-gray-800 mb-3">{t('choosePayment')}</h4>
            <div className="grid grid-cols-2 gap-3">
              {metodosPago.map(m => (
                <button key={m.id} onClick={() => setMetodo(m.id)}
                  className={`p-4 rounded-xl border-2 text-center transition ${metodo === m.id ? 'border-brand-accent bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-3xl block">{m.emoji}</span>
                  <span className="text-sm font-medium text-gray-700 mt-1 block">{m.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Monto a pagar en Bs — solo Pago Móvil */}
          {isPagoMovil && (
            <div className="bg-brand-primary/5 border-2 border-brand-primary/20 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1 text-center">{t('amountPay')}</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl font-black text-brand-primary">Bs. {precioBs}</p>
                <button
                  onClick={() => copyToClipboard(precioBs, 'precioBs')}
                  className="flex items-center gap-1 bg-white border border-brand-primary/30 rounded-lg px-3 py-2 text-sm text-brand-primary hover:bg-brand-primary/5 transition"
                >
                  {copiado === 'precioBs' ? '✓' : t('copy')}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 text-center">{t('rateLabel')} Bs. {tasa.toFixed(2)} / ${paquete.precio}</p>
            </div>
          )}

          {/* Datos de pago */}
          {selectedMetodo && (
            <div>
              <h4 className="font-bold text-gray-800 mb-3">{t('paymentData')}</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {Object.entries(selectedMetodo.instrucciones).map(([key, value]) => {
                  const labelMap: Record<string, string> = { telefono: t('phone'), cedula: t('idCard'), banco: t('bank'), id: 'Binance ID' }
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500">{labelMap[key] || key}</span>
                        <p className="text-sm font-medium text-gray-800">{value as string}</p>
                      </div>
                      <button onClick={() => copyToClipboard(value as string, key)} className="text-xs bg-white border rounded-md px-2 py-1 hover:bg-gray-100 transition ml-2">
                        {copiado === key ? t('copied') : t('copy')}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Comprobante */}
          {selectedMetodo && (
            <div>
              <h4 className="font-bold text-gray-800 mb-3">{t('uploadReceipt')}</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-primary transition cursor-pointer"
                onClick={() => document.getElementById('comprobante-input')?.click()}>
                <input type="file" accept="image/*" id="comprobante-input" onChange={handleFileChange} className="hidden" />
                {comprobantePreview ? (
                  <div>
                    <Image src={comprobantePreview} alt="Comprobante" className="max-h-48 mx-auto rounded-lg mb-3" width={400} height={300} unoptimized />
                    <button onClick={(e) => { e.stopPropagation(); setComprobanteFile(null); setComprobantePreview('') }} className="text-sm text-red-500 hover:underline">{t('removeImage')}</button>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">{t('tapUpload')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('maxFile')}</p>
                  </>
                )}
              </div>
              <button onClick={procesarCompra} disabled={enviando || !comprobanteFile}
                className="w-full mt-4 bg-brand-primary text-white py-3.5 rounded-xl font-bold hover:bg-brand-dark transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {enviando ? <><Loader2 size={18} className="animate-spin" /> {t('sending')}</> : <><Upload size={18} /> {t('sendReceipt')}</>}
              </button>
            </div>
          )}

          {!metodo && (
            <div className="text-center py-4 text-sm text-gray-400">
              {t('selectPayment')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-4">{t('title1')} <span className="text-brand-accent">{t('title2')}</span></h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto" dangerouslySetInnerHTML={{ __html: t('subtitle') }}></p>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('whatFor')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-xl p-6 hover:border-brand-accent transition">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-yellow-50 text-brand-accent"><Zap size={28} /></div>
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
                {pkg.popular && <div className="bg-brand-accent text-brand-primary text-center py-1.5 text-xs font-bold">{t('mostPopular')}</div>}
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
