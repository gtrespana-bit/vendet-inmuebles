'use client'

import { useEffect, useRef } from 'react'

/**
 * Registers the Service Worker ONLY after the page is fully loaded and interactive.
 * This prevents the SW install from blocking initial page render (363ms long task).
 */
export function ServiceWorkerRegistration() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const registerSW = () => {
      // Use requestIdleCallback to register during idle time
      const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
      
      idleCallback(() => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('[SW] Registration failed:', err)
        })
      }, { timeout: 5000 })
    }

    // Wait for page to be fully loaded first
    if (document.readyState === 'complete') {
      // Already loaded, register after a delay to avoid competing with hydration
      timeoutRef.current = setTimeout(registerSW, 3000)
    } else {
      const loadHandler = () => {
        // Wait 3 seconds after load to ensure hydration is done
        timeoutRef.current = setTimeout(registerSW, 3000)
      }
      window.addEventListener('load', loadHandler)
      
      // Cleanup function
      return () => {
        window.removeEventListener('load', loadHandler)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    }
    
    // Cleanup function for the case where we're already loaded
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  return null
}
