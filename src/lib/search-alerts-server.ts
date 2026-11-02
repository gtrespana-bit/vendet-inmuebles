import type { SupabaseClient } from '@supabase/supabase-js'
import { emailAlertaBusquedaGuardada } from '@/lib/server-email'
import { urlPreferenciasEmail } from '@/lib/email-preferences'
import { notifyUser } from '@/lib/push-notify'
import {
  buildSavedSearchQueryString,
  matchesSavedSearch,
  normalizeSavedSearchFilters,
  type MatchablePropertyRecord,
} from '@/lib/saved-searches'

const HORAS_ENTRE_DIARIAS = 20
const MINUTOS_ENTRE_INMEDIATAS = 30
const MAX_ALERTAS_POR_CICLO = 40
const MAX_HISTORIAL_IDS = 60

export interface ResultadoAlertasBusquedas {
  evaluadas: number
  enviadas: number
  omitidasCooldown: number
  omitidasPreferencia: number
  errores: number
}

export async function procesarAlertasBusquedasGuardadas(
  supabase: SupabaseClient,
): Promise<ResultadoAlertasBusquedas> {
  const resultado: ResultadoAlertasBusquedas = {
    evaluadas: 0,
    enviadas: 0,
    omitidasCooldown: 0,
    omitidasPreferencia: 0,
    errores: 0,
  }

  const { data: busquedas, error: busquedasErr } = await supabase
    .from('busquedas_guardadas')
    .select(
      'id, user_id, nombre, query_string, filtros, alerta_email, frecuencia, ultimo_envio_en, ultimos_inmuebles_enviados, creado_en',
    )
    .eq('alerta_email', true)
    .neq('frecuencia', 'pausada')
    .order('ultimo_envio_en', { ascending: true, nullsFirst: true })
    .limit(MAX_ALERTAS_POR_CICLO)

  if (busquedasErr || !busquedas || busquedas.length === 0) {
    return resultado
  }

  const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: propiedadesRecientes, error: propErr } = await supabase
    .from('vw_propiedades_publicas')
    .select(
      'id, usuario_id, slug, titulo, descripcion, operacion_slug, operacion_nombre, tipo_slug, tipo_nombre, subcategoria, estado, ciudad, municipio, zona, precio, precio_usd, moneda, habitaciones, banos, puestos_estacionamiento, area_construida, area_total, condicion, creado_en',
    )
    .gte('creado_en', hace7Dias)
    .order('creado_en', { ascending: false })
    .limit(100)

  if (propErr || !propiedadesRecientes || propiedadesRecientes.length === 0) {
    return resultado
  }

  const ahoraMs = Date.now()

  for (const row of busquedas) {
    resultado.evaluadas += 1

    const ultimoMs = row.ultimo_envio_en ? Date.parse(String(row.ultimo_envio_en)) : 0
    const umbralMs =
      row.frecuencia === 'inmediata'
        ? MINUTOS_ENTRE_INMEDIATAS * 60 * 1000
        : HORAS_ENTRE_DIARIAS * 60 * 60 * 1000

    if (ultimoMs > 0 && ahoraMs - ultimoMs < umbralMs) {
      resultado.omitidasCooldown += 1
      continue
    }

    const enviadosSet = new Set<string>(
      Array.isArray(row.ultimos_inmuebles_enviados)
        ? row.ultimos_inmuebles_enviados.map((x: unknown) => String(x))
        : [],
    )

    const filtros = normalizeSavedSearchFilters(
      row.filtros && typeof row.filtros === 'object' ? (row.filtros as Record<string, unknown>) : {},
    )

    const creacionBusquedaMs = row.creado_en ? Date.parse(String(row.creado_en)) : 0

    const coincidencias = propiedadesRecientes.filter((prop: any) => {
      if (!prop?.id) return false
      if (String(prop.usuario_id || '') === String(row.user_id)) return false
      if (enviadosSet.has(String(prop.id))) return false
      // Solo notificar inmuebles publicados después de crear la alerta (o posteriores al último envío)
      const propMs = prop.creado_en ? Date.parse(String(prop.creado_en)) : 0
      const corteMinMs = ultimoMs > 0 ? ultimoMs : creacionBusquedaMs
      if (corteMinMs > 0 && propMs > 0 && propMs < corteMinMs) return false
      return matchesSavedSearch(prop as MatchablePropertyRecord, filtros)
    })

    if (coincidencias.length === 0) continue

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('nombre, email, email_notificaciones')
      .eq('id', row.user_id)
      .maybeSingle()

    if (perfil && perfil.email_notificaciones === false) {
      resultado.omitidasPreferencia += 1
      continue
    }

    let emailDestino: string | null = perfil?.email ? String(perfil.email).trim() : null
    if (!emailDestino) {
      const { data: authUser } = await supabase.auth.admin.getUserById(String(row.user_id))
      emailDestino = authUser?.user?.email || null
    }
    if (!emailDestino) continue

    const lote = coincidencias.slice(0, 5)
    let unsubscribeUrl: string | undefined
    try {
      unsubscribeUrl = urlPreferenciasEmail(String(row.user_id))
    } catch {
      unsubscribeUrl = undefined
    }

    const ok = await emailAlertaBusquedaGuardada({
      email: emailDestino,
      nombreUsuario: String(perfil?.nombre || 'buscador'),
      nombreBusqueda: String(row.nombre || 'Tu búsqueda guardada'),
      queryString: String(row.query_string || buildSavedSearchQueryString(filtros)),
      inmuebles: lote.map((p: any) => ({
        id: String(p.id),
        slug: p.slug ? String(p.slug) : null,
        titulo: String(p.titulo || 'Inmueble en Venezuela'),
        precio: Number(p.precio_usd ?? p.precio ?? 0),
        moneda: p.moneda ? String(p.moneda) : 'USD',
        ubicacion: [p.zona, p.ciudad, p.estado].filter(Boolean).join(', ') || 'Venezuela',
        operacion: String(p.operacion_slug || '').toLowerCase().includes('alquiler') ? 'alquiler' : 'venta',
      })),
      unsubscribeUrl,
    })

    if (!ok) {
      resultado.errores += 1
      continue
    }

    const nuevosIds = lote.map((p: any) => String(p.id))
    const historialActualizado = Array.from(new Set([...nuevosIds, ...Array.from(enviadosSet)])).slice(
      0,
      MAX_HISTORIAL_IDS,
    )

    await supabase
      .from('busquedas_guardadas')
      .update({
        ultimo_envio_en: new Date().toISOString(),
        ultimos_inmuebles_enviados: historialActualizado,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', row.id)

    void notifyUser(supabase, String(row.user_id), {
      title:
        lote.length === 1
          ? '🔔 Nuevo inmueble para tu alerta'
          : `🔔 ${lote.length} nuevos inmuebles para tu alerta`,
      body: `${String(row.nombre || 'Búsqueda guardada')}: ${String(lote[0]?.titulo || 'Ver coincidencia')}`,
      tag: `alerta-busqueda-${row.id}`,
      icon: '/icon-192.png',
      click_url: `/inmueble/${lote[0]?.slug || lote[0]?.id || ''}`,
    }).catch(() => undefined)

    resultado.enviadas += 1
  }

  return resultado
}

/**
 * Dispara en tiempo real únicamente las alertas con `frecuencia = 'inmediata'`
 * cuando un inmueble entra en estado público aprobado (`POST /api/properties`,
 * `POST /api/publicar` o `POST /api/admin/moderar-producto`).
 */
export async function dispararAlertasInmediatasPorInmueble(
  supabase: SupabaseClient,
  inmuebleId: string,
): Promise<{ evaluadas: number; enviadas: number }> {
  const stats = { evaluadas: 0, enviadas: 0 }
  if (!inmuebleId) return stats

  const { data: prop, error: propErr } = await supabase
    .from('vw_propiedades_publicas')
    .select(
      'id, usuario_id, slug, titulo, descripcion, operacion_slug, operacion_nombre, tipo_slug, tipo_nombre, subcategoria, estado, ciudad, municipio, zona, precio, precio_usd, moneda, habitaciones, banos, puestos_estacionamiento, area_construida, area_total, condicion, creado_en',
    )
    .eq('id', inmuebleId)
    .maybeSingle()

  if (propErr || !prop?.id) return stats

  const { data: alertas, error: alertasErr } = await supabase
    .from('busquedas_guardadas')
    .select(
      'id, user_id, nombre, query_string, filtros, alerta_email, frecuencia, ultimo_envio_en, ultimos_inmuebles_enviados',
    )
    .eq('alerta_email', true)
    .eq('frecuencia', 'inmediata')
    .neq('user_id', String(prop.usuario_id || ''))
    .limit(60)

  if (alertasErr || !alertas || alertas.length === 0) return stats

  const propIdStr = String(prop.id)

  for (const row of alertas) {
    stats.evaluadas += 1

    const enviadosSet = new Set<string>(
      Array.isArray(row.ultimos_inmuebles_enviados)
        ? row.ultimos_inmuebles_enviados.map((x: unknown) => String(x))
        : [],
    )
    if (enviadosSet.has(propIdStr)) continue

    const filtros = normalizeSavedSearchFilters(
      row.filtros && typeof row.filtros === 'object' ? (row.filtros as Record<string, unknown>) : {},
    )
    if (!matchesSavedSearch(prop as MatchablePropertyRecord, filtros)) continue

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('nombre, email, email_notificaciones')
      .eq('id', row.user_id)
      .maybeSingle()

    if (perfil && perfil.email_notificaciones === false) continue

    let emailDestino: string | null = perfil?.email ? String(perfil.email).trim() : null
    if (!emailDestino) {
      const { data: authUser } = await supabase.auth.admin.getUserById(String(row.user_id))
      emailDestino = authUser?.user?.email || null
    }
    if (!emailDestino) continue

    let unsubscribeUrl: string | undefined
    try {
      unsubscribeUrl = urlPreferenciasEmail(String(row.user_id))
    } catch {
      unsubscribeUrl = undefined
    }

    const ok = await emailAlertaBusquedaGuardada({
      email: emailDestino,
      nombreUsuario: String(perfil?.nombre || 'buscador'),
      nombreBusqueda: String(row.nombre || 'Tu búsqueda guardada'),
      queryString: String(row.query_string || buildSavedSearchQueryString(filtros)),
      inmuebles: [
        {
          id: propIdStr,
          slug: prop.slug ? String(prop.slug) : null,
          titulo: String(prop.titulo || 'Inmueble en Venezuela'),
          precio: Number(prop.precio_usd ?? prop.precio ?? 0),
          moneda: prop.moneda ? String(prop.moneda) : 'USD',
          ubicacion: [prop.zona, prop.ciudad, prop.estado].filter(Boolean).join(', ') || 'Venezuela',
          operacion: String(prop.operacion_slug || '').toLowerCase().includes('alquiler')
            ? 'alquiler'
            : 'venta',
        },
      ],
      unsubscribeUrl,
    })

    if (!ok) continue

    const historialActualizado = Array.from(new Set([propIdStr, ...Array.from(enviadosSet)])).slice(
      0,
      MAX_HISTORIAL_IDS,
    )

    await supabase
      .from('busquedas_guardadas')
      .update({
        ultimo_envio_en: new Date().toISOString(),
        ultimos_inmuebles_enviados: historialActualizado,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', row.id)

    void notifyUser(supabase, String(row.user_id), {
      title: '🔔 ¡Nuevo inmueble coincide con tu alerta!',
      body: `${String(prop.titulo || 'Inmueble')} · ${[prop.zona, prop.ciudad].filter(Boolean).join(', ')}`,
      tag: `alerta-inmediata-${propIdStr}`,
      icon: '/icon-192.png',
      click_url: `/inmueble/${prop.slug || propIdStr}`,
    }).catch(() => undefined)

    stats.enviadas += 1
  }

  return stats
}

