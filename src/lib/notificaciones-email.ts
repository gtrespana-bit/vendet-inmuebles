import type { SupabaseClient } from '@supabase/supabase-js'
import { emailMensajesNoLeidos } from '@/lib/server-email'
import { urlPreferenciasEmail } from '@/lib/email-preferences'
import { formatearPrecioPropiedad, limpiarPreviewMensaje } from '@/lib/email-resumen'

/**
 * Procesamiento de la cola `notificaciones_email`.
 *
 * El aviso de chat se programa en la base de datos (trigger de `mensajes`)
 * para enviarse unos minutos después del último mensaje. Esta rutina se
 * ejecuta periódicamente (cron) y sólo envía los avisos que siguen teniendo
 * mensajes sin leer. Nunca envía un correo por cada mensaje: agrupa.
 */

const MAX_INTENTOS = 3
/** Tiempo mínimo entre dos correos de chat para el mismo usuario. */
const MINUTOS_ENTRE_AVISOS = 30
/** Si se acaba de avisar, se reintenta más tarde. */
const MINUTOS_REPROGRAMACION = 15
const MAX_MENSAJES_POR_AVISO = 20
const MAX_REPROGRAMACIONES = 4

type NotificacionPendiente = {
  id: string
  user_id: string
  tipo: string
  clave: string
  intentos: number
  datos: Record<string, any> | null
}

export type ResultadoProcesamiento = {
  procesadas: number
  enviadas: number
  canceladas: number
  reprogramadas: number
  errores: number
  detalle: string[]
}

type ResultadoAviso = 'enviado' | 'cancelado' | 'reprogramado' | 'error'

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://venezuela-inmuebles.online'
  ).replace(/\/$/, '')
}

async function obtenerEmailUsuario(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    console.error('No se pudo leer el email del usuario:', error.message)
    return null
  }
  return data?.user?.email || null
}

async function obtenerPerfil(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ nombre: string; prefiereAvisos: boolean }> {
  const conPreferencia = await supabase
    .from('perfiles')
    .select('nombre, email_notificaciones')
    .eq('id', userId)
    .maybeSingle()

  if (!conPreferencia.error) {
    return {
      nombre: conPreferencia.data?.nombre || 'Usuario',
      prefiereAvisos: conPreferencia.data?.email_notificaciones !== false,
    }
  }

  // Compatibilidad con instalaciones donde la migración 006 aún no se aplicó.
  const { data } = await supabase.from('perfiles').select('nombre').eq('id', userId).maybeSingle()
  return { nombre: data?.nombre || 'Usuario', prefiereAvisos: true }
}

async function cerrarNotificacion(
  supabase: SupabaseClient,
  id: string,
  estado: 'cancelado' | 'error',
  motivo: string,
) {
  const { error } = await supabase
    .from('notificaciones_email')
    .update({
      estado,
      actualizado_en: new Date().toISOString(),
      ultimo_error: motivo,
    })
    .eq('id', id)
    .eq('estado', 'pendiente')

  if (error) console.error(`No se pudo cerrar la notificación ${id}:`, error.message)
}

