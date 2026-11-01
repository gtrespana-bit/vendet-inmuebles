'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { reportarErrorCliente } from '@/components/ClientErrorMonitor'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errorPage')
  const [codigoRef, setCodigoRef] = useState<string | null>(null)

  useEffect(() => {
    void reportarErrorCliente({
      origen: 'react_boundary',
      severidad: 'critico',
      nombre: error.name || 'ErrorRender',
      mensaje: error.message || 'Fallo al renderizar la página',
      codigoError: error.digest ? `DIGEST:${error.digest}` : null,
      stack: error.stack || null,
    }).then(ref => {
      if (ref) setCodigoRef(ref)
    })
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h2>
        <p className="text-gray-500 mb-4 text-sm">{t('desc')}</p>
        {(codigoRef || error.digest) && (
          <p className="text-xs text-gray-400 font-mono mb-6">
            Código de referencia: {codigoRef || error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="bg-brand-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-brand-dark transition"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
