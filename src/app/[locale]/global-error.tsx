'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { reportarErrorCliente } from '@/components/ClientErrorMonitor'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const t = useTranslations('errorPage')
  const [codigoRef, setCodigoRef] = useState<string | null>(null)

  useEffect(() => {
    void reportarErrorCliente({
      origen: 'react_boundary',
      severidad: 'critico',
      nombre: error.name || 'GlobalError',
      mensaje: error.message || 'Fallo crítico en layout raíz',
      codigoError: error.digest ? `DIGEST:${error.digest}` : null,
      stack: error.stack || null,
    }).then(ref => {
      if (ref) setCodigoRef(ref)
    })
  }, [error])

  return (
    <html lang="es">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h1>
            <p className="text-gray-500 mb-4">{t('desc')}</p>
            {(codigoRef || error.digest) && (
              <p className="text-xs text-gray-400 font-mono mb-5">
                Código de referencia: {codigoRef || error.digest}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
