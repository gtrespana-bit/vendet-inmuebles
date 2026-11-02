"use client"

import { useEffect, useState, lazy, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import dynamic from 'next/dynamic'
import { getTasaBCVClient, actualizarTasaClient } from '@/lib/tasaBCV'
import { useTranslations } from 'next-intl'
import { Package, CreditCard, Heart, X, Star, ShieldCheck, BarChart3, Settings, Users, CalendarCheck } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import { routing } from '@/i18n/routing'

// Components
import ProfileHero from './components/ProfileHero'
import DashboardHeader from './components/DashboardHeader'
import StorefrontSettingsCard from './components/StorefrontSettingsCard'
import TabResumen from './components/TabResumen'
import TabCreditos from './components/tabs/TabCreditos'
import TabFavoritos from './components/tabs/TabFavoritos'
import BoostModal from './components/modals/BoostModal'
import DestacadoModal from './components/modals/DestacadoModal'

// Lazy-load heavy tabs
const TabProductos = lazy(() => import('./components/tabs/TabProductos'))
const TabVisitasLeads = dynamic(() => import('./components/tabs/TabVisitasLeads'), { ssr: false })
const TabEquipo = dynamic(() => import('./components/tabs/TabEquipo'), { ssr: false })
const SolicitarVerificacion = dynamic(() => import('@/components/SolicitarVerificacion'), { ssr: false })
const TabReputacion = dynamic(() => import('./components/tabs/TabReputacion'), { ssr: false })

// Hooks
import { useDashboard } from './hooks/useDashboard'
import { supabase } from '@/lib/supabase'

function PasswordModal({ user, setToast, onClose }: { user: any; setToast: (s: string | null) => void; onClose: () => void }) {
  const t = useTranslations('dashboard')
  const [pwActual, setPwActual] = useState('')
  const [pwNueva, setPwNueva] = useState('')
  const [pwRepetir, setPwRepetir] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwGuardando, setPwGuardando] = useState(false)

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwNueva !== pwRepetir) { setPwError(t('pwMismatch')); return }
    if (pwNueva.length < 8) { setPwError(t('pwMinLength')); return }
    setPwGuardando(true)

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: pwActual,
    })
    if (signInError || !signInData.user) {
      setPwError(t('pwWrong'))
      setPwGuardando(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: pwNueva })
    if (error) {
      setPwError(error.message)
    } else {
      setToast(t('pwSuccess'))
    }
    setPwGuardando(false)
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">{t('passwordTitle')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>
        {pwError && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">⚠️ {pwError}</div>}
        <form onSubmit={handleCambiarPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pwCurrent')}</label>
            <input type="password" value={pwActual} onChange={e => setPwActual(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('pwCurrentPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pwNew')}</label>
            <input type="password" value={pwNueva} onChange={e => setPwNueva(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('pwNewPlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pwRepeat')}</label>
            <input type="password" value={pwRepetir} onChange={e => setPwRepetir(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm bg-white" placeholder={t('pwRepeatPlaceholder')} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50">{t('cancelEdit')}</button>
            <button type="submit" disabled={pwGuardando} className="flex-1 py-3 bg-brand-primary text-white rounded-lg font-bold hover:bg-brand-dark disabled:opacity-50">{pwGuardando ? t('pwSaving') : t('pwChange')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const data = useDashboard()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState('resumen')
  const [cambiarPw, setCambiarPw] = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [boostTarget, setBoostTarget] = useState<{ productId: string; titulo: string } | null>(null)
  const [destacadoTarget, setDestacadoTarget] = useState<{ productId: string; titulo: string } | null>(null)
  const [tasaBs, setTasaBs] = useState(0)

  // Read tab or confirmation notice from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'mensajes') { router.replace(pathname.startsWith('/en') ? '/en/chat' : '/chat'); return }
    if (tab && ['resumen', 'productos', 'visitas', 'equipo', 'creditos', 'favoritos', 'verificacion', 'reputacion', 'perfil'].includes(tab)) {
      setActiveTab(tab)
    }
    if (params.get('confirmed') === '1' || params.get('confirmed') === 'true') {
      const isEn = pathname === '/en' || pathname.startsWith('/en/')
      data.setToast(
        isEn
          ? '✅ Email confirmed successfully! Your account is now active.'
          : '✅ ¡Correo confirmado con éxito! Tu cuenta ya está activa.'
      )
      params.delete('confirmed')
      const qs = params.toString()
      try {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
      } catch {
        // Ignorar
      }
      const timer = setTimeout(() => data.setToast(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [router, pathname])

  useEffect(() => {
    const tasaData = getTasaBCVClient()
    setTasaBs(tasaData.tasa)
    actualizarTasaClient().then(d => setTasaBs(d.tasa))
  }, [])

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user || !file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) { data.setToast(t('imageTooLarge')); return }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', user.id)

    const res = await fetch('/api/foto-perfil', {
      method: 'POST',
      headers: await getSupabaseAuthHeaders(),
      body: formData,
    })
    const json = await res.json()

    if (!res.ok) {
      data.setToast(t('photoError') + json.error)
      return
    }

    data.setFotoUrl(json.url)
  }

  // Build locale-aware redirect path
  const redirectPath = (path: string) => {
    const currentLocale = (() => {
      for (const locale of routing.locales) {
        if (locale === routing.defaultLocale) continue
        if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return locale
      }
      return routing.defaultLocale
    })()
    if (currentLocale === routing.defaultLocale) return path
    return `/${currentLocale}${path === '/' ? '' : path}`
  }

  async function handleLogout() {
    // ✅ FIX: Call API route to clear server-side cookies,
    // then signOut from singleton to clear localStorage + notify AuthProvider
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Continue even if API call fails
    }
    await supabase.auth.signOut()
    router.push(redirectPath('/'))
  }

  async function handleBoost(productId: string) {
    const { data: result, error } = await supabase.rpc('usar_boost', { p_producto_id: productId, p_user_id: user!.id })
    if (error || !result?.ok) {
      data.setToast(`Error: ${result?.error || error?.message || t('boostError')}`)
    } else {
      data.setCreditos(result.balance)
      data.setToast(t('boostApplied'))
      data.refreshAll()
    }
    setBoostTarget(null)
    setTimeout(() => data.setToast(null), 4000)
  }

  async function handleDestacar(productId: string, horas: number) {
    const { data: result, error } = await supabase.rpc('usar_destacado', { p_producto_id: productId, p_user_id: user!.id, p_horas: horas })
    if (error || !result?.ok) {
      data.setToast(`Error: ${result?.error || error?.message || t('featuredError')}`)
    } else {
      data.setCreditos(result.balance)
      data.setToast(t('featuredActivated', { hours: horas }))
      data.refreshAll()
    }
    setDestacadoTarget(null)
    setTimeout(() => data.setToast(null), 4000)
  }

  if (authLoading) {
    // Show loading state while authentication is being resolved
    return (
      <div className="dashboard-page min-h-[60vh] flex items-center justify-center px-4" aria-busy="true">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--burgundy)]" />
          <p className="text-sm text-gray-500">{t('loadingDashboard')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="dashboard-page min-h-[60vh] flex items-center justify-center px-4">
        <div className="dashboard-login-gate">
          <p className="dashboard-page__eyebrow">{t('screenEyebrow')}</p>
          <h2>{t('loginRequired')}</h2>
          <p>{t('loginRequiredDesc')}</p>
          <LocalLink href="/login?redirect=%2Fdashboard%3Ftab%3Dperfil">{t('loginButton')}</LocalLink>
        </div>
      </div>
    )
  }

  const numPubsVendidas = data.productos.filter((p: any) => p.vendido || (!p.activo && p.estado_moderacion !== 'rechazado')).length

  const averageViews = data.productos.length ? Math.round(data.visitasTotales / data.productos.length) : 0
  const promotedCount = data.productos.filter((p: any) => p.boosteado_en || (p.destacado && p.destacado_hasta > new Date().toISOString())).length
  const tabs = [
    { id: 'resumen', label: t('tabSummary'), icon: BarChart3 },
    { id: 'productos', label: t('tabListings'), icon: Package },
    { id: 'visitas', label: t('tabVisits'), icon: CalendarCheck },
    { id: 'equipo', label: t('tabTeam'), icon: Users },
    { id: 'creditos', label: t('tabCredits'), icon: CreditCard },
    { id: 'favoritos', label: t('tabFavorites'), icon: Heart },
    { id: 'verificacion', label: t('tabVerification'), icon: ShieldCheck },
    { id: 'reputacion', label: t('tabReputation'), icon: Star },
    { id: 'perfil', label: t('tabProfile'), icon: Settings },
  ]

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__inner">
        {data.toast && (
          <div className="fixed top-4 right-4 z-50 max-w-xs rounded-sm bg-[#382a2a] px-5 py-3 text-sm font-medium text-white shadow-xl" role="status">
            {data.toast}
          </div>
        )}

        {boostTarget && (
          <BoostModal
            titulo={boostTarget.titulo}
            onClose={() => setBoostTarget(null)}
            onBoost={() => handleBoost(boostTarget.productId)}
          />
        )}
        {destacadoTarget && (
          <DestacadoModal
            titulo={destacadoTarget.titulo}
            creditos={data.creditos + (data.planInfo?.creditosRestantesPlan ?? 0)}
            onClose={() => setDestacadoTarget(null)}
            onDestacar={(h) => handleDestacar(destacadoTarget.productId, h)}
          />
        )}
        {cambiarPw && <PasswordModal user={user} setToast={data.setToast} onClose={() => setCambiarPw(false)} />}

        <ProfileHero
          userId={user!.id}
          nombre={data.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''}
          email={user?.email}
          fotoUrl={data.fotoUrl}
          verificado={data.verificado}
          nivelConfianza={data.nivelConfianza}
          estado={data.estado}
          ciudad={data.ciudad}
          creadoEn={data.creadoEn}
          resenasCount={data.resenas.length}
          promedioResenas={data.promedioResenas}
          creditos={data.creditos + (data.planInfo?.creditosRestantesPlan ?? 0)}
          planInfo={data.planInfo}
          onGoToTab={setActiveTab}
          onFotoChange={handleFoto}
        />

        <nav className="dashboard-tabs" role="tablist" aria-label={t('tabsLabel')}>
          {tabs.map((item) => {
            const Icon = item.icon
            const selected = activeTab === item.id
            return (
              <button
                key={item.id}
                id={`dashboard-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="dashboard-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(item.id)}
                onKeyDown={(event) => {
                  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
                  event.preventDefault()
                  const currentIndex = tabs.findIndex((tab) => tab.id === item.id)
                  const nextIndex = event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
                  const nextTab = tabs[nextIndex]
                  setActiveTab(nextTab.id)
                  document.getElementById(`dashboard-tab-${nextTab.id}`)?.focus()
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <section
          id="dashboard-panel"
          className="dashboard-tab-panel"
          role="tabpanel"
          aria-labelledby={`dashboard-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'resumen' && (
            <TabResumen
              userId={user!.id}
              productos={data.productos}
              verificado={data.verificado}
              planInfo={data.planInfo}
              onGoToTab={setActiveTab}
            />
          )}
          {activeTab === 'productos' && (
            <Suspense fallback={<div className="dashboard-panel p-10 text-center text-sm text-gray-400">{t('loadingListings')}</div>}>
              <TabProductos
                productos={data.productos}
                onBoost={setBoostTarget}
                onDestacar={setDestacadoTarget}
                userId={user?.id ?? ''}
                visitasTotales={data.visitasTotales}
                averageViews={averageViews}
                promotedCount={promotedCount}
              />
            </Suspense>
          )}
          {activeTab === 'visitas' && (
            <TabVisitasLeads onToast={data.setToast} />
          )}
          {activeTab === 'equipo' && (
            <TabEquipo
              userId={user!.id}
              onToast={data.setToast}
              onRefreshDashboard={data.refreshAll}
              onBoost={setBoostTarget}
              onDestacar={setDestacadoTarget}
            />
          )}
          {activeTab === 'creditos' && (
            <TabCreditos
              creditos={data.creditos}
              planInfo={data.planInfo}
              tasaBs={tasaBs}
              refreshCreditos={data.refreshAll}
            />
          )}
          {activeTab === 'favoritos' && <TabFavoritos favoritos={data.favoritos} />}
          {activeTab === 'verificacion' && <SolicitarVerificacion />}
          {activeTab === 'reputacion' && (
            <TabReputacion
              verificado={data.verificado}
              nivelConfianza={data.nivelConfianza}
              badgesAuto={data.badgesAuto}
              resenas={data.resenas}
              promedioResenas={data.promedioResenas}
              numPubsActivas={data.pubCount}
              numPubsVendidas={numPubsVendidas}
              creadoEn={data.creadoEn}
              ultimaActividad={data.ultimaActividad}
            />
          )}
          {activeTab === 'perfil' && (
            <div className="dashboard-profile-settings">
              <div className="dashboard-profile-settings__intro">
                <h2>{t('profileSettingsTitle')}</h2>
                <p>{t('profileSettingsDescription')}</p>
              </div>
              <DashboardHeader
                user={user}
                nombre={data.nombre} setNombre={data.setNombre}
                telefono={data.telefono} setTelefono={data.setTelefono}
                estado={data.estado} setEstado={data.setEstado}
                ciudad={data.ciudad} setCiudad={data.setCiudad}
                fotoUrl={data.fotoUrl} setFotoUrl={data.setFotoUrl}
                verificado={data.verificado}
                nivelConfianza={data.nivelConfianza}
                resenasCount={data.resenas.length}
                promedioResenas={data.promedioResenas}
                setToast={data.setToast}
                setGuardando={setGuardandoPerfil}
                onPassword={() => setCambiarPw(true)}
                onLogout={handleLogout}
                onFotoChange={handleFoto}
              />
              <StorefrontSettingsCard userId={user!.id} onToast={data.setToast} />
              <div className="dashboard-profile-settings__public">
                <div>
                  <strong>{t('publicProfileTitle')}</strong>
                  <span>{t('publicProfileDescription')}</span>
                </div>
                <LocalLink href={`/vendedor/${user!.id}`}>{t('viewPublicProfile')} →</LocalLink>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
