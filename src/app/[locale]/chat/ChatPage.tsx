'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/Avatar'
import { Send, ArrowLeft, Search, User, Trash2, ExternalLink, Star, MessageSquare } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { useTranslations } from 'next-intl'
import { localizePath } from '@/lib/auth-redirect'
import { UNREAD_REFRESH_EVENT } from '@/hooks/useUnreadMessages'
import { mergeChatMessages } from '@/lib/chat-messages'

type Conversacion = {
  id: string
  user1_id: string
  user2_id: string
  producto_id: string | null
  ultimo_mensaje: string | null
  ultimo_mensaje_en: string | null
  creado_en: string
  otro_nombre: string
  otro_foto: string | null
  producto_titulo: string | null
  no_leidos: number
}

type Mensaje = {
  id: string
  conversacion_id: string
  remitente_id: string
  destinatario_id: string | null
  contenido: string
  leido: boolean
  creado_en: string
}

function formatTime(iso: string | null, locale: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const relative = new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'es', { numeric: 'auto', style: 'short' })
  if (diffMin < 1) return relative.format(0, 'second')
  if (diffMin < 60) return relative.format(-diffMin, 'minute')
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return relative.format(-diffH, 'hour')
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return relative.format(-diffD, 'day')
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-VE', { day: '2-digit', month: 'short' }).format(date)
}

