import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migration = readFileSync('supabase/migrations/013_privacidad_contacto_y_ubicacion.sql', 'utf8')
const permisos = readFileSync('supabase/migrations/014_permisos_vistas_privacidad.sql', 'utf8')

// Se ejecuta la función real de la migración, no una copia de su lógica.
const funcion = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.telefono_visible_anuncio'),
  migration.indexOf('COMMENT ON FUNCTION public.telefono_visible_anuncio')
)
assert.match(funcion, /\$\$/)
const db = new PGlite()
await db.exec(funcion.replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION'))

const visible = async (valor) => (await db.query(
  `select public.telefono_visible_anuncio($1::jsonb) as v`, [valor]
)).rows[0].v

test('un anuncio que solo acepta chat no publica su teléfono', async () => {
  assert.equal(await visible('{}'), false)
  assert.equal(await visible('{"email":"a@b.co"}'), false)
})

test('el teléfono se publica solo si el anuncio eligió teléfono o WhatsApp', async () => {
  assert.equal(await visible('{"telefono":"+584121234567"}'), true)
  assert.equal(await visible('{"whatsapp":"+584121234567"}'), true)
})

test('los anuncios anteriores a la elección conservan el comportamiento', async () => {
  assert.equal(await visible(null), true)
})

test('la vista pública oculta dirección exacta y redondea coordenadas', () => {
  assert.match(migration, /CASE WHEN i\.usuario_id = auth\.uid\(\) OR public\.is_admin\(\)\s*\n\s*THEN i\.direccion_exacta END AS direccion_exacta/)
  assert.match(migration, /ELSE round\(i\.latitud, 3\)::numeric\(10,7\) END AS latitud/)
  assert.match(migration, /ELSE round\(i\.longitud, 3\)::numeric\(10,7\) END AS longitud/)
})

test('el propietario y la administración conservan los datos exactos', () => {
  const coincidencias = migration.match(/i\.usuario_id = auth\.uid\(\) OR public\.is_admin\(\)/g) || []
  assert.ok(coincidencias.length >= 4, 'dirección, coordenadas y teléfonos deben usar la misma excepción')
})

test('la función de decisión es accesible para el público y no lee tablas', () => {
  assert.match(migration, /LANGUAGE sql IMMUTABLE/)
  assert.match(permisos, /GRANT EXECUTE ON FUNCTION public\.telefono_visible_anuncio\(jsonb\) TO anon, authenticated/)
  assert.doesNotMatch(funcion, /FROM public\./)
})

test('el perfil público no depende de una RPC interna ni deja funciones expuestas', () => {
  assert.match(permisos, /DROP FUNCTION IF EXISTS public\.perfil_admite_contacto_telefonico\(uuid\)/)
  const vista = permisos.slice(
    permisos.indexOf('CREATE OR REPLACE VIEW public.vw_perfiles_publicos'),
    permisos.indexOf('COMMENT ON VIEW public.vw_perfiles_publicos')
  )
  assert.doesNotMatch(vista, /perfil_admite_contacto_telefonico/)
  assert.match(permisos, /GRANT SELECT ON public\.vw_perfiles_publicos TO anon, authenticated, service_role/)
})

test('la interfaz mantiene la misma regla que la vista', () => {
  const contacto = readFileSync('src/lib/contact-methods.ts', 'utf8')
  // `metodos_contacto` NULL = anuncio antiguo → se usa el teléfono del perfil.
  assert.match(contacto, /normalizarTelefono\(metodos\.telefono\) \?\? \(configurado \? null : telPerfil\)/)
})

test.after(() => db.close())