async function reprogramarNotificacion(
  supabase: SupabaseClient,
  notificacion: NotificacionPendiente,
  minutos: number,
  motivo: string,
) {
  const intentos = Number(notificacion.intentos || 0) + 1
  const { error } = await supabase
    .from('notificaciones_email')
    .update({
      programado_para: new Date(Date.now() + minutos * 60 * 1000).toISOString(),
      intentos,
      ultimo_error: motivo,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', notificacion.id)
    .eq('estado', 'pendiente')

  if (error) console.error(`No se pudo reprogramar la notificación ${notificacion.id}:`, error.message)
}

/** Devuelve los mensajes sin leer que todavía no se anunciaron por correo. */
async function obtenerMensajesPendientes(
  supabase: SupabaseClient,
  conversacionId: string,
  userId: string,
) {
  const query = supabase
    .from('mensajes')
    .select('id, remitente_id, contenido, creado_en')
    .eq('conversacion_id', conversacionId)
    .eq('destinatario_id', userId)
    .eq('leido', false)
    .order('creado_en', { ascending: false })
    .limit(MAX_MENSAJES_POR_AVISO)

  const conControl = await query.is('email_notificado_en', null)
  if (!conControl.error) return conControl.data || []

  // Instalación sin la migración 006: se mantiene el comportamiento básico.
  const sinControl = await supabase
    .from('mensajes')
    .select('id, remitente_id, contenido, creado_en')
    .eq('conversacion_id', conversacionId)
    .eq('destinatario_id', userId)
    .eq('leido', false)
    .order('creado_en', { ascending: false })
    .limit(MAX_MENSAJES_POR_AVISO)

  if (sinControl.error) throw new Error(sinControl.error.message)
  return sinControl.data || []
}

async function procesarAvisoMensaje(
  supabase: SupabaseClient,
  notificacion: NotificacionPendiente,
): Promise<ResultadoAviso> {
  const conversacionId = notificacion.datos?.conversacion_id
  if (!conversacionId) {
    await cerrarNotificacion(supabase, notificacion.id, 'cancelado', 'sin_conversacion')
    return 'cancelado'
  }

  const { data: conversacion } = await supabase
    .from('conversaciones')
    .select('id, user1_id, user2_id, producto_id')
    .eq('id', conversacionId)
    .maybeSingle()

  if (
    !conversacion ||
    ![conversacion.user1_id, conversacion.user2_id].includes(notificacion.user_id)
  ) {
    await cerrarNotificacion(supabase, notificacion.id, 'cancelado', 'conversacion_no_disponible')
    return 'cancelado'
  }

  const perfil = await obtenerPerfil(supabase, notificacion.user_id)
  if (!perfil.prefiereAvisos) {
    await cerrarNotificacion(supabase, notificacion.id, 'cancelado', 'preferencias')
    return 'cancelado'
  }

  const mensajes = await obtenerMensajesPendientes(supabase, conversacionId, notificacion.user_id)
  if (mensajes.length === 0) {
    // Ya se leyeron o ya se anunciaron en un correo anterior.
    await cerrarNotificacion(supabase, notificacion.id, 'cancelado', 'sin_mensajes_pendientes')
    return 'cancelado'
  }

  // Límite de frecuencia: como máximo un correo de chat cada 30 minutos.
  const desde = new Date(Date.now() - MINUTOS_ENTRE_AVISOS * 60 * 1000).toISOString()
  const { data: avisoReciente } = await supabase
    .from('notificaciones_email')
    .select('id')
    .eq('user_id', notificacion.user_id)
    .eq('tipo', 'mensaje')
    .eq('estado', 'enviado')
    .gte('enviado_en', desde)
    .limit(1)
    .maybeSingle()

  if (avisoReciente) {
    if (Number(notificacion.intentos || 0) >= MAX_REPROGRAMACIONES) {
      await cerrarNotificacion(supabase, notificacion.id, 'cancelado', 'limite_de_avisos')
      return 'cancelado'
    }
    await reprogramarNotificacion(
      supabase,
      notificacion,
      MINUTOS_REPROGRAMACION,
      'reprogramado: ya se envió un aviso reciente',
    )
    return 'reprogramado'
  }

  const email = await obtenerEmailUsuario(supabase, notificacion.user_id)
  if (!email) {
    await cerrarNotificacion(supabase, notificacion.id, 'cancelado', 'sin_email')
    return 'cancelado'
  }

  const productoId = conversacion.producto_id || notificacion.datos?.producto_id || null
  let propiedad: Record<string, any> | null = null
  if (productoId) {
    const { data } = await supabase
      .from('inmuebles')
      .select('id, titulo, slug, precio, moneda, ciudad, estado, imagen_url')
      .eq('id', productoId)
      .maybeSingle()
    propiedad = data || null
  }

  const ultimo = mensajes[0]
  const { data: remitente } = await supabase
    .from('perfiles')
    .select('nombre')
    .eq('id', ultimo.remitente_id)
    .maybeSingle()

  const tituloPropiedad = propiedad?.titulo || 'tu inmueble'
  const ubicacion = [propiedad?.ciudad, propiedad?.estado].filter(Boolean).join(', ')
  const preview = limpiarPreviewMensaje(ultimo.contenido)

  const enviado = await emailMensajesNoLeidos({
    email,
    nombreDestinatario: perfil.nombre,
    nombreRemitente: remitente?.nombre || 'Un interesado',
    tituloPropiedad,
    ubicacionPropiedad: ubicacion || null,
    precioPropiedad: formatearPrecioPropiedad(propiedad?.precio, propiedad?.moneda),
    imagenPropiedad: propiedad?.imagen_url || null,
    totalMensajes: mensajes.length,
    mensajePreview: preview || 'Mensaje nuevo',
    urlChat: `${baseUrl()}/chat?conversation=${conversacionId}`,
    urlBaja: urlPreferenciasEmail(notificacion.user_id),
  })

  if (!enviado) {
    const intentos = Number(notificacion.intentos || 0) + 1
    if (intentos >= MAX_INTENTOS) {
      await cerrarNotificacion(supabase, notificacion.id, 'error', 'smtp')
    } else {
      await reprogramarNotificacion(supabase, notificacion, 10, 'smtp: reintento programado')
    }
    return 'error'
  }

  const ahora = new Date().toISOString()
  const ids = mensajes.map((mensaje: any) => mensaje.id)

  // Primero se marcan los mensajes: si algo fallara después, el siguiente
  // procesamiento cancelará el aviso en lugar de duplicarlo.
  const { error: updateMensajesError } = await supabase
    .from('mensajes')
    .update({ email_notificado_en: ahora })
    .in('id', ids)
  if (updateMensajesError) {
    console.error('No se pudo marcar los mensajes como anunciados:', updateMensajesError.message)
  }

  const { error: updateError } = await supabase
    .from('notificaciones_email')
    .update({
      estado: 'enviado',
      enviado_en: ahora,
      actualizado_en: ahora,
      ultimo_error: null,
      datos: { ...(notificacion.datos || {}), mensajes_anunciados: mensajes.length },
    })
    .eq('id', notificacion.id)
    .eq('estado', 'pendiente')
  if (updateError) throw new Error(updateError.message)

  return 'enviado'
}

export async function procesarNotificacionesEmailPendientes(
  supabase: SupabaseClient,
  opciones: { limite?: number } = {},
): Promise<ResultadoProcesamiento> {
  const limite = Math.min(Math.max(opciones.limite ?? 15, 1), 50)
  const resultado: ResultadoProcesamiento = {
    procesadas: 0,
    enviadas: 0,
    canceladas: 0,
    reprogramadas: 0,
    errores: 0,
    detalle: [],
  }

  const ahoraIso = new Date().toISOString()
  const { data: pendientes, error } = await supabase
    .from('notificaciones_email')
    .select('id, user_id, tipo, clave, intentos, datos')
    .eq('estado', 'pendiente')
    .lte('programado_para', ahoraIso)
    .order('programado_para', { ascending: true })
    .limit(limite)

  if (error) throw new Error(`No se pudo leer la cola de correos: ${error.message}`)

  for (const notificacion of (pendientes || []) as NotificacionPendiente[]) {
    // Reserva atómica por arrendamiento temporal (5 min) antes de enviar:
    // evita correos duplicados si dos ejecuciones del cron coinciden (F27).
    const claimAhora = new Date().toISOString()
    const leaseHasta = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const { data: reservada, error: claimError } = await supabase
      .from('notificaciones_email')
      .update({ programado_para: leaseHasta, actualizado_en: claimAhora })
      .eq('id', notificacion.id)
      .eq('estado', 'pendiente')
      .lte('programado_para', claimAhora)
      .select('id')
      .maybeSingle()

    if (claimError || !reservada) {
      continue
    }

    resultado.procesadas += 1
    try {
      if (notificacion.tipo !== 'mensaje') {
        await cerrarNotificacion(supabase, notificacion.id, 'cancelado', 'tipo_no_soportado')
        resultado.canceladas += 1
        resultado.detalle.push(`${notificacion.id}: tipo no soportado`)
        continue
      }

      const estado = await procesarAvisoMensaje(supabase, notificacion)
      if (estado === 'enviado') resultado.enviadas += 1
      if (estado === 'cancelado') resultado.canceladas += 1
      if (estado === 'reprogramado') resultado.reprogramadas += 1
      if (estado === 'error') resultado.errores += 1
      resultado.detalle.push(`${notificacion.id}: ${estado}`)
    } catch (err: any) {
      resultado.errores += 1
      const mensaje = err?.message || 'desconocido'
      console.error(`Error procesando la notificación ${notificacion.id}:`, mensaje)
      if (Number(notificacion.intentos || 0) + 1 >= MAX_INTENTOS) {
        await cerrarNotificacion(supabase, notificacion.id, 'error', `error: ${mensaje}`)
      } else {
        await reprogramarNotificacion(supabase, notificacion, 10, `error: ${mensaje}`)
      }
    }
  }

  return resultado
}

/**
 * Limpieza de avisos ya procesados. Evita que la cola crezca sin límite.
 * Devuelve cuántas filas se eliminaron.
 */
export async function limpiarNotificacionesEmailAntiguas(
  supabase: SupabaseClient,
  dias = 30,
): Promise<number> {
  const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
  const { error, count } = await supabase
    .from('notificaciones_email')
    .delete({ count: 'exact' })
    .in('estado', ['enviado', 'cancelado', 'error'])
    .lt('creado_en', corte)

  if (error) {
    console.error('No se pudo limpiar la cola de correos:', error.message)
    return 0
  }
  return count || 0
}
