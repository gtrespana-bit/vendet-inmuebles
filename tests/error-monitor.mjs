import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { construirReporteErrorSanitizado } from '../src/lib/error-monitor.ts'
import { diagnosticarCausaProbable, sanitizarUrlRuta } from '../src/lib/error-diagnostics.ts'

const db = new PGlite()

await db.exec(`
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE TABLE public.perfiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text
);
`)

await db.exec(readFileSync('supabase/migrations/020_monitor_errores_interno.sql', 'utf8'))

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]

test('sanitiza PII, tokens, query params sensibles y descarta ruidos benignos', () => {
  // Ruido ignorable (extensiones, ResizeObserver, redirecciones Next.js)
  assert.equal(
    construirReporteErrorSanitizado({ nombre: 'Error', mensaje: 'ResizeObserver loop completed with undelivered notifications' }),
    null,
  )
  assert.equal(
    construirReporteErrorSanitizado({ nombre: 'AbortError', mensaje: 'The user aborted a request' }),
    null,
  )
  assert.equal(
    construirReporteErrorSanitizado({ nombre: 'Error', mensaje: 'NEXT_REDIRECT' }),
    null,
  )
  assert.equal(
    construirReporteErrorSanitizado({
      nombre: 'TypeError',
      mensaje: 'Cannot read property',
      stack: 'TypeError at chrome-extension://abcdef/content.js:10:2',
    }),
    null,
  )

  // Sanitización de URLs con tokens/códigos de confirmación
  const rutaLimpia = sanitizarUrlRuta('/es/confirm?token_hash=secreto123&type=signup#access_token=jwt999')
  assert.doesNotMatch(rutaLimpia, /secreto123/)
  assert.doesNotMatch(rutaLimpia, /jwt999/)
  assert.match(rutaLimpia, /token_hash=%5BREDACTED%5D|token_hash=\[REDACTED\]/)

  // Sanitización de PII en mensaje y stack
  const reporte = construirReporteErrorSanitizado({
    origen: 'api',
    nombre: 'PostgresError',
    mensaje: 'Fallo para pedro@correo.com cédula V-20794917 tel +58 412-644-3099 con Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.firma1234567890',
    codigoError: '42501',
    ruta: '/es/publicar?token=secretoABC',
    endpoint: 'POST /api/publicar?access_token=xyz',
    accionPrevia: 'Click en botón "Publicar" por pedro@correo.com',
    stack: 'PostgresError: permission denied\n    at /app/api/publicar?secret=clave999:42:10',
    statusHttp: 500,
  })

  assert.ok(reporte)
  assert.match(reporte.codigoRef, /^ERR-[0-9A-F]{6}$/)
  assert.doesNotMatch(reporte.mensaje, /pedro@correo\.com|20794917|644-3099|eyJhbGci/)
  assert.doesNotMatch(reporte.ruta, /secretoABC/)
  assert.doesNotMatch(reporte.endpoint || '', /xyz/)
  assert.doesNotMatch(reporte.stack || '', /clave999/)
  assert.doesNotMatch(reporte.accionPrevia || '', /pedro@correo\.com/)

  const diag = diagnosticarCausaProbable({
    origen: reporte.origen,
    nombre: reporte.nombre,
    mensaje: reporte.mensaje,
    codigo_error: reporte.codigoError,
  })
  assert.match(diag.titulo, /RLS/i)
})

