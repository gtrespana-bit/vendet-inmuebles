"use client"

import { useState, useEffect } from 'react'
import { CreditCard, Zap, Star, X, CheckCircle, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

const metodosPagoCreditos = [
  { id: 'pagomovil', nombre: 'Pago Móvil', emoji: '📱', instrucciones: { telefono: '04126443099', cedula: 'V20794917', banco: 'Banco Provincial BBVA' } },
  { id: 'binance', nombre: 'Binance Pay', emoji: '🟡', instrucciones: { id: '204147542' } },
]

export default function TabCreditos({ creditos, tasaBs, refreshCreditos }: { creditos: number; tasaBs: number; refreshCreditos: () => void }) {
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<any>(null)
  const [tasa, setTasa] = useState<number>(tasaBs || 487.12)

  useEffect(() => {
    fetch('/api/tasa-bcv').then(r => r.json()).then(d => { if (d.tasa) setTasa(d.tasa) }).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="bg-gradient-to-r from-brand-primary to-blue-900 rounded-2xl p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">Tu balance actual</p>
          <p className="text-4xl font-black">{creditos} créditos</p>
        </div>
        <CreditCard size={40} className="opacity-50" />
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-lg mb-3">¿Para qué sirven?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="font-bold text-brand-primary flex items-center gap-2"><Zap size={18} className="text-yellow-500" /> Boost — 1 crédito</p>
            <p className="text-sm text-gray-600 mt-1">Sube tu publicación al #1 de la lista</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="font-bold text-brand-primary flex items-center gap-2"><Star size={18} className="text-brand-accent" /> Destacado</p>
            <p className="text-sm text-gray-600 mt-1">4cr/12h · 6cr/24h · 10cr/48h</p>
          </div>
        </div>
      </div>

      {/* Paquetes */}
      <h3 className="text-xl font-bold text-gray-800 text-center">Elige tu paquete</h3>
      <p className="text-center text-sm text-gray-500">Tasa BCV: <span className="font-bold text-brand-primary">Bs. {tasa.toFixed(2)} por $</span></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { creditos: 2, precio: 1, descripcion: 'Para empezar', popular: false },
          { creditos: 15, precio: 5, descripcion: '¡El más elegido!', popular: true },
          { creditos: 40, precio: 10, descripcion: 'Para vendedores activos', popular: false },
          { creditos: 100, precio: 20, descripcion: 'Máximo ahorro', popular: false },
        ].map((pkg) => {
          const porCredito = (pkg.precio / pkg.creditos).toFixed(2)
          const precioBs = (pkg.precio * tasa).toFixed(2)
          return (
            <div key={pkg.creditos} className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition hover:-translate-y-1 ${pkg.popular ? 'border-brand-accent' : 'border-transparent'}`}>
              {pkg.popular && <div className="bg-brand-accent text-brand-primary text-center py-1.5 text-xs font-bold">⭐ MÁS POPULAR</div>}
              <div className="bg-gradient-to-br from-brand-primary to-blue-800 p-6 text-white text-center">
                <p className="text-5xl font-black">{pkg.creditos}</p>
                <p className="text-sm opacity-80">créditos</p>
              </div>
              <div className="p-6 text-center">
                <p className="text-3xl font-black text-gray-800 mb-1">${pkg.precio} <span className="text-sm font-normal text-gray-500">USD</span></p>
                <p className="text-sm text-gray-400 mb-4">≈ Bs. {precioBs}</p>
                <p className="text-xs text-gray-500 mb-5 bg-gray-50 rounded-lg py-1 px-2 inline-block">${porCredito} por crédito</p>
                <ul className="text-sm text-gray-600 space-y-2 mb-6 text-left">
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" /><strong>{pkg.creditos}</strong> boost(s) al #1</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />o {Math.floor(pkg.creditos / 4)}× destacado 12h</li>
                  <li className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500 flex-shrink-0" />Sin expiración</li>
                </ul>
                <button onClick={() => setPaqueteSeleccionado(pkg)} className="w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition cursor-pointer">Comprar</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Métodos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-lg mb-4 text-center">Métodos de pago aceptados</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { nombre: 'Pago Móvil', emoji: '📱' },
            { nombre: 'Binance Pay', emoji: '🟡' },
            { nombre: 'Transferencia', emoji: '🏦' },
          ].map((m) => (
            <div key={m.nombre} className="rounded-xl p-4 text-center bg-gray-50">
              <span className="text-3xl block mb-2">{m.emoji}</span>
              <p className="text-sm font-medium text-gray-800">{m.nombre}</p>
            </div>
          ))}
        </div>
      </div>

      {paqueteSeleccionado && (
        <ModalCompraCreditos
          paquete={paqueteSeleccionado}
          tasa={tasa}
          onClose={() => setPaqueteSeleccionado(null)}
          onCompraExitosa={refreshCreditos}
        />
      )}
    </div>
  )
}

function ModalCompraCreditos({ paquete, tasa, onClose, onCompraExitosa }: { paquete: any; tasa: number; onClose: () => void; onCompraExitosa: () => void }) {
  const [metodo, setMetodo] = useState('')
  const [copiado, setCopiado] = useState('')
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const precioBs = (paquete.precio * tasa).toFixed(2)
  const selectedMetodo = metodosPagoCreditos.find(m => m.id === metodo)
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
      if (!user) { alert('Debes iniciar sesión'); setEnviando(false); return }

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
        onCompraExitosa()
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
          <h3 className="text-xl font-bold text-brand-primary mb-2">¡Comprobante enviado!</h3>
          <p className="text-sm text-gray-600 mb-4">
            Tu pago será revisado en breve. Recibirás <strong>{paquete.creditos} créditos</strong> cuando se confirme.
          </p>
          <button onClick={onClose} className="w-full bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-dark transition">Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{paquete.creditos} créditos — ${paquete.precio} USD</h3>
            <p className="text-sm text-gray-500">≈ Bs. {precioBs}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Método de pago */}
          <div>
            <h4 className="font-bold text-gray-800 mb-3">1. Elige cómo vas a pagar</h4>
            <div className="grid grid-cols-2 gap-3">
              {metodosPagoCreditos.map(m => (
                <button key={m.id} onClick={() => setMetodo(m.id)}
                  className={`p-4 rounded-xl border-2 text-center transition ${metodo === m.id ? 'border-brand-accent bg-yellow-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-3xl block">{m.emoji}</span>
                  <span className="text-sm font-medium text-gray-700 mt-1 block">{m.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Monto a pagar en Bs */}
          {isPagoMovil && (
            <div className="bg-brand-primary/5 border-2 border-brand-primary/20 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1 text-center">Monto a pagar (Pago Móvil)</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl font-black text-brand-primary">Bs. {precioBs}</p>
                <button onClick={() => copyToClipboard(precioBs, 'precioBs')} className="flex items-center gap-1 bg-white border border-brand-primary/30 rounded-lg px-3 py-2 text-sm text-brand-primary hover:bg-brand-primary/5 transition">
                  {copiado === 'precioBs' ? '✓' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 text-center">Tasa BCV: Bs. {tasa.toFixed(2)} / ${paquete.precio}</p>
            </div>
          )}

          {/* Datos de pago */}
          {selectedMetodo && (
            <div>
              <h4 className="font-bold text-gray-800 mb-3">2. Datos de pago</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {Object.entries(selectedMetodo.instrucciones).map(([key, value]) => {
                  const labelMap: Record<string, string> = { telefono: 'Teléfono', cedula: 'Cédula', banco: 'Banco', id: 'Binance ID' }
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500">{labelMap[key] || key}</span>
                        <p className="text-sm font-medium text-gray-800">{value as string}</p>
                      </div>
                      <button onClick={() => copyToClipboard(value as string, key)} className="text-xs bg-white border rounded-md px-2 py-1 hover:bg-gray-100 transition ml-2">
                        {copiado === key ? '✓ Copiado' : 'Copiar'}
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
              <h4 className="font-bold text-gray-800 mb-3">3. Sube tu comprobante de pago</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-primary transition cursor-pointer"
                onClick={() => document.getElementById('comprobante-input-dash')?.click()}>
                <input type="file" accept="image/*" id="comprobante-input-dash" onChange={handleFileChange} className="hidden" />
                {comprobantePreview ? (
                  <div>
                    <Image src={comprobantePreview} alt="Comprobante" className="max-h-48 mx-auto rounded-lg mb-3" width={400} height={300} unoptimized />
                    <button onClick={(e) => { e.stopPropagation(); setComprobanteFile(null); setComprobantePreview('') }} className="text-sm text-red-500 hover:underline">Quitar imagen</button>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Toca para subir captura del pago</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG — máx 5MB</p>
                  </>
                )}
              </div>
              <button onClick={procesarCompra} disabled={enviando || !comprobanteFile}
                className="w-full mt-4 bg-brand-primary text-white py-3.5 rounded-xl font-bold hover:bg-brand-dark transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {enviando ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : <><Upload size={18} /> Enviar comprobante</>}
              </button>
            </div>
          )}

          {!metodo && (
            <div className="text-center py-4 text-sm text-gray-400">Selecciona un método de pago para continuar ↓</div>
          )}
        </div>
      </div>
    </div>
  )
}
