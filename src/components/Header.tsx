'use client'

import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, Search, PlusCircle, MessageCircle, Zap, ChevronLeft, Globe } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import Avatar from '@/components/Avatar'
import { useLocalizedMessages } from '@/hooks/useLocalizedMessages'
import { supabase } from '@/lib/supabase'

export function Header() {
  const { user } = useAuth()
  const { t } = useLocalizedMessages()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [creditoBalance, setCreditoBalance] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const creditoChecked = typeof creditoBalance === 'number'
  const [isPWA, setIsPWA] = useState(false)

  // Locale detection from Next.js pathname (reactive to client-side navigation)
  const pathname = usePathname()
  const isEn = pathname.startsWith('/en')
  const altLocaleHref = isEn
    ? (pathname.replace(/^\/en(?=\/|$)/, '') || '/')
    : `/en${pathname === '/' ? '' : pathname}`

  // Categories with translation keys
  const categorias = [
    { id: 'ver-todo', nombre: t('header.allCategories'), icon: '🔍' },
    { id: 'vehiculos', nombre: t('header.categories.vehiculos'), icon: '🚗' },
    { id: 'tecnologia', nombre: t('header.categories.tecnologia'), icon: '💻' },
    { id: 'moda', nombre: t('header.categories.moda'), icon: '👗' },
    { id: 'hogar', nombre: t('header.categories.hogar'), icon: '🏠' },
    { id: 'herramientas', nombre: t('header.categories.herramientas'), icon: '🔧' },
    { id: 'materiales', nombre: t('header.categories.materiales'), icon: '🧱' },
    { id: 'repuestos', nombre: t('header.categories.repuestos'), icon: '⚙️' },
    { id: 'otros', nombre: t('header.categories.otros'), icon: '📦' },
  ]

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsPWA(window.matchMedia('(display-mode: standalone)').matches)
    if ('standalone' in window.navigator && !(window.navigator as any).standalone === false) {
      setIsPWA(true)
    }
  }, [])

  // Consolidated fetch: credit balance + unread count in single query
  // ✅ PERFORMANCE FIX: Add timeout to prevent hanging requests
  useEffect(() => {
    if (!user) return

    let timeoutId: NodeJS.Timeout
    const controller = new AbortController()
    
    async function fetchAll() {
      // Timeout after 5 seconds
      timeoutId = setTimeout(() => controller.abort(), 5000)
      
      try {
        // Verificar que el perfil exista antes de leerlo
        const perfilCheck = await supabase.from('perfiles').select('id').eq('id', user!.id).single({ signal: controller.signal })
        
        if (perfilCheck.error) {
          // Si el perfil no existe, crearlo automáticamente
          if (perfilCheck.error.code === 'PGRST116') { // No rows returned
            await supabase.from('perfiles').insert({
              id: user!.id,
              nombre: user!.user_metadata?.nombre || 'Usuario',
              telefono: user!.user_metadata?.telefono || '',
              estado: user!.user_metadata?.estado || 'Distrito Capital',
              ciudad: user!.user_metadata?.ciudad || 'Caracas',
              credito_balance: 0,
            })
          } else {
            throw perfilCheck.error
          }
        }

        const [credResult, unreadResult] = await Promise.all([
          supabase.from('perfiles').select('credito_balance').eq('id', user!.id).single({ signal: controller.signal }),
          supabase.from('mensajes').select('id', { count: 'exact', head: true }).eq('destinatario_id', user!.id).eq('leido', false).abortSignal(controller.signal),
        ])
        
        // Clear timeout on success
        clearTimeout(timeoutId)
        
        setCreditoBalance(credResult.data?.credito_balance ?? 0)
        setUnreadCount(unreadResult.count || 0)
      } catch (error: any) {
        // Clear timeout on error
        clearTimeout(timeoutId)
        
        // Reset on abort or network error
        if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
          setCreditoBalance(0)
          setUnreadCount(0)
        }
      }
    }
    
    fetchAll()

    // Realtime subscription for unread messages
    const channel = supabase
      .channel('header-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `destinatario_id=eq.${user!.id}` },
        () => fetchAll()
      )
      .subscribe()

    const bc = new BroadcastChannel('vendete_unread_sync')
    bc.onmessage = () => fetchAll()

    return () => {
      supabase.removeChannel(channel)
      bc.close()
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [user])

  // ✅ FIX: Don't block the entire header while auth loads.
  // Treat loading as guest → render immediately → update when session resolves.
  const showCreditoBadge = !user

  return (
    <>
      {/* ============ HEADER PRINCIPAL ============ */}
      <header className="bg-gradient-to-r from-brand-dark via-brand-primary to-brand-primary text-white relative sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Back button — PWA only */}
            {isPWA && (
              <button 
                onClick={() => window.history.back()} 
                aria-label={t('header.backAria')}
                className="p-1 hover:bg-white/10 rounded-lg transition text-white/80"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {/* Logo */}
            <LocalLink href="/" className="flex items-center gap-3 flex-shrink-0">
              <Image 
                src="/logo-vendet.webp" 
                alt="VendeT" 
                width={44} 
                height={44} 
                className="h-11 w-auto drop-shadow-[0_0_6px_rgba(255,255,255,0.5)] bg-white/10 p-0.5 rounded-lg backdrop-blur" 
                fetchPriority="high"
                decoding="async"
              />
              <span className="hidden sm:block">
                <span className="font-black text-xl tracking-tight">
                  <span className="text-yellow-400">Vende</span><span className="text-white">T</span><span className="text-yellow-400 font-bold text-base ml-1">-Venezuela</span>
                </span>
              </span>
            </LocalLink>

            {/* Search (desktop) */}
            <form action="/buscar" method="GET" className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <label htmlFor="header-search" className="sr-only">{t('header.searchAria')}</label>
              <input
                id="header-search"
                type="text"
                name="q"
                placeholder={t('header.searchPlaceholder')}
                className="w-full py-2 px-4 pr-12 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
              <button 
                type="submit" 
                aria-label={t('header.searchAria')}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand-accent p-1.5 rounded-full hover:bg-accent/90 transition"
              >
                <Search size={18} className="text-brand-primary" />
              </button>
            </form>

            {/* Actions (desktop) */}
            <div className="flex items-center gap-2">
              {/* Language toggle - full page reload to avoid root layout hydration mismatch */}
              <a
                href={altLocaleHref}
                onClick={(e) => { e.preventDefault(); window.location.href = altLocaleHref; }}
                className="hidden md:flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-white/10 rounded-lg transition text-white/90"
                title={isEn ? 'Español' : 'English'}
                aria-label={isEn ? 'Cambiar a Español' : 'Switch to English'}
              >
                <Globe size={16} />
                <span className="text-xs font-medium">{isEn ? 'ES' : 'EN'}</span>
              </a>

              {/* Credits */}
              <LocalLink href="/creditos" className="relative hidden md:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm font-medium transition" title={t('header.creditsTitle')}>
                <Zap size={16} className="text-brand-accent" />
                <span className="hidden lg:inline">{t('header.credits')}</span>
                {showCreditoBadge && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[9px] font-black px-1 rounded-full">{t('header.freeBadge')}</span>
                )}
                {creditoChecked && creditoBalance !== null && creditoBalance > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-accent text-brand-primary text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">{creditoBalance}</span>
                )}
              </LocalLink>
              <LocalLink 
                href="/creditos" 
                aria-label={t('header.credits')}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition relative" 
                title={t('header.credits')}
              >
                <Zap size={20} className="text-brand-accent" />
                {showCreditoBadge && (
                  <span className="absolute top-0 right-0 bg-green-400 text-brand-primary text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full">1</span>
                )}
              </LocalLink>

              {/* Language toggle for mobile - full page reload */}
              <a
                href={altLocaleHref}
                onClick={(e) => { e.preventDefault(); window.location.href = altLocaleHref; }}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition"
                title={isEn ? 'Español' : 'English'}
                aria-label={isEn ? 'Cambiar a Español' : 'Switch to English'}
              >
                <span className="text-lg" aria-hidden="true">{isEn ? '🇻🇪' : '🇺🇸'}</span>
              </a>

              {!user ? (
                <>
                  <LocalLink href="/login" className="hidden md:inline px-3 py-2 text-sm font-medium hover:text-brand-accent transition">{t('header.signIn')}</LocalLink>
                  <LocalLink href="/register" className="hidden md:inline bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent/90 transition">{t('header.signUp')}</LocalLink>
                  {!isPWA && (
                    <button 
                      aria-label={mobileOpen ? t('header.closeMenu') : t('header.openMenu')}
                      className="md:hidden p-2 hover:bg-white/10 rounded-lg transition" 
                      onClick={() => setMobileOpen(!mobileOpen)}
                    >
                      {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <LocalLink href="/publicar" className="hidden md:flex items-center gap-1 bg-brand-accent text-brand-primary px-3 py-2 rounded-lg text-sm font-bold hover:bg-accent/90 transition">
                    <PlusCircle size={16} /> {t('header.publish')}
                  </LocalLink>
                  <LocalLink 
                    href="/chat" 
                    aria-label={`${t('header.messages')}${unreadCount > 0 ? ` - ${unreadCount} unread` : ''}`}
                    className="relative p-2 hover:bg-white/10 rounded-lg transition" 
                    title={t('header.messages')}
                  >
                    <MessageCircle size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-brand-dark text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    )}
                  </LocalLink>
                  <LocalLink 
                    href="/dashboard" 
                    aria-label={t('header.myPanel')}
                    className="hidden sm:block p-1 hover:bg-white/10 rounded-lg transition" 
                    title={t('header.myPanel')}
                  >
                    <Avatar nombre={user?.user_metadata?.nombre || user?.email || 'U'} fotoUrl={user?.user_metadata?.foto_perfil_url || null} size="sm" />
                  </LocalLink>
                  {!isPWA && (
                    <button 
                      aria-label={mobileOpen ? t('header.closeMenu') : t('header.openMenu')}
                      className="md:hidden p-2 hover:bg-white/10 rounded-lg transition" 
                      onClick={() => setMobileOpen(!mobileOpen)}
                    >
                      {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mobile menu — mobile browser only, NOT in PWA */}
          {!isPWA && mobileOpen && (
            <div className="md:hidden pb-4 animate-fadeIn">
              <form action="/buscar" method="GET" className="mb-3">
                <label htmlFor="mobile-search" className="sr-only">{t('header.searchAria')}</label>
                <input 
                  id="mobile-search"
                  type="text" 
                  name="q" 
                  placeholder={t('header.searchPlaceholder')} 
                  className="w-full py-2.5 px-4 rounded-lg text-gray-800 bg-white" 
                />
              </form>
              <nav className="flex flex-col gap-1">
                {!user ? (
                  <>
                    <LocalLink href="/login" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">{t('header.signIn')}</LocalLink>
                    <LocalLink href="/register" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg bg-brand-accent text-white font-bold text-center transition">{t('header.signUpFree')}</LocalLink>
                  </>
                ) : (
                  <>
                    <LocalLink href="/publicar" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg bg-brand-accent text-brand-primary font-bold text-center transition">📢 {t('header.publishSomething')}</LocalLink>
                    <LocalLink href="/chat" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">💬 {t('header.messages')}{unreadCount > 0 ? t('header.messagesWithCount').replace('{count}', String(unreadCount)) : ''}</LocalLink>
                    <LocalLink href="/dashboard" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">👤 {t('header.myPanel')}</LocalLink>
                    <LocalLink href="/creditos" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">⚡ {t('header.credits')}{creditoChecked && creditoBalance !== null && creditoBalance > 0 ? t('header.creditsAvailable').replace('{count}', String(creditoBalance)) : ''}</LocalLink>
                  </>
                )}
                <LocalLink href="/blog" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">📝 {t('header.blog')}</LocalLink>
                <LocalLink href="/catalogo" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg hover:bg-white/10 transition">{t('header.viewCatalog')}</LocalLink>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* ============ SUB-HEADER: CATEGORIES ============ */}
      <div className="hidden md:block bg-white border-b border-gray-200 shadow-sm sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 h-11 overflow-x-auto hide-scrollbar">
            {categorias.map((cat) => (
              <LocalLink
                key={cat.id}
                href={cat.id === 'ver-todo' ? '/catalogo' : `/catalogo?categoria=${cat.id}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition font-medium whitespace-nowrap ${
                  cat.id === 'ver-todo'
                    ? 'text-brand-primary bg-blue-50 hover:bg-blue-100 font-bold'
                    : 'text-gray-600 hover:text-brand-primary hover:bg-blue-50'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                {cat.nombre}
              </LocalLink>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
