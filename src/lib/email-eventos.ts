import type { SupabaseClient } from '@supabase/supabase-js'
import {
  emailCreditosAgregados,
  emailCreditosRechazados,
  emailPropiedadAprobada,
  emailPropiedadBoost,
  emailPropiedadDestacada,
  emailPropiedadRechazada,
  emailPropiedadVendida,
  emailResenaRecibida,
  emailVerificacionAprobada,
  emailVerificacionRevocada,
} from '@/lib/server-email'

/**
 * Notificaciones por correo de eventos importantes.
 *
 * Todas las funciones son "best effort": un fallo de SMTP nunca debe romper la
 * acción del usuario o del administrador que las dispara.
 */

type Destinatario = {
  id: string
  email: string
  nombre: string
}

export async function obtenerDestinatario(
  supabase: SupabaseClient,
  userId: string,
): Promise<Destinatario | null> {
  try {
    const [{ data: perfil }, { data: authData, error }] = await Promise.all([
      supabase.from('perfiles').select('nombre').eq('id', userId).maybeSingle(),
      supabase.auth.admin.getUserById(userId),
    ])

    const email = authData?.user?.email
    if (error || !email) return null

    return {
      id: userId,
      email,
      nombre: perfil?.nombre || email.split('@')[0] || 'Usuario',
    }
  } catch (error) {
    console.error('No se pudo resolver el destinatario del correo:', error)
    return null
  }
}

async function enviarSeguro(accion: () => Promise<boolean>, contexto: string) {
  try {
    await accion()
  } catch (error) {
    console.error(`Error enviando correo (${contexto}):`, error)
  }
}

export async function notificarPropiedadModerada(
  supabase: SupabaseClient,
  params: { usuarioId: string; titulo: string; slug: string | null; aprobada: boolean; motivo?: string | null },
) {
  const destinatario = await obtenerDestinatario(supabase, params.usuarioId)
  if (!destinatario) return

  await enviarSeguro(
    () =>
      params.aprobada
        ? emailPropiedadAprobada(destinatario.email, destinatario.nombre, params.titulo, params.slug || '')
        : emailPropiedadRechazada(destinatario.email, destinatario.nombre, params.titulo, params.motivo),
    `moderación de ${params.aprobada ? 'aprobación' : 'rechazo'}`,
  )
}

export async function notificarVerificacion(
  supabase: SupabaseClient,
  userId: string,
  verificada: boolean,
) {
  const destinatario = await obtenerDestinatario(supabase, userId)
  if (!destinatario) return

  await enviarSeguro(
    () =>
      verificada
        ? emailVerificacionAprobada(destinatario.email, destinatario.nombre)
        : emailVerificacionRevocada(destinatario.email, destinatario.nombre),
    `verificación ${verificada ? 'aprobada' : 'revocada'}`,
  )
}

export async function notificarCreditosAgregados(
  supabase: SupabaseClient,
  userId: string,
  cantidad: number,
) {
  const destinatario = await obtenerDestinatario(supabase, userId)
  if (!destinatario) return

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('credito_balance')
    .eq('id', userId)
    .maybeSingle()

  const balance = Number(perfil?.credito_balance ?? cantidad)

  await enviarSeguro(
    () => emailCreditosAgregados(destinatario.email, destinatario.nombre, cantidad, balance),
    'créditos agregados',
  )
}

export async function notificarCompraRechazada(
  supabase: SupabaseClient,
  userId: string,
  motivo?: string | null,
) {
  const destinatario = await obtenerDestinatario(supabase, userId)
  if (!destinatario) return

  await enviarSeguro(
    () => emailCreditosRechazados(destinatario.email, destinatario.nombre, motivo),
    'compra de créditos rechazada',
  )
}

export async function notificarResena(
  supabase: SupabaseClient,
  params: {
    evaluadoId: string
    autorId: string
    puntuacion: number
    comentario: string | null
    productoId: string
  },
) {
  const [destinatario, autor] = await Promise.all([
    obtenerDestinatario(supabase, params.evaluadoId),
    obtenerDestinatario(supabase, params.autorId),
  ])
  if (!destinatario) return

  const { data: inmueble } = await supabase
    .from('inmuebles')
    .select('titulo')
    .eq('id', params.productoId)
    .maybeSingle()

  await enviarSeguro(
    () =>
      emailResenaRecibida(
        destinatario.email,
        destinatario.nombre,
        autor?.nombre || 'Un usuario',
        params.puntuacion,
        params.comentario,
        inmueble?.titulo || null,
      ),
    'reseña recibida',
  )
}

export async function notificarPropiedadDestacada(
  supabase: SupabaseClient,
  params: { usuarioId: string; titulo: string; slug: string | null },
) {
  const destinatario = await obtenerDestinatario(supabase, params.usuarioId)
  if (!destinatario) return

  await enviarSeguro(
    () => emailPropiedadDestacada(destinatario.email, destinatario.nombre, params.titulo, params.slug || ''),
    'inmueble destacado',
  )
}

export async function notificarPropiedadBoost(
  supabase: SupabaseClient,
  params: { usuarioId: string; titulo: string; slug: string | null },
) {
  const destinatario = await obtenerDestinatario(supabase, params.usuarioId)
  if (!destinatario) return

  await enviarSeguro(
    () => emailPropiedadBoost(destinatario.email, destinatario.nombre, params.titulo, params.slug || ''),
    'impulso de inmueble',
  )
}

export async function notificarPropiedadVendida(
  supabase: SupabaseClient,
  params: { usuarioId: string; titulo: string },
) {
  const destinatario = await obtenerDestinatario(supabase, params.usuarioId)
  if (!destinatario) return

  await enviarSeguro(
    () => emailPropiedadVendida(destinatario.email, destinatario.nombre, params.titulo),
    'inmueble vendido',
  )
}