function formatHora(iso: string, locale: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-VE', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function ChatPageClient() {
  const t = useTranslations('chat')
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'es'
  const searchParams = useSearchParams()
  const productoId = searchParams?.get('producto_id')
  const vendedorId = searchParams?.get('vendedor_id')
  const requestedConversation = searchParams?.get('conversation')

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [convId, setConvId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const loadingRef = useRef(false)
  const [busqueda, setBusqueda] = useState('')
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)

  const mensajesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const userRef = useRef(user)
  const convIdRef = useRef(convId)
  const showMobileChatRef = useRef(showMobileChat)
  const initialIntentRef = useRef<string | null>(null)
  const conversationsRequestRef = useRef(0)
  userRef.current = user
  convIdRef.current = convId
  showMobileChatRef.current = showMobileChat

  const [mostrarResena, setMostrarResena] = useState(false)
  const [ratingResena, setRatingResena] = useState(5)
  const [comentarioResena, setComentarioResena] = useState('')
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [puedeResenar, setPuedeResenar] = useState(false)
  const [productoOwnerId, setProductoOwnerId] = useState<string | null>(null)
  const [yaDejoResena, setYaDejoResena] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
    const bc = new BroadcastChannel('venezuela_inmuebles_unread_sync')
    bcRef.current = bc
    return () => bc.close()
  }, [])

  // Retain the property enquiry through sign-in, then open the same conversation.
  useEffect(() => {
    if (authLoading || user) return
    const params = new URLSearchParams()
    if (productoId) params.set('producto_id', productoId)
    if (vendedorId) params.set('vendedor_id', vendedorId)
    if (requestedConversation) params.set('conversation', requestedConversation)
    const queryString = params.toString()
    const returnPath = `/chat${queryString ? `?${queryString}` : ''}`
    router.replace(localizePath(`/login?redirect=${encodeURIComponent(returnPath)}`, locale))
  }, [user, authLoading, router, locale, productoId, vendedorId, requestedConversation])

  useEffect(() => {
    chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => {
    if (!convId || !user) return
    setProductoOwnerId(null)
    setPuedeResenar(false)
    setYaDejoResena(false)

    getSupabaseAuthHeaders()
      .then(authHeaders => fetch('/api/chat/review-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ convId, userId: user.id }),
      }))
      .then(async response => {
        const data = await response.json()
        setProductoOwnerId(data.productoOwnerId)
        setPuedeResenar(data.puedeResenar)
        setYaDejoResena(data.yaDejoResena)
      })
      .catch(error => console.error('[REVIEW-STATUS] error:', error))
  }, [convId, user])

  const loadConversaciones = useCallback(async () => {
    const uid = userRef.current?.id
    if (!uid) { loadingRef.current = false; return }
    const requestId = ++conversationsRequestRef.current

    const { data: convs, error } = await supabase
      .from('conversaciones')
      .select('id, user1_id, user2_id, producto_id, ultimo_mensaje_en, ultimo_mensaje_contenido')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order('ultimo_mensaje_en', { ascending: false })

    if (error) { console.error('Error loading conversations:', error); return }

    const otroIds = Array.from(new Set(convs?.map((conversation: any) => conversation.user1_id === uid ? conversation.user2_id : conversation.user1_id).filter(Boolean) || []))
    const prodIds = Array.from(new Set(convs?.filter((conversation: any) => conversation.producto_id).map((conversation: any) => conversation.producto_id as string) || []))
    if (vendedorId && !otroIds.includes(vendedorId)) otroIds.push(vendedorId)
    if (productoId && !prodIds.includes(productoId)) prodIds.push(productoId)

    const perfilMap = new Map<string, { nombre: string; foto: string | null }>()
    if (otroIds.length) {
      try {
        const response = await fetch(`/api/user-bulk?ids=${encodeURIComponent(otroIds.join(','))}`, {
          headers: await getSupabaseAuthHeaders(),
        })
        const json = await response.json()
        json.profiles?.forEach((profile: { id: string; nombre: string; foto_perfil_url: string | null }) => {
          perfilMap.set(profile.id, { nombre: profile.nombre || t('unknownUser'), foto: profile.foto_perfil_url || null })
        })
      } catch (error) { console.error('Error fetching user profiles:', error) }
    }

    const productosRes = prodIds.length
      ? await supabase.from('vw_propiedades_publicas').select('id, titulo').in('id', prodIds)
      : { data: [] }
    const prodMap = new Map<string, string>()
    productosRes.data?.forEach((property: any) => prodMap.set(property.id, property.titulo || ''))

    const unreadMap = new Map<string, number>()
    if (convs?.length) {
      const { data: unreadData } = await supabase
        .from('mensajes')
        .select('conversacion_id')
        .eq('destinatario_id', uid)
        .eq('leido', false)
        .in('conversacion_id', convs.map((conversation: any) => conversation.id))
      unreadData?.forEach((message: { conversacion_id: string }) => {
        unreadMap.set(message.conversacion_id, (unreadMap.get(message.conversacion_id) || 0) + 1)
      })
    }

    const enriched: Conversacion[] = (convs || []).map((conversation: any) => {
      const otherId = conversation.user1_id === uid ? conversation.user2_id : conversation.user1_id
      const profile = perfilMap.get(otherId)
      return {
        ...conversation,
        ultimo_mensaje: conversation.ultimo_mensaje_contenido || conversation.ultimo_mensaje || null,
        otro_nombre: profile?.nombre || t('unknownUser'),
        otro_foto: profile?.foto || null,
        producto_titulo: conversation.producto_id ? (prodMap.get(conversation.producto_id) || null) : null,
        no_leidos: unreadMap.get(conversation.id) || 0,
      }
    })

    if (requestId !== conversationsRequestRef.current || userRef.current?.id !== uid) return
    setConversaciones(enriched)
    const intentKey = `${uid}:${productoId || ''}:${vendedorId || ''}:${requestedConversation || ''}`
    if (initialIntentRef.current === intentKey) return
    initialIntentRef.current = intentKey
    if (requestedConversation) {
      const match = enriched.find((conversation) => conversation.id === requestedConversation)
      if (match) { setConvId(match.id); setShowMobileChat(true) }
    } else if (productoId && vendedorId && vendedorId !== uid) {
      const match = enriched.find(conversation =>
        conversation.producto_id === productoId &&
        ((conversation.user1_id === uid && conversation.user2_id === vendedorId) ||
         (conversation.user1_id === vendedorId && conversation.user2_id === uid))
      )
      if (match) {
        setConvId(match.id)
        setShowMobileChat(true)
      } else {
        try {
          const response = await fetch('/api/crear-conversacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
            body: JSON.stringify({ vendedorId, productoId }),
          })
          const newConversation = await response.json()
          if (!response.ok) throw new Error(newConversation.error || t('connectionError'))
          const profile = perfilMap.get(vendedorId)
          setConversaciones(previous => [{
            ...newConversation,
            ultimo_mensaje: null,
            otro_nombre: profile?.nombre || t('unknownUser'),
            otro_foto: profile?.foto || null,
            producto_titulo: prodMap.get(productoId) || null,
            no_leidos: 0,
          }, ...previous.filter(conversation => conversation.id !== newConversation.id)])
          setConvId(newConversation.id)
          setShowMobileChat(true)
        } catch (error) {
          console.error('Could not open property conversation:', error)
          setToastMsg(error instanceof Error ? error.message : t('connectionError'))
        }
      }
    }
  }, [productoId, vendedorId, requestedConversation, t])

  useEffect(() => {
    if (authLoading || !user) return
    loadingRef.current = true
    setLoadingConvs(true)
    loadConversaciones().finally(() => { loadingRef.current = false; setLoadingConvs(false) })
  }, [user, authLoading, loadConversaciones])

  const loadMensajes = useCallback(async (id: string) => {
    const uid = userRef.current?.id
    const { data, error } = await supabase
      .from('mensajes')
      .select('id, remitente_id, destinatario_id, contenido, leido, creado_en, conversacion_id')
      .eq('conversacion_id', id)
      .order('creado_en', { ascending: true })
    if (error) { console.error('Error loading messages:', error); return }
    if (convIdRef.current !== id || uid !== userRef.current?.id) return
    // Keep events received while the query was in flight.
    setMensajes(previous => mergeChatMessages(data || [], previous, id))
  }, [])

  const markRead = useCallback(async (id: string) => {
    const uid = userRef.current?.id
    if (!uid || document.visibilityState !== 'visible') return
    try {
      const response = await fetch('/api/mensajes-leidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({ conversacion_id: id, destinatario_id: uid }),
      })
      if (!response.ok || userRef.current?.id !== uid) return
      setConversaciones(previous => previous.map(conversation => conversation.id === id ? { ...conversation, no_leidos: 0 } : conversation))
      window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT))
      bcRef.current?.postMessage({ action: 'refresh-unread' })
    } catch (error) { console.error('Error marking messages read:', error) }
  }, [])

  const isChatVisible = () => document.visibilityState === 'visible' && (window.matchMedia('(min-width: 768px)').matches || showMobileChatRef.current)

  useEffect(() => {
    if (!convId || !user) return
    setMensajes(previous => previous.filter(message => message.conversacion_id === convId))
    loadMensajes(convId)
    if (isChatVisible()) markRead(convId)
  }, [convId, user, loadMensajes, markRead])

  const userId = user?.id
  const chatHandlersRef = useRef({ loadConversaciones, loadMensajes, markRead })
  chatHandlersRef.current = { loadConversaciones, loadMensajes, markRead }

  useEffect(() => {
    if (!userId) return
    const uid = userId
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let fallback: number | undefined
    let activeChannel: ReturnType<typeof supabase.channel> | null = null

    const refreshList = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { chatHandlersRef.current.loadConversaciones() }, 200)
    }
    const onMessage = (payload: any) => {
      const incoming = payload.new as Mensaje
      if (incoming.conversacion_id === convIdRef.current) {
        setMensajes(previous => previous.some(message => message.id === incoming.id) ? previous : [...previous.filter(message => message.conversacion_id === incoming.conversacion_id), incoming])
        if (incoming.destinatario_id === uid && isChatVisible()) chatHandlersRef.current.markRead(incoming.conversacion_id)
      }
      refreshList()
    }
    const resync = () => {
      if (document.visibilityState !== 'visible') return
      refreshList()
      if (convIdRef.current) {
        chatHandlersRef.current.loadMensajes(convIdRef.current)
        if (isChatVisible()) chatHandlersRef.current.markRead(convIdRef.current)
      }
    }

    const startPolling = (intervalMs: number) => {
      if (fallback) window.clearInterval(fallback)
      fallback = window.setInterval(resync, intervalMs)
    }

    // Retrasar 250ms la apertura del WebSocket para evitar abortar un handshake CONNECTING
    // durante doble montaje de React Strict Mode o redirecciones inmediatas.
    const connectTimer = window.setTimeout(() => {
      if (disposed) return
      const channel = supabase.channel(`chat-sync-${uid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `destinatario_id=eq.${uid}` }, onMessage)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `remitente_id=eq.${uid}` }, onMessage)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes', filter: `destinatario_id=eq.${uid}` }, refreshList)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones', filter: `user1_id=eq.${uid}` }, refreshList)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones', filter: `user2_id=eq.${uid}` }, refreshList)
        .subscribe((status: string) => {
          if (disposed) return
          if (status === 'SUBSCRIBED') {
            startPolling(15000)
            refreshList()
            if (convIdRef.current) chatHandlersRef.current.loadMensajes(convIdRef.current)
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Si la red/ISP bloquea wss://, cerramos el canal para no inundar F12 con reintentos
            // y pasamos automáticamente a sincronización HTTPS cada 4s.
            activeChannel = null
            void supabase.removeChannel(channel)
            startPolling(4000)
          }
        })
      activeChannel = channel
    }, 250)

    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    startPolling(12000)

    return () => {
      disposed = true
      window.clearTimeout(connectTimer)
      clearTimeout(timer)
      if (fallback) window.clearInterval(fallback)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
      if (activeChannel) {
        const ch = activeChannel
        activeChannel = null
        void supabase.removeChannel(ch)
      }
    }
  }, [userId])

  const seleccionarConv = (id: string) => {
    convIdRef.current = id
    showMobileChatRef.current = true
    setMensajes(previous => previous.filter(message => message.conversacion_id === id))
    setConvId(id)
    setShowMobileChat(true)
    loadMensajes(id)
    markRead(id)
  }

  const eliminarConv = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!confirm(t('deleteConversation'))) return
    const { error: messageError } = await supabase.from('mensajes').delete().eq('conversacion_id', id)
    if (messageError) { setToastMsg(messageError.message); return }
    const { error: conversationError } = await supabase.from('conversaciones').delete().eq('id', id)
    if (conversationError) { setToastMsg(conversationError.message); return }
    setConversaciones(previous => previous.filter(conversation => conversation.id !== id))
    if (convId === id) {
      setConvId(null)
      setShowMobileChat(false)
      setMensajes([])
    }
  }

  const enviarResenaComprador = async () => {
    if (!convId || !user || enviandoResena || !productoOwnerId) return
    const conversation = conversaciones.find(item => item.id === convId)
    if (!conversation?.producto_id) return

    setEnviandoResena(true)
    try {
      const response = await fetch('/api/admin/enviar-resena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({
          evaluador_id: user.id,
          evaluado_id: productoOwnerId,
          producto_id: conversation.producto_id,
          puntuacion: ratingResena,
          comentario: comentarioResena.trim() || null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || t('reviewError'))
      setMostrarResena(false)
      setYaDejoResena(true)
      setComentarioResena('')
      setRatingResena(5)
    } catch (error) {
      setToastMsg(error instanceof Error ? error.message : t('reviewError'))
    } finally {
      setEnviandoResena(false)
    }
  }

  const enviarMensaje = async () => {
    const message = texto.trim()
    if (!message || !convId || !user || enviando) return
    setEnviando(true)
    const conversation = conversaciones.find(item => item.id === convId)
    if (!conversation) { setEnviando(false); return }
    const recipientId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id

    const { error } = await supabase.from('mensajes').insert({
      conversacion_id: convId,
      remitente_id: user.id,
      destinatario_id: recipientId,
      contenido: message,
    })

    if (error) {
      setToastMsg(`${t('sendError')}: ${error.message}`)
      setEnviando(false)
      return
    }

    setTexto('')
    await loadMensajes(convId)
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getSupabaseAuthHeaders()) },
        body: JSON.stringify({
          targetUserId: recipientId,
          titulo: `${t('newMessageFrom')} ${conversation.otro_nombre || t('unknownUser')}`,
          cuerpo: message.length > 100 ? `${message.slice(0, 100)}…` : message,
          click_url: `/chat?conversation=${convId}`,
        }),
      })
    } catch (error) { console.error('Push send failed:', error) }
    setEnviando(false)
  }

  if (authLoading || !user) {
    return (
      <div className="inbox-page min-h-[60vh]" aria-busy="true">
        <div className="inbox-page__inner">
          <header className="inbox-page__heading"><p>{t('title')}</p><h1>{t('title')}</h1></header>
          <div className="inbox-shell inbox-shell--loading">
            <div className="text-center text-[#897f75]">
              <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--burgundy)]" />
              <p>{t('loadingConversations')}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const filtered = conversaciones.filter(conversation =>
    conversation.otro_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (conversation.producto_titulo?.toLowerCase() ?? '').includes(busqueda.toLowerCase())
  )
  const currentConversation = conversaciones.find(conversation => conversation.id === convId)

  return (
    <main className="inbox-page">
      <div className="inbox-page__inner">
        <header className="inbox-page__heading">
          <div>
            <p>{t('eyebrow')}</p>
            <h1>{t('title')}</h1>
          </div>
          <span>{t('privateConversationNote')}</span>
        </header>

        <div className="inbox-shell">
          <div className="inbox-shell__layout">
            <aside className={`${showMobileChat ? 'hidden md:flex' : 'flex'} inbox-sidebar`} aria-label={t('conversationList')}>
              <div className="inbox-sidebar__search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={event => setBusqueda(event.target.value)}
                  placeholder={t('searchConversations')}
                  aria-label={t('searchConversations')}
                />
              </div>

              <div className="inbox-sidebar__list">
                {loadingConvs && conversaciones.length === 0 ? (
                  <div className="p-4 space-y-4 animate-pulse" aria-label={t('loadingConversations')}>
                    {[1, 2, 3, 4].map(index => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#EAE6DC]" />
                        <div className="flex-1 space-y-2"><div className="h-3 w-3/4 bg-[#EAE6DC]" /><div className="h-3 w-1/2 bg-[#f3eee7]" /></div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="inbox-empty">
                    <User size={33} aria-hidden="true" />
                    <p>{conversaciones.length === 0 ? t('noConversations') : t('noSearchResults')}</p>
                    <span>{conversaciones.length === 0 ? t('noConversationsDesc') : t('tryAnotherSearch')}</span>
                  </div>
                ) : filtered.map(conversation => (
                  <article key={conversation.id} className={`inbox-conversation ${convId === conversation.id ? 'is-active' : ''}`}>
                    <button
                      type="button"
                      className="inbox-conversation__select"
                      onClick={() => seleccionarConv(conversation.id)}
                      aria-current={convId === conversation.id ? 'true' : undefined}
                    >
                      <Avatar nombre={conversation.otro_nombre} fotoUrl={conversation.otro_foto} size="md" />
                      <span className="inbox-conversation__content">
                        <span className="inbox-conversation__topline">
                          <strong>{conversation.otro_nombre}</strong>
                          {conversation.ultimo_mensaje_en && <time>{formatTime(conversation.ultimo_mensaje_en, locale)}</time>}
                        </span>
                        <span className="inbox-conversation__preview">{conversation.ultimo_mensaje || t('noMessagesYet')}</span>
                        {conversation.producto_titulo && <span className="inbox-conversation__property">{conversation.producto_titulo}</span>}
                      </span>
                      {conversation.no_leidos > 0 && <span className="inbox-conversation__unread">{conversation.no_leidos}</span>}
                    </button>
                    <button
                      type="button"
                      className="inbox-conversation__delete"
                      onClick={(event) => eliminarConv(conversation.id, event)}
                      title={t('deleteConversationAction')}
                      aria-label={t('deleteConversationAction')}
                    ><Trash2 size={14} aria-hidden="true" /></button>
                    {conversation.producto_id && (
                      <LocalLink href={`/inmueble/${conversation.producto_id}`} className="inbox-conversation__property-link">
                        {t('viewProperty')} <ExternalLink size={11} aria-hidden="true" />
                      </LocalLink>
                    )}
                  </article>
                ))}
              </div>
            </aside>

            <section className={`${showMobileChat ? 'flex' : 'hidden md:flex'} inbox-chat`} aria-label={t('chatWindow')}>
              {!convId ? (
                <div className="inbox-chat__placeholder">
                  <span><MessageSquare size={31} aria-hidden="true" /></span>
                  <p>{t('selectConversation')}</p>
                  <small>{t('selectConversationHint')}</small>
                </div>
              ) : (
                <>
                  <header className="inbox-chat__header">
                    <button type="button" onClick={() => { showMobileChatRef.current = false; setShowMobileChat(false) }} className="inbox-chat__back" aria-label={t('backToConversations')}>
                      <ArrowLeft size={19} />
                    </button>
                    {currentConversation && (
                      <>
                        <Avatar nombre={currentConversation.otro_nombre} fotoUrl={currentConversation.otro_foto} size="sm" />
                        <div className="inbox-chat__identity">
                          <strong>{currentConversation.otro_nombre}</strong>
                          {currentConversation.producto_titulo && currentConversation.producto_id && (
                            <LocalLink href={`/inmueble/${currentConversation.producto_id}`}>
                              {t('aboutProperty')}: {currentConversation.producto_titulo} <ExternalLink size={11} aria-hidden="true" />
                            </LocalLink>
                          )}
                        </div>
                      </>
                    )}
                  </header>

                  <div ref={chatContainerRef} className="inbox-chat__messages" aria-live="polite">
                    {mensajes.map(message => {
                      const isMine = message.remitente_id === user.id
                      return (
                        <div key={message.id} className={`inbox-message ${isMine ? 'is-mine' : ''}`}>
                          <div className="inbox-message__bubble">
                            <p>{message.contenido}</p>
                            <time>{formatHora(message.creado_en, locale)}</time>
                          </div>
                        </div>
                      )
                    })}
                    {puedeResenar && !yaDejoResena && (
                      <div className="inbox-review-prompt">
                        <p>{t('reviewPrompt')}</p>
                        <button type="button" onClick={() => setMostrarResena(true)}><Star size={15} fill="currentColor" /> {t('leaveReview')}</button>
                      </div>
                    )}
                    <div ref={mensajesEndRef} />
                  </div>

                  <form className="inbox-chat__composer" onSubmit={(event) => { event.preventDefault(); enviarMensaje() }}>
                    <input
                      type="text"
                      value={texto}
                      onChange={event => setTexto(event.target.value)}
                      placeholder={t('typeMessage')}
                      aria-label={t('typeMessage')}
                      disabled={enviando}
                    />
                    <button type="submit" disabled={!texto.trim() || enviando} aria-label={t('send')}>
                      {enviando ? <span className="inbox-chat__spinner" /> : <Send size={17} aria-hidden="true" />}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        </div>

        {toastMsg && <div className="inbox-toast" role="status">{toastMsg}<button type="button" onClick={() => setToastMsg(null)} aria-label={t('close')}>×</button></div>}

        {mostrarResena && (
          <div className="inbox-modal-backdrop" onClick={() => setMostrarResena(false)}>
            <section className="inbox-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={event => event.stopPropagation()}>
              <p className="dashboard-page__eyebrow">{t('reviewEyebrow')}</p>
              <h2 id="review-title">{t('leaveReview')}</h2>
              <p>{t('reviewExperience', { name: currentConversation?.otro_nombre || t('unknownUser') })}</p>
              <div className="inbox-review-modal__stars" role="group" aria-label={t('ratingLabel')}>
                {[1, 2, 3, 4, 5].map(value => (
                  <button key={value} type="button" onClick={() => setRatingResena(value)} aria-label={`${value} ${t('stars')}`} aria-pressed={value === ratingResena}>
                    <Star size={30} className={value <= ratingResena ? 'is-selected' : ''} />
                  </button>
                ))}
              </div>
              <textarea
                value={comentarioResena}
                onChange={event => setComentarioResena(event.target.value)}
                maxLength={500}
                placeholder={t('reviewPlaceholder')}
                aria-label={t('reviewPlaceholder')}
              />
              <span className="inbox-review-modal__counter">{comentarioResena.length}/500</span>
              <div className="inbox-review-modal__actions">
                <button type="button" onClick={() => setMostrarResena(false)}>{t('cancel')}</button>
                <button type="button" onClick={enviarResenaComprador} disabled={enviandoResena}>{enviandoResena ? t('sending') : t('sendReview')}</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
