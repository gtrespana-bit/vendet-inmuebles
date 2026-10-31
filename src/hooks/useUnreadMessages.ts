'use client'

import { useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const UNREAD_REFRESH_EVENT = 'inmuebles:unread-refresh'

/** Live unread count, with resync after reconnect, tab focus and temporary outages. */
export function useUnreadMessages(userId?: string) {
  const instanceId = useId()
  const [state, setState] = useState<{ userId: string; count: number } | null>(null)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    let sequence = 0
    const refresh = async () => {
      const request = ++sequence
      const { count, error } = await supabase.from('mensajes').select('id', { count: 'exact', head: true })
        .eq('destinatario_id', userId).eq('leido', false)
      if (!cancelled && !error && request === sequence) setState({ userId, count: count || 0 })
    }
    const channel = supabase.channel(`unread-${userId}-${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `destinatario_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes', filter: `destinatario_id=eq.${userId}` }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh() })
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('venezuela_inmuebles_unread_sync') : null
    if (broadcast) broadcast.onmessage = refresh
    window.addEventListener(UNREAD_REFRESH_EVENT, refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 15000)
    refresh()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener(UNREAD_REFRESH_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      broadcast?.close()
      supabase.removeChannel(channel)
    }
  }, [userId, instanceId])
  return state && state.userId === userId ? state.count : 0
}
