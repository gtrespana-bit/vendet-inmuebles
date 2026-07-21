"use client"

import { X, Star } from 'lucide-react'
import LocalLink from '@/components/LocalLink'

export default function DestacadoModal({ titulo, creditos, onDestacar, onClose }: { titulo: string; creditos: number; onDestacar: (horas: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">⭐ Destacar publicación</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4"><strong>{titulo}</strong></p>
        <p className="text-sm text-gray-600 mb-4">Tu publicación aparecerá:</p>
        <ul className="text-sm text-gray-600 space-y-1 mb-6">
          <li className="flex items-center gap-2"><Star size={14} className="text-brand-accent" /> En la <strong>página principal</strong> como destacado</li>
          <li className="flex items-center gap-2"><Star size={14} className="text-brand-accent" /> Con <strong>prioridad</strong> en resultados de búsqueda</li>
        </ul>
        <div className="space-y-2 mb-6">
          {[
            { horas: 12, creditos: 4 },
            { horas: 24, creditos: 6 },
            { horas: 48, creditos: 10 },
          ].map(op => (
            <button key={op.horas} onClick={() => onDestacar(op.horas)} disabled={creditos < op.creditos}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition ${creditos >= op.creditos ? 'border-gray-200 hover:border-brand-accent hover:bg-yellow-50' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}`}>
              <span className="font-bold text-gray-800">{op.horas} horas</span>
              <span className="text-sm font-bold text-brand-primary">{op.creditos} créditos</span>
              {creditos < op.creditos && <span className="text-[10px] text-red-500">insuficiente</span>}
            </button>
          ))}
        </div>
        <LocalLink href="/creditos" className="block text-center text-sm text-brand-primary hover:underline">¿Necesitas más créditos? Comprar →</LocalLink>
      </div>
    </div>
  )
}
