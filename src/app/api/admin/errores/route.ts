import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isValidUUID } from '@/lib/validation'
import { registrarErrorEnBase } from '@/lib/error-monitor-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ESTADOS_VALIDOS = new Set(['nuevo', 'en_revision', 'resuelto', 'ignorado', 'reabierto'])
const ORIGENES_VALIDOS = new Set(['cliente', 'servidor', 'api', 'red', 'react_boundary'])
const SEVERIDADES_VALIDAS = new Set(['critico', 'error', 'aviso'])

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const params = req.nextUrl.searchParams
    const estado = (params.get('estado') || 'activos').trim()
    const origen = (params.get('origen') || 'todos').trim()
    const severidad = (params.get('severidad') || 'todas').trim()
    const q = (params.get('q') || '').trim().slice(0, 120)
    const dias = Math.min(365, Math.max(1, Number.parseInt(params.get('dias') || '30', 10) || 30))
    const limit = Math.min(150, Math.max(1, Number.parseInt(params.get('limit') || '60', 10) || 60))

    // Caso ligero para badge de pestaña en Admin (`?soloConteo=1`)
    if (params.get('soloConteo') === '1') {
      const { count } = await auth.supabaseAdmin
        .from('errores_sistema')
        .select('id', { count: 'exact', head: true })
        .in('estado', ['nuevo', 'reabierto'])

      return NextResponse.json({ ok: true, activos: count || 0 }, { headers: NO_STORE })
    }

    const desdeIso = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
    const hace24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    let query = auth.supabaseAdmin
      .from('errores_sistema')
      .select('*')
      .gte('ultima_vez_en', desdeIso)
      .order('ultima_vez_en', { ascending: false })
      .limit(limit)

    if (estado === 'activos') {
      query = query.in('estado', ['nuevo', 'reabierto'])
    } else if (ESTADOS_VALIDOS.has(estado)) {
      query = query.eq('estado', estado)
    }

    if (ORIGENES_VALIDOS.has(origen)) {
      query = query.eq('origen', origen)
    }

    if (SEVERIDADES_VALIDAS.has(severidad)) {
      query = query.eq('severidad', severidad)
    }

    if (q) {
      const safe = q.replace(/[%_,()]/g, ' ').trim()
      if (safe) {
        query = query.or(
          `codigo_ref.ilike.%${safe}%,nombre.ilike.%${safe}%,mensaje.ilike.%${safe}%,ruta.ilike.%${safe}%,endpoint.ilike.%${safe}%,codigo_error.ilike.%${safe}%`,
        )
      }
    }

    const [
      { data: errores, error },
      { count: activosCount },
      { count: resueltosCount },
      { data: recientes24h },
    ] = await Promise.all([
      query,
      auth.supabaseAdmin
        .from('errores_sistema')
        .select('id', { count: 'exact', head: true })
        .in('estado', ['nuevo', 'reabierto']),
      auth.supabaseAdmin
        .from('errores_sistema')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'resuelto'),
      auth.supabaseAdmin
        .from('errores_sistema')
        .select('ocurrencias, usuarios_afectados')
        .gte('ultima_vez_en', hace24hIso)
        .limit(500),
    ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    }

    // Enriquecer con perfiles de los últimos usuarios afectados
    const userIds = Array.from(
      new Set((errores || []).map((e: any) => e.ultimo_user_id).filter(Boolean)),
    ) as string[]

    const perfilesMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: perfiles } = await auth.supabaseAdmin
        .from('perfiles')
        .select('id, nombre, email, tipo_cuenta, empresa_nombre')
        .in('id', userIds)
      ;(perfiles || []).forEach((p: any) => {
        perfilesMap[p.id] = p
      })
    }

    let eventos24h = 0
    const usuarios24hSet = new Set<string>()
    ;(recientes24h || []).forEach((r: any) => {
      eventos24h += Number(r.ocurrencias || 1)
      if (Array.isArray(r.usuarios_afectados)) {
        r.usuarios_afectados.forEach((uid: string) => {
          if (uid) usuarios24hSet.add(uid)
        })
      }
    })

    const lista = (errores || []).map((e: any) => ({
      ...e,
      ultimo_usuario: e.ultimo_user_id ? perfilesMap[e.ultimo_user_id] || null : null,
    }))

    return NextResponse.json(
      {
        ok: true,
        errores: lista,
        kpis: {
          activos: activosCount || 0,
          eventos24h,
          usuarios24h: usuarios24hSet.size,
          resueltos: resueltosCount || 0,
        },
      },
      { headers: NO_STORE },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error consultando monitor' }, { status: 500, headers: NO_STORE })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const { id, estado, notaAdmin, resolverTodosActivos } = body

    if (resolverTodosActivos === true) {
      const { error } = await auth.supabaseAdmin
        .from('errores_sistema')
        .update({ estado: 'resuelto', resuelto_en: new Date().toISOString() })
        .in('estado', ['nuevo', 'reabierto'])

      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
      return NextResponse.json({ ok: true }, { headers: NO_STORE })
    }

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400, headers: NO_STORE })
    }

    const cambios: Record<string, any> = {}
    if (estado !== undefined) {
      if (!ESTADOS_VALIDOS.has(estado)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400, headers: NO_STORE })
      }
      cambios.estado = estado
      cambios.resuelto_en = estado === 'resuelto' ? new Date().toISOString() : null
    }

    if (notaAdmin !== undefined) {
      cambios.nota_admin = typeof notaAdmin === 'string' && notaAdmin.trim()
        ? notaAdmin.trim().slice(0, 1000)
        : null
    }

    const { error } = await auth.supabaseAdmin
      .from('errores_sistema')
      .update(cambios)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error actualizando registro' }, { status: 500, headers: NO_STORE })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    if (body?.accion !== 'prueba') {
      return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400, headers: NO_STORE })
    }

    const res = await registrarErrorEnBase({
      origen: 'servidor',
      severidad: 'aviso',
      nombre: 'PruebaDetectorInterno',
      mensaje: 'Evento de verificación manual disparado desde el Panel Admin para comprobar la captura y agrupación.',
      codigoError: 'TEST_OK',
      ruta: '/admin?tab=errores',
      endpoint: 'POST /api/admin/errores',
      accionPrevia: 'Click en botón "Probar detector"',
      stack: 'PruebaDetectorInterno: Verificación controlada\n    at POST (/api/admin/errores)',
      userId: auth.user.id,
      dispositivo: 'escritorio',
      navegador: 'Admin',
      pais: req.headers.get('x-vercel-ip-country') || 'VE',
      statusHttp: 200,
    })

    return NextResponse.json({ ok: res.ok, codigoRef: res.codigoRef || null }, { headers: NO_STORE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error ejecutando prueba' }, { status: 500, headers: NO_STORE })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const id = req.nextUrl.searchParams.get('id')
    const limpiarDias = req.nextUrl.searchParams.get('limpiarAntiguosDias')

    if (limpiarDias) {
      const dias = Math.min(365, Math.max(1, Number.parseInt(limpiarDias, 10) || 30))
      const { data, error } = await auth.supabaseAdmin.rpc('limpiar_errores_antiguos', { p_dias: dias })
      if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
      return NextResponse.json({ ok: true, eliminados: Number(data || 0) }, { headers: NO_STORE })
    }

    if (!isValidUUID(id || '')) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400, headers: NO_STORE })
    }

    const { error } = await auth.supabaseAdmin
      .from('errores_sistema')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error eliminando registro' }, { status: 500, headers: NO_STORE })
  }
}