test('agrupa ocurrencias por huella en 1 sola fila, limita muestras a 5, detecta regresiones y respeta ignorados', async () => {
  const { id: u1 } = await one("INSERT INTO perfiles (nombre) VALUES ('María') RETURNING id")
  const { id: u2 } = await one("INSERT INTO perfiles (nombre) VALUES ('Carlos') RETURNING id")

  // Dos URLs distintas de ficha con el mismo bug deben producir la MISMA huella
  const rep1 = construirReporteErrorSanitizado({
    origen: 'cliente',
    nombre: 'TypeError',
    mensaje: 'Cannot read properties of undefined (reading precio)',
    ruta: '/es/inmueble/11111111-2222-3333-4444-555555555555',
  })
  const rep2 = construirReporteErrorSanitizado({
    origen: 'cliente',
    nombre: 'TypeError',
    mensaje: 'Cannot read properties of undefined (reading precio)',
    ruta: '/en/inmueble/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  })
  assert.equal(rep1.huella, rep2.huella)

  // Insertamos 7 ocurrencias seguidas -> debe existir 1 sola fila con ocurrencias=7 y máximo 5 muestras
  for (let i = 0; i < 7; i++) {
    const uid = i % 2 === 0 ? u1 : u2
    await one(
      `SELECT public.registrar_error_sistema($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) AS r`,
      [
        rep1.huella,
        rep1.codigoRef,
        rep1.origen,
        rep1.severidad,
        rep1.nombre,
        rep1.mensaje,
        rep1.codigoError,
        `/es/inmueble/paso-${i}`,
        null,
        `Click #${i}`,
        rep1.stack,
        uid,
        'movil',
        'Safari',
        'VE',
        JSON.stringify({ fecha: new Date().toISOString(), ruta: `/es/inmueble/paso-${i}` }),
      ],
    )
  }

  const fila = await one('SELECT * FROM public.errores_sistema WHERE huella = $1', [rep1.huella])
  assert.equal(fila.ocurrencias, 7)
  assert.equal(fila.estado, 'nuevo')
  assert.equal(fila.usuarios_afectados.length, 2)
  assert.equal(fila.muestras.length, 5)
  assert.equal(fila.muestras[0].ruta, '/es/inmueble/paso-6')

  // Si el admin lo marca como resuelto y vuelve a ocurrir -> pasa automáticamente a 'reabierto'
  await db.query("UPDATE public.errores_sistema SET estado = 'resuelto', resuelto_en = now() WHERE id = $1", [fila.id])
  const reg = (await one(
    `SELECT public.registrar_error_sistema($1,$2,$3,$4,$5,$6,NULL,'/es/inmueble/nuevo',NULL,NULL,NULL,$7,'movil','Safari','VE',NULL) AS r`,
    [rep1.huella, rep1.codigoRef, rep1.origen, rep1.severidad, rep1.nombre, rep1.mensaje, u1],
  )).r
  assert.equal(reg.estado, 'reabierto')
  assert.equal(reg.ocurrencias, 8)

  // Si el admin lo marca como 'ignorado' y vuelve a ocurrir -> permanece 'ignorado' sin reabrirse
  await db.query("UPDATE public.errores_sistema SET estado = 'ignorado' WHERE id = $1", [fila.id])
  const ign = (await one(
    `SELECT public.registrar_error_sistema($1,$2,$3,$4,$5,$6,NULL,'/es/inmueble/otro',NULL,NULL,NULL,$7,'movil','Safari','VE',NULL) AS r`,
    [rep1.huella, rep1.codigoRef, rep1.origen, rep1.severidad, rep1.nombre, rep1.mensaje, u1],
  )).r
  assert.equal(ign.estado, 'ignorado')

  // Limpieza de antiguos borra resueltos/ignorados caducados
  await db.query("UPDATE public.errores_sistema SET ultima_vez_en = now() - interval '45 days' WHERE id = $1", [fila.id])
  const borrados = (await one('SELECT public.limpiar_errores_antiguos(30) AS n')).n
  assert.equal(Number(borrados), 1)
})

test('aislamiento de seguridad: ni anon ni authenticated tienen acceso a errores_sistema y no se usa Sentry', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await one("SELECT has_table_privilege($1, 'public.errores_sistema', 'SELECT') AS ok", [role])).ok, false)
    assert.equal((await one("SELECT has_table_privilege($1, 'public.errores_sistema', 'INSERT') AS ok", [role])).ok, false)
    assert.equal(
      (await one(
        "SELECT has_function_privilege($1, 'public.registrar_error_sistema(text,text,text,text,text,text,text,text,text,text,text,uuid,text,text,text,jsonb)', 'EXECUTE') AS ok",
        [role],
      )).ok,
      false,
    )
    assert.equal(
      (await one("SELECT has_function_privilege($1, 'public.limpiar_errores_antiguos(integer)', 'EXECUTE') AS ok", [role])).ok,
      false,
    )
  }

  for (const archivo of [
    'src/instrumentation.ts',
    'src/instrumentation-client.ts',
    'src/app/[locale]/error.tsx',
    'src/app/[locale]/global-error.tsx',
  ]) {
    assert.doesNotMatch(readFileSync(archivo, 'utf8'), /@sentry\/nextjs/, archivo)
  }
})

test.after(async () => {
  await db.close()
})
