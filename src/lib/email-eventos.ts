import type { SupabaseClient } from '@supabase/supabase-js'
import {
  emailCreditosAgregados,
  emailCreditosRechazados,
  emailCreditosRegalados,
  emailPlanAsignadoAdmin,
  emailPropiedadAprobada,
  emailPropiedadBoost,
  emailPropiedadDestacada,
  emailPropiedadRechazada,
  emailPropiedadVendida,
  emailResenaRecibida,
  emailTiempoExtraPlan,
  emailVerificacionAprobada,
  emailVerificacionRechazada,
  emailVerificacionRevocada,
} from './server-email'

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
  empresaNombre: string | null
}

export async function obtenerDestinatario(
  supabase: SupabaseClient,
  userId: string,
): Promise<Destinatario | null> {
  try {
    const [{ data: perfil }, { data: agencia }, { data: authData, error }] = await Promise.all([
      supabase.from('perfiles').select('nombre, empresa_nombre').eq('id', userId).maybeSingle(),
      supabase.from('agencias').select('nombre').eq('owner_id', userId).maybeSingle(),
      supabase.auth.admin.getUserById(userId),
    ])

    const email = authData?.user?.email
    if (error || !email) return null

    const empresa =
      (perfil?.empresa_nombre && perfil.empresa_nombre.trim()) ||
      (agencia?.nombre && agencia.nombre.trim()) ||
      null

    return {
      id: userId,
      email,
      nombre: perfil?.nombre?.trim() || email.split('@')[0] || 'Usuario',
      empresaNombre: empresa,
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
        ? emailVerificacionAprobada(destinatario.email, destinatario.nombre, destinatario.empresaNombre)
        : emailVerificacionRevocada(destinatario.email, destinatario.nombre),
    `verificación ${verificada ? 'aprobada' : 'revocada'}`,
  )
}

export async function notificarVerificacionRechazada(
  supabase: SupabaseClient,
  userId: string,
  motivo?: string | null,
) {
  const destinatario = await obtenerDestinatario(supabase, userId)
  if (!destinatario) return

  await enviarSeguro(
    () => emailVerificacionRechazada(destinatario.email, destinatario.nombre, motivo),
    'verificación rechazada',
  )
}

export interface OpcionesNotificarCreditos {
  esRegaloAdmin?: boolean
  motivo?: string | null
  balanceTotal?: number
}

export async function notificarCreditosAgregados(
  supabase: SupabaseClient,
  userId: string,
  cantidad: number,
  opciones?: OpcionesNotificarCreditos,
) {
  const destinatario = await obtenerDestinatario(supabase, userId)
  if (!destinatario) return

  let balance = opciones?.balanceTotal
  if (typeof balance !== 'number' || !Number.isFinite(balance)) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('credito_balance')
      .eq('id', userId)
      .maybeSingle()
    balance = Number(perfil?.credito_balance ?? cantidad)
  }

  if (opciones?.esRegaloAdmin) {
    await enviarSeguro(
      () => emailCreditosRegalados(destinatario.email, destinatario.nombre, cantidad, balance!, opciones.motivo),
      'créditos regalados por admin',
    )
    return
  }

  await enviarSeguro(
    () => emailCreditosAgregados(destinatario.email, destinatario.nombre, cantidad, balance!),
    'créditos agregados',
  )
}

export async function notificarCreditosRegalados(
  supabase: SupabaseClient,
  params: { userId: string; cantidad: number; balanceTotal?: number; motivo?: string | null },
) {
  await notificarCreditosAgregados(supabase, params.userId, params.cantidad, {
    esRegaloAdmin: true,
    motivo: params.motivo,
    balanceTotal: params.balanceTotal,
  })
}

export async function notificarCambioPlanAdmin(
  supabase: SupabaseClient,
  params: {
    userId: string
    operacion: 'extender' | 'asignar' | 'cancelar'
    plan: 'agencia' | 'profesional' | 'gratuita'
    estado: 'activa' | 'trial' | 'cancelada'
    dias?: number | null
    fechaVencimiento?: string | null
    creditosIncluidos?: number | null
    motivo?: string | null
  },
) {
  const destinatario = await obtenerDestinatario(supabase, params.userId)
  if (!destinatario) return

  if (
    params.operacion === 'extender' &&
    (params.plan === 'agencia' || params.plan === 'profesional') &&
    (params.estado === 'activa' || params.estado === 'trial')
  ) {
    await enviarSeguro(
      () =>
        emailTiempoExtraPlan({
          email: destinatario.email,
          nombre: destinatario.nombre,
          empresaNombre: destinatario.empresaNombre,
          plan: params.plan as 'agencia' | 'profesional',
          estado: params.estado as 'activa' | 'trial',
          diasAgregados: Math.max(1, Number(params.dias) || 30),
          fechaVencimiento: params.fechaVencimiento,
          creditosIncluidos: params.creditosIncluidos,
          motivo: params.motivo,
        }),
      'tiempo extra de plan',
    )
    return
  }

  await enviarSeguro(
    () =>
      emailPlanAsignadoAdmin({
        email: destinatario.email,
        nombre: destinatario.nombre,
        empresaNombre: destinatario.empresaNombre,
        plan: params.plan,
        estado: params.estado,
        dias: params.dias,
        fechaVencimiento: params.fechaVencimiento,
        creditosIncluidos: params.creditosIncluidos,
        motivo: params.motivo,
      }),
    `cambio de plan (${params.operacion})`,
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
