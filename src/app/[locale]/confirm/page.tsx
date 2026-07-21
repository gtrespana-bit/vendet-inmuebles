'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

export default function ConfirmEmailPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Supabase envía el token en el hash de la URL: #access_token=xxx&type=signup
    const hash = window.location.hash
    if (!hash || hash.length < 2) {
      setStatus('error')
      setErrorMsg(t('noToken'))
      return
    }

    const params = new URLSearchParams(hash.substring(1))
    const type = params.get('type')
    const token = params.get('access_token')

    async function confirmAccount() {
      // Verificar token con Supabase
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token || '',
        type: (type as 'signup') || 'signup',
      })

      if (error) {
        setStatus('error')
        setErrorMsg(error.message)
      } else {
        setStatus('success')
        // Actualizar la sesión del AuthProvider
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      }
    }

    if (type && token) {
      confirmAccount()
    } else {
      // Sin tipo/token específico, intentar getSession por si supabase ya lo procesó
      supabase.auth.getSession().then((res: any) => { const session = res?.data?.session;
        if (session?.user?.email_confirmed_at) {
          setStatus('success')
          setTimeout(() => router.push('/login'), 3000)
        } else {
          setStatus('error')
          setErrorMsg(t('confirmError'))
        }
      })
    }
  }, [router, t])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LocalLink href="/" className="text-brand-primary font-black text-3xl">
            Vende<span className="text-brand-accent">T</span><span className="text-sm ml-1 text-gray-500">-Venezuela</span>
          </LocalLink>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          {status === 'loading' && (
            <>
              <div className="flex justify-center mb-6">
                <Loader2 className="text-brand-primary animate-spin" size={48} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                Confirmando tu cuenta...
              </h2>
              <p className="text-gray-500 text-center">{t('loadingDesc')}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="bg-green-100 rounded-full p-4">
                  <CheckCircle className="text-green-600" size={48} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                ¡Email confirmado con éxito!
              </h2>
              <p className="text-green-700 text-center mb-6">
                Tu cuenta está lista. Redirigiendo al login...
              </p>
              <LocalLink
                href="/login"
                className="block w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition text-center"
              >
                Ir al login ahora
              </LocalLink>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="bg-red-100 rounded-full p-4">
                  <XCircle className="text-red-600" size={48} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                No se pudo confirmar
              </h2>
              <p className="text-red-600 text-center mb-6 text-sm">
                {errorMsg || t('errorDefault')}
              </p>
              <LocalLink
                href="/login"
                className="block w-full bg-brand-primary text-white py-3 rounded-lg font-bold hover:bg-brand-dark transition text-center"
              >
                Ir al login para reenviar
              </LocalLink>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
