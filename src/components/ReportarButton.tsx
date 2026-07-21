'use client'

import { useState } from 'react'
import { Flag, X, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const MOTIVOS = [
  { value: 'fraude', label: 'Fraude o estafa' },
  { value: 'ilegal', label: 'Contenido ilegal' },
  { value: 'inapropiado', label: 'Contenido inapropiado' },
  { value: 'spam', label: 'Spam' },
  { value: 'duplicado', label: 'Publicacion duplicada' },
  { value: 'categoria_incorrecta', label: 'Categoria incorrecta' },
  { value: 'otro', label: 'Otro' },
]

export default function ReportarButton({ productoId }: { productoId: string }) {
  const router = useRouter()
  const [mostrar, setMostrar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [yaReportado, setYaReportado] = useState(false)

  if (!productoId) return null

  const handleSubmit = async () => {
    if (!motivo) return
    setEnviando(true)
    try {
      const { data: sesion } = await supabase.auth.getSession()
      if (!sesion?.session) {
        alert('Debes iniciar sesion para reportar')
        setEnviando(false)
        return
      }
      const userId = sesion.session.user.id

      // Check if already reported
      const { count } = await supabase
        .from('denuncias')
        .select('*', { count: 'exact', head: true })
        .eq('producto_id', productoId)
        .eq('reportante_id', userId)
        .eq('estado', 'activa')

      if (count && count > 0) {
        alert('Ya reportaste esta publicacion anteriormente')
        setYaReportado(true)
        setEnviando(false)
        return
      }

      const { error } = await supabase.from('denuncias').insert({
        producto_id: productoId,
        reportante_id: userId,
        motivo,
        descripcion: descripcion.trim() || null,
      })

      if (error?.message?.includes('duplicate')) {
        setYaReportado(true)
      } else if (error) {
        throw error
      } else {
        setExito(true)
        setTimeout(() => {
          setMostrar(false)
          setExito(false)
        }, 2000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      alert('Error al enviar la denuncia: ' + msg)
    }
    setEnviando(false)
  }

  const MOTIVO_ICONS: Record<string, string> = {
    fraude: '\u{1F6AB}',
    ilegal: '\u{1F512}',
    inapropiado: '\u26A0\uFE0F',
    spam: '\u{1F4E2}',
    duplicado: '\u{1F501}',
    categoria_incorrecta: '\u{1F4C2}',
    otro: '\u{1F4DD}',
  }

  return (
    <>
      <button
        onClick={() => setMostrar(true)}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition"
        title="Reportar publicacion"
      >
        <Flag size={16} /> Reportar
      </button>

      {mostrar && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Reportar publicacion</h3>
              <button onClick={() => { setMostrar(false); setYaReportado(false); setExito(false) }} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            {exito ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">{"\u2705"}</div>
                <p className="font-bold text-green-700">Denuncia enviada</p>
                <p className="text-sm text-gray-500 mt-1">Revisaremos la publicacion lo antes posible.</p>
              </div>
            ) : yaReportado ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-3">{"\u2139\uFE0F"}</div>
                <p className="font-bold text-gray-700">Ya reportaste esta publicacion</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <fieldset>
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">Motivo</label>
                    <div className="space-y-1">
                      {MOTIVOS.map(m => (
                        <label
                          key={m.value}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition text-sm ${
                            motivo === m.value ? 'bg-yellow-200/30 border border-yellow-400' : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name="motivo"
                            value={m.value}
                            checked={motivo === m.value}
                            onChange={() => setMotivo(m.value)}
                            className="accent-blue-800"
                          />
                          <span>{MOTIVO_ICONS[m.value]}</span> {m.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1 block">Descripcion (opcional)</label>
                    <textarea
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      placeholder="Explica brevemente el problema..."
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!motivo || enviando}
                  className="w-full mt-4 bg-blue-950 text-white py-2.5 rounded-lg font-bold hover:bg-brand-dark transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={16} /> {enviando ? 'Enviando...' : 'Enviar denuncia'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
