"use client"

import { X, Zap } from 'lucide-react'

export default function BoostModal({ titulo, onBoost, onClose }: { titulo: string; onBoost: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">⚡ Boost — Subir al #1</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4"><strong>{titulo}</strong></p>
        <p className="text-sm text-gray-600 mb-2">Esto subirá tu publicación a la <strong>posición #1</strong> de la lista.</p>
        <p className="text-sm text-gray-600 mb-4">Si otra persona hace boost después, tomará tu lugar.</p>
        <div className="flex items-center gap-2 mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <Zap size={20} className="text-yellow-600" />
          <span className="font-bold text-brand-primary">Costo: 1 crédito</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={onBoost} className="flex-1 py-3 bg-brand-accent text-brand-primary rounded-lg font-bold hover:bg-accent/90">⚡ Boost (1 crédito)</button>
        </div>
      </div>
    </div>
  )
}
