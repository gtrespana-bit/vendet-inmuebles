'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, X, Share, Smartphone } from 'lucide-react'
import { useLocalizedMessages } from '@/hooks/useLocalizedMessages'

export default function PWAInstallBanner() {
  const { t } = useLocalizedMessages()
  const [mounted, setMounted] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Ya instalada
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOS) {
      const dismissed = localStorage.getItem('pwa_ios_dismissed')
      if (!dismissed) {
        const timer = setTimeout(() => setShowIOS(true), 3000)
        return () => clearTimeout(timer)
      }
      return
    }

    // Android/Desktop: capturar evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      const dismissed = localStorage.getItem('pwa_install_dismissed')
      if (!dismissed) {
        setShowBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)
    setMounted(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      // Clean up dismiss timeout on unmount
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current)
        dismissTimeoutRef.current = null
      }
    }
  }, [])

  // PERF FIX: Replaced setInterval(60s) with a single setTimeout.
  // The old interval ran forever, keeping Chrome from reaching "idle" state
  // and causing Lighthouse timeout warnings. Now we schedule ONE check
  // at the right time instead of polling every 60 seconds.
  useEffect(() => {
    const checkDeferred = localStorage.getItem('pwa_install_dismissed')
    if (!checkDeferred || !deferredPrompt) return

    const elapsed = Date.now() - parseInt(checkDeferred)
    const remaining = 6 * 60 * 60 * 1000 - elapsed

    if (remaining <= 0) {
      // Already past 6 hours, show now
      localStorage.removeItem('pwa_install_dismissed')
      setShowBanner(true)
    } else {
      // Schedule ONE check at the exact time it should reappear
      const timer = setTimeout(() => {
        localStorage.removeItem('pwa_install_dismissed')
        setShowBanner(true)
      }, remaining)
      return () => clearTimeout(timer)
    }
  }, [deferredPrompt])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
      setDeferredPrompt(null)
    }
    localStorage.setItem('pwa_install_dismissed', '1')
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setShowIOS(false)
    localStorage.setItem('pwa_install_dismissed', Date.now().toString())
    localStorage.setItem('pwa_ios_dismissed', Date.now().toString())
    
    // Clear any existing timeout first
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current)
    }
    
    // Set new timeout and store reference
    dismissTimeoutRef.current = setTimeout(() => {
      localStorage.removeItem('pwa_install_dismissed')
      localStorage.removeItem('pwa_ios_dismissed')
      dismissTimeoutRef.current = null
    }, 6 * 60 * 60 * 1000)
  }

  return (
    <>
      {mounted && showBanner && (
        <div className="fixed bottom-4 inset-x-4 z-[60] md:inset-x-auto md:left-4 md:bottom-4 md:max-w-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
            <button onClick={handleDismiss} aria-label={t('pwa.closeBanner')} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-lg">TA</span>
              </div>
              <div className="flex-1 pr-6">
                <p className="font-bold text-gray-900 text-sm">{t('pwa.installTitle')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('pwa.installDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleInstall}
              className="w-full mt-3 bg-brand-primary text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-dark transition"
            >
              <Download size={16} /> {t('pwa.installButton')}
            </button>
          </div>
        </div>
      )}

      {showIOS && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 animate-slideUp relative">
            <button onClick={handleDismiss} aria-label={t('pwa.close')} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-brand-primary rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-black text-xl">TA</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900">{t('pwa.iosTitle')}</h3>
            </div>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3 text-sm">
                <Smartphone size={18} className="text-brand-primary flex-shrink-0" />
                <p>{t('pwa.iosStep1Plain')} <Share size={14} className="inline" /></p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-primary flex-shrink-0">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
                <p>{t('pwa.iosStep2Plain')}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-full mt-4 bg-brand-primary text-white py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark transition"
            >
              {t('pwa.iosDone')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
