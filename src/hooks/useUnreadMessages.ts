'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const UNREAD_REFRESH_EVENT = 'inmuebles:unread-refresh'

type Listener = (count: number) => void

interface SharedUnreadStore {
  userId: string
  count: number
  inFlight: boolean
  listeners: Set<Listener>
  cleanup: (() => void) | null
}

const stores = new Map<string, SharedUnreadStore>()

function getOrCreateStore(userId: string): SharedUnreadStore {
  const existing = stores.get(userId)
  if (existing) return existing

  const store: SharedUnreadStore = {
    userId,
    count: 0,
    inFlight: false,
    listeners: new Set(),
    cleanup: null,
  }
  stores.set(userId, store)
  return store
}

function startStoreSync(store: SharedUnreadStore) {
  if (store.cleanup || typeof window === 'undefined') return
  let disposed = false

  const refresh = async () => {
    if (disposed || store.inFlight) return
    store.inFlight = true
    try {
      const { count, error } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_id', store.userId)
        .eq('leido', false)

      if (!disposed && !error) {
        const next = count || 0
        if (next !== store.count) {
          store.count = next
          store.listeners.forEach((fn) => fn(next))
        }
      }
    } catch {
      // Silenciar fallos transitorios de red para no ensuciar la consola
    } finally {
      store.inFlight = false
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void refresh()
    }
  }

  const broadcast =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('venezuela_inmuebles_unread_sync')
      : null
  if (broadcast) {
    broadcast.onmessage = () => {
      void refresh()
    }
  }

  const onManualRefresh = () => {
    void refresh()
  }

  window.addEventListener(UNREAD_REFRESH_EVENT, onManualRefresh)
  window.addEventListener('storage', onManualRefresh)
  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(onVisible, 20000)

  void refresh()

  store.cleanup = () => {
    disposed = true
    window.clearInterval(timer)
    window.removeEventListener(UNREAD_REFRESH_EVENT, onManualRefresh)
    window.removeEventListener('storage', onManualRefresh)
    window.removeEventListener('focus', onVisible)
    document.removeEventListener('visibilitychange', onVisible)
    broadcast?.close()
    store.cleanup = null
  }
}

/**
 * Contador compartido de mensajes no leídos por `userId` usando consultas HEAD
 * ligeras por HTTPS + eventos locales y entre pestañas (`BroadcastChannel`).
 * Evita abrir WebSockets globales en todas las páginas del portal y deduplica
 * lecturas simultáneas entre `Header` y `TabResumen`.
 */
export function useUnreadMessages(userId?: string) {
  const [state, setState] = useState<{ userId: string; count: number } | null>(null)

  useEffect(() => {
    if (!userId) return
    const store = getOrCreateStore(userId)
    const listener: Listener = (count) => {
      setState({ userId, count })
    }
    store.listeners.add(listener)
    setState({ userId, count: store.count })
    startStoreSync(store)

    return () => {
      store.listeners.delete(listener)
      if (store.listeners.size === 0) {
        store.cleanup?.()
        stores.delete(userId)
      }
    }
  }, [userId])

  return state && state.userId === userId ? state.count : 0
}
