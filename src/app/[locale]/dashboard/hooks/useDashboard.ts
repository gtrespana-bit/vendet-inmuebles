import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSupabaseAuthHeaders } from '@/lib/supabase-auth-headers'
import { useAuth } from '@/components/AuthProvider'

export interface PlanInfo {
  plan: string
  effectivePublishingPlan?: string
  estado: string | null
  trialEndsAt: string | null
  fin: string | null
  creditosIncluidos: number
  creditosUsadosMes?: number
  creditosRestantesPlan?: number
  limits: { maxAnuncios: number; maxFotos: number; creditosMes: number }
  activeCount: number
  canPublish: boolean
  agencia?: {
    id: string
    nombre: string
    logo_url: string | null
    owner_id: string
    rol: 'admin' | 'agente'
    esDueno: boolean
    esAdmin: boolean
    planAgenciaActivo: boolean
    totalMiembros: number
  } | null
}

export interface DashboardData {
  productos: any[]
  visitasTotales: number
  favoritos: any[]
  favoritosCount: number
  creditos: number
  pubCount: number
  nombre: string
  telefono: string
  estado: string
  ciudad: string
  fotoUrl: string | null
  verificado: boolean
  nivelConfianza: number
  badgesAuto: string[]
  ultimaActividad: string | null
  creadoEn: string | null
  resenas: any[]
  promedioResenas: number
  loading: boolean
}

export function useDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [productos, setProductos] = useState<any[]>([])
  const [visitasTotales, setVisitasTotales] = useState(0)
  const [favoritos, setFavoritos] = useState<any[]>([])
  const [favoritosCount, setFavoritosCount] = useState(0)
  const [creditos, setCreditos] = useState(0)
  const [pubCount, setPubCount] = useState(0)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [estado, setEstado] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [verificado, setVerificado] = useState(false)
  const [nivelConfianza, setNivelConfianza] = useState(0)
  const [badgesAuto, setBadgesAuto] = useState<string[]>([])
  const [ultimaActividad, setUltimaActividad] = useState<string | null>(null)
  const [creadoEn, setCreadoEn] = useState<string | null>(null)
  const [resenas, setResenas] = useState<any[]>([])
  const [promedioResenas, setPromedioResenas] = useState(0)
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const userId = user?.id
  const refreshAll = useCallback(() => {
    if (!userId) return

    // Supabase client automatically handles auth tokens via persistSession + autoRefreshToken
    Promise.all([
      supabase.from('vw_propiedades_publicas').select('id, titulo, slug, precio, estado, ciudad, activo, visitas, creado_en, main_image_url, operacion_nombre, destacado, destacado_hasta, boosteado_en, estado_moderacion, vendido, agencia_id, agente_asignado_id, agente_nombre').or(`usuario_id.eq.${userId},agente_asignado_id.eq.${userId}`).order('creado_en', { ascending: false }).then(({ data }: { data: any[] | null }) => setProductos(data || [])),

      supabase.from('vw_propiedades_publicas').select('visitas').or(`usuario_id.eq.${userId},agente_asignado_id.eq.${userId}`).then(({ data }: { data: any[] | null }) => setVisitasTotales(data?.reduce((sum: number, p: { visitas: number | null }) => sum + (p.visitas || 0), 0) || 0)),
      supabase.from('favoritos').select('producto_id, creado_en').eq('user_id', userId).order('creado_en', { ascending: false }).then(async ({ data }: { data: any[] | null }) => {
        const favoriteRows = data || []
        const propertyIds = favoriteRows.map((favorite: any) => favorite.producto_id)
        const { data: properties } = propertyIds.length
          ? await supabase.from('vw_propiedades_publicas').select('id, titulo, price, main_image_url, activo, user_id, ciudad, state_name').in('id', propertyIds)
          : { data: [] }
        const propertyById = new Map((properties || []).map((property: any) => [property.id, property]))
        const visibleFavorites = favoriteRows
          .map((favorite: any) => ({ ...favorite, productos: propertyById.get(favorite.producto_id) || null }))
          .filter((favorite: any) => favorite.productos)
        setFavoritos(visibleFavorites)
        setFavoritosCount(visibleFavorites.length)
      }),
      supabase.from('perfiles').select('credito_balance, nombre, telefono, estado, ciudad, foto_perfil_url, verificado, nivel_confianza, badges_automaticos, ultima_actividad, creado_en').eq('id', userId).single().then(({ data }: { data: any | null }) => {
        setCreditos(data?.credito_balance ?? 0)
        if (data) {
          setNombre(data.nombre || '')
          setTelefono(data.telefono || '')
          setEstado(data.estado || '')
          setCiudad(data.ciudad || '')
          setFotoUrl(data.foto_perfil_url || null)
          setVerificado(data.verificado || false)
          setNivelConfianza(data.nivel_confianza ?? 0)
          setBadgesAuto(data.badges_automaticos || [])
          setUltimaActividad(data.ultima_actividad || null)
          setCreadoEn(data.creado_en || null)
        }
      }),
      supabase.from('vw_propiedades_publicas').select('*', { count: 'exact' }).or(`user_id.eq.${userId},agente_asignado_id.eq.${userId}`).eq('activo', true).then(({ count }: { count: number | null }) => setPubCount(count || 0)),
      supabase.from('resenas').select('id, puntuacion, comentario, producto_id, producto_titulo, creado_en').eq('vendedor_id', userId).order('creado_en', { ascending: false }).then(async ({ data }: { data: any[] | null }) => {
        const reviews = data || []
        const propertyIds = Array.from(new Set(reviews.map((review: any) => review.producto_id).filter(Boolean)))
        const { data: properties } = propertyIds.length
          ? await supabase.from('vw_propiedades_publicas').select('id, titulo').in('id', propertyIds)
          : { data: [] }
        const titleById = new Map((properties || []).map((property: any) => [property.id, property.titulo]))
        const flattenedResenas = reviews.map((review: any) => ({
          ...review,
          producto_titulo: review.producto_titulo || titleById.get(review.producto_id) || 'Producto eliminado',
        }))
          setResenas(flattenedResenas)
          if (reviews.length > 0) {
            const avg = reviews.reduce((sum: number, review: { puntuacion: number }) => sum + review.puntuacion, 0) / reviews.length
            setPromedioResenas(Math.round(avg * 10) / 10)
          } else {
            setPromedioResenas(0)
          }
        }),
      // Plan de suscripción (límites, estado y fechas)
      getSupabaseAuthHeaders()
        .then((authHeaders: Record<string, string>) =>
          fetch('/api/user/plan', { headers: authHeaders }).then((res: Response) => (res.ok ? res.json() : null))
        )
        .then((plan: any) => { if (plan && plan.plan) setPlanInfo(plan as PlanInfo) })
        .catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (authLoading) return
    refreshAll()
  }, [userId, authLoading, refreshAll])

  // Resincronizar saldos de créditos y estado al volver a enfocar la pestaña (sin WebSockets sobre `perfiles`)
  useEffect(() => {
    if (!userId) return
    const onFocus = () => {
      if (document.visibilityState === 'visible') refreshAll()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [userId, refreshAll])

  return {
    productos, setProductos, visitasTotales, favoritos, favoritosCount,
    creditos, setCreditos, pubCount, nombre, setNombre, telefono, setTelefono,
    estado, setEstado, ciudad, setCiudad, fotoUrl, setFotoUrl, verificado,
    nivelConfianza, badgesAuto, ultimaActividad, creadoEn, resenas,
    promedioResenas, planInfo, loading, setToast, toast, refreshAll,
  }
}
