import type { SupabaseClient } from '@supabase/supabase-js'
import { type AgencyRole, type EffectiveAgencyContext } from './agency'

export interface UserAgencyResolution {
  agency: EffectiveAgencyContext | null
  activeMemberIds: Set<string>
}

async function hasActiveAgencyPlan(supabaseAdmin: SupabaseClient, ownerId: string): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const { data: susData } = await supabaseAdmin
    .from('suscripciones')
    .select('plan, estado, trial_ends_at, fin')
    .eq('user_id', ownerId)
    .in('estado', ['activa', 'trial'])
    .lte('inicio', nowIso)
    .or(`fin.is.null,fin.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!susData || susData.plan !== 'agencia') return false
  if (susData.estado === 'activa') return true
  if (susData.estado === 'trial' && susData.trial_ends_at && new Date(susData.trial_ends_at) > new Date()) {
    return true
  }
  return false
}

/**
 * Resuelve la agencia efectiva de un usuario (como dueño o como miembro activo) y
 * aprovisiona automáticamente la organización si la cuenta tiene plan `agencia`
 * o `tipo_cuenta = 'agencia'` y aún no tenía fila en `public.agencias`.
 */
export async function getUserAgencyContext(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<UserAgencyResolution> {
  // 1. Verificar si ya es miembro activo de una agencia
  const { data: membership } = await supabaseAdmin
    .from('agencia_miembros')
    .select('agencia_id, rol, estado')
    .eq('user_id', userId)
    .eq('estado', 'activo')
    .maybeSingle()

  let agencyRow: {
    id: string
    nombre: string
    descripcion: string | null
    logo_url: string | null
    owner_id: string
  } | null = null
  let memberRole: AgencyRole = 'agente'

  if (membership?.agencia_id) {
    const { data: ag } = await supabaseAdmin
      .from('agencias')
      .select('id, nombre, descripcion, logo_url, owner_id')
      .eq('id', membership.agencia_id)
      .maybeSingle()
    if (ag) {
      agencyRow = ag
      memberRole = ag.owner_id === userId || membership.rol === 'admin' ? 'admin' : 'agente'
    }
  }

  // 2. Verificar si es dueño directo en `agencias` (por si faltaba la fila en `agencia_miembros`)
  if (!agencyRow) {
    const { data: owned } = await supabaseAdmin
      .from('agencias')
      .select('id, nombre, descripcion, logo_url, owner_id')
      .eq('owner_id', userId)
      .maybeSingle()
    if (owned) {
      agencyRow = owned
      memberRole = 'admin'
      await supabaseAdmin.from('agencia_miembros').upsert(
        { agencia_id: owned.id, user_id: userId, rol: 'admin', estado: 'activo' },
        { onConflict: 'agencia_id,user_id' }
      )
    }
  }

  // 3. Auto-provisión si el usuario contrató o activó el plan Agencia
  if (!agencyRow) {
    const [{ data: profile }, planActivo] = await Promise.all([
      supabaseAdmin
        .from('perfiles')
        .select('id, nombre, empresa_nombre, descripcion_agente, logo_url, foto_perfil_url, tipo_cuenta')
        .eq('id', userId)
        .maybeSingle(),
      hasActiveAgencyPlan(supabaseAdmin, userId),
    ])

    if (profile && (planActivo || profile.tipo_cuenta === 'agencia')) {
      const nombreAgencia =
        (profile.empresa_nombre || '').trim() ||
        (profile.nombre || '').trim() ||
        'Agencia Inmobiliaria'

      const { data: created } = await supabaseAdmin
        .from('agencias')
        .upsert(
          {
            owner_id: userId,
            nombre: nombreAgencia,
            descripcion: profile.descripcion_agente || null,
            logo_url: profile.logo_url || profile.foto_perfil_url || null,
          },
          { onConflict: 'owner_id' }
        )
        .select('id, nombre, descripcion, logo_url, owner_id')
        .maybeSingle()

      if (created) {
        agencyRow = created
        memberRole = 'admin'
        await supabaseAdmin.from('agencia_miembros').upsert(
          { agencia_id: created.id, user_id: userId, rol: 'admin', estado: 'activo' },
          { onConflict: 'agencia_id,user_id' }
        )
        await supabaseAdmin
          .from('inmuebles')
          .update({ agencia_id: created.id, agente_asignado_id: userId })
          .eq('usuario_id', userId)
          .is('agencia_id', null)
      }
    }
  }

  if (!agencyRow) {
    return { agency: null, activeMemberIds: new Set() }
  }

  const [agenciaPlanActivo, { data: membersRows }] = await Promise.all([
    hasActiveAgencyPlan(supabaseAdmin, agencyRow.owner_id),
    supabaseAdmin
      .from('agencia_miembros')
      .select('user_id')
      .eq('agencia_id', agencyRow.id)
      .eq('estado', 'activo'),
  ])

  const activeMemberIds = new Set<string>([
    agencyRow.owner_id,
    ...(membersRows || []).map((m: { user_id: string }) => m.user_id),
  ])

  const isOwner = agencyRow.owner_id === userId

  return {
    agency: {
      id: agencyRow.id,
      nombre: agencyRow.nombre,
      descripcion: agencyRow.descripcion,
      logo_url: agencyRow.logo_url,
      owner_id: agencyRow.owner_id,
      rol: isOwner ? 'admin' : memberRole,
      isOwner,
      isAdmin: isOwner || memberRole === 'admin',
      agenciaPlanActivo,
    },
    activeMemberIds,
  }
}

/**
 * Comprueba si `userId` puede editar/gestionar un inmueble concreto (como titular
 * directo o como miembro autorizado de la agencia propietaria).
 */
export async function canUserManageProperty(
  supabaseAdmin: SupabaseClient,
  userId: string,
  property: { usuario_id: string; agencia_id?: string | null; agente_asignado_id?: string | null }
): Promise<boolean> {
  if (property.usuario_id === userId) return true
  if (!property.agencia_id) return false

  const { agency } = await getUserAgencyContext(supabaseAdmin, userId)
  if (!agency || agency.id !== property.agencia_id) return false
  return agency.isOwner || agency.isAdmin || property.agente_asignado_id === userId
}
