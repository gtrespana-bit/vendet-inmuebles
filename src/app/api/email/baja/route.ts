import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { crearTokenPreferencias, verificarTokenPreferencias } from '@/lib/email-preferences'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function htmlPage(title: string, message: string, extra = ''): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} · Venezuela Inmuebles</title>
</head>
<body style="margin:0;background:#F4F1E9;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1E293B">
  <main style="max-width:520px;margin:0 auto;padding:56px 20px">
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:36px 32px">
      <p style="margin:0 0 6px;color:#B08542;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Venezuela Inmuebles</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,Cambria,serif;font-size:26px;font-weight:400;color:#16294B">${title}</h1>
      <p style="margin:0;font-size:15px;line-height:1.65">${message}</p>
      ${extra}
    </div>
    <p style="text-align:center;margin:20px 0 0;color:#64748B;font-size:12px">
      <a href="https://venezuela-inmuebles.online" style="color:#64748B">venezuela-inmuebles.online</a>
    </p>
  </main>
</body>
</html>`
}

function htmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

async function actualizarPreferencia(userId: string, activar: boolean) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ email_notificaciones: activar })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const reactivar = request.nextUrl.searchParams.get('accion') === 'reactivar'
  const userId = verificarTokenPreferencias(token)

  if (!userId) {
    return htmlResponse(
      htmlPage(
        'Enlace no válido',
        'Este enlace ya no es utilizable. Puedes gestionar tus avisos desde tu perfil o escribiéndonos a contacto@venezuela-inmuebles.online.',
      ),
      400,
    )
  }

  try {
    await actualizarPreferencia(userId, reactivar)
  } catch {
    return htmlResponse(
      htmlPage(
        'No pudimos guardar tu preferencia',
        'Inténtalo de nuevo en unos minutos o escríbenos a contacto@venezuela-inmuebles.online.',
      ),
      500,
    )
  }

  const nuevoToken = crearTokenPreferencias(userId)
  const enlaceContrario = nuevoToken
    ? `/api/email/baja?token=${encodeURIComponent(nuevoToken)}${reactivar ? '' : '&accion=reactivar'}`
    : null

  if (reactivar) {
    return htmlResponse(
      htmlPage(
        'Avisos reactivados',
        'Volverás a recibir un correo cuando tengas mensajes sin leer. Los avisos importantes sobre tu cuenta y tus anuncios se envían siempre.',
        enlaceContrario
          ? `<p style="margin:20px 0 0"><a href="${enlaceContrario}" style="color:#16294B">Desactivar de nuevo</a></p>`
          : '',
      ),
    )
  }

  return htmlResponse(
    htmlPage(
      'Avisos desactivados',
      'Ya no te enviaremos correos por mensajes de chat sin leer. Los avisos importantes sobre tu cuenta, pagos y anuncios se seguirán enviando.',
      enlaceContrario
        ? `<p style="margin:20px 0 0"><a href="${enlaceContrario}" style="color:#16294B">Reactivar avisos</a></p>`
        : '',
    ),
  )
}

/** Baja en un clic (cabecera List-Unsubscribe-Post). */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const userId = verificarTokenPreferencias(token)
  if (!userId) return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 400 })

  try {
    await actualizarPreferencia(userId, false)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
