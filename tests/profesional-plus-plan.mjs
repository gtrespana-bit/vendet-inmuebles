import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

import {
  PLAN_LIMITS,
  PLAN_NAMES,
  accountTypeForPlan,
  getPlanDisplayName,
  getPlanRank,
  isPlanUpgrade,
} from '../src/lib/plan-catalog.ts'
import { PLAN_PRICES } from '../src/lib/payment-catalog.ts'
import { canPlanIncludeRichMedia } from '../src/lib/property-media.ts'
import { canPlanUseCustomStorefront } from '../src/lib/storefront-slug.ts'

test('Profesional Plus — catálogo comercial, límites ($19,99 · 35 anuncios · 30 fotos · 12 créditos) y jerarquía de subida/bajada', () => {
  assert.deepEqual([...PLAN_NAMES], ['gratuita', 'profesional', 'profesional_plus', 'agencia'])
  assert.equal(PLAN_PRICES.profesional, 9.99)
  assert.equal(PLAN_PRICES.profesional_plus, 19.99)
  assert.equal(PLAN_PRICES.agencia, 39.99)

  assert.deepEqual(PLAN_LIMITS.profesional_plus, {
    maxAnuncios: 35,
    maxFotos: 30,
    creditosMes: 12,
  })

  // Es cuenta individual de asesor (1 usuario, sin multiagente)
  assert.equal(accountTypeForPlan('profesional_plus'), 'profesional')
  assert.equal(canPlanIncludeRichMedia('profesional_plus'), true)
  assert.equal(canPlanUseCustomStorefront('profesional_plus'), true)
  assert.equal(getPlanDisplayName('profesional_plus', 'es'), 'Profesional Plus')
  assert.equal(getPlanDisplayName('profesional_plus', 'en'), 'Professional Plus')

  // Jerarquía estricta: gratuita(0) < profesional(1) < profesional_plus(2) < agencia(3)
  assert.ok(getPlanRank('gratuita') < getPlanRank('profesional'))
  assert.ok(getPlanRank('profesional') < getPlanRank('profesional_plus'))
  assert.ok(getPlanRank('profesional_plus') < getPlanRank('agencia'))

  assert.equal(isPlanUpgrade('profesional', 'profesional_plus'), true)
  assert.equal(isPlanUpgrade('profesional_plus', 'agencia'), true)
  assert.equal(isPlanUpgrade('agencia', 'profesional_plus'), false)
  assert.equal(isPlanUpgrade('profesional_plus', 'profesional'), false)
})

test('Profesional Plus y Agencia — textos de beneficios en /planes incluyen asistencia prioritaria, asistencia telefónica e importación masiva asistida', () => {
  const planesPage = readFileSync('src/app/[locale]/planes/page.tsx', 'utf8')

  assert.match(planesPage, /id:\s*'profesional_plus'/)
  assert.match(planesPage, /\$19,99\/mes/)
  assert.match(planesPage, /35 anuncios activos/)
  assert.match(planesPage, /30 fotos por inmueble/)
  assert.match(planesPage, /12 créditos incluidos al mes/)
  assert.match(planesPage, /1 usuario individual \(sin funciones multiagente\)/)

  // Ambas tarjetas (Profesional Plus y Agencia) deben mostrar los 3 servicios solicitados
  const countMatches = (re) => (planesPage.match(re) || []).length
  assert.equal(
    countMatches(/Asistencia prioritaria/g),
    2,
    'Tanto Profesional Plus como Agencia deben incluir «Asistencia prioritaria»',
  )
  assert.equal(
    countMatches(/Solicitud de asistencia por teléfono/g),
    2,
    'Tanto Profesional Plus como Agencia deben incluir «Solicitud de asistencia por teléfono»',
  )
  assert.equal(
    countMatches(/Ayuda en la importación masiva de su cartera de inmuebles/g),
    2,
    'Tanto Profesional Plus como Agencia deben incluir «Ayuda en la importación masiva de su cartera de inmuebles»',
  )
})

test('PGlite — Migración 024 aplica cupo 35/30, 12 créditos, subidas/bajadas de pago y cero provisión de agencia en Profesional Plus', async () => {
  const db = new PGlite()
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT false;
    $$;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text,
      public boolean,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    CREATE TABLE public.rate_limit (
      key text,
      identifier text,
      ip text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE public.perfiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text,
      email text,
      telefono text,
      estado text,
      ciudad text,
      tipo_cuenta text DEFAULT 'particular' CHECK (tipo_cuenta IN ('particular', 'profesional', 'agencia')),
      empresa_nombre text,
      licencia_corredor text,
      credito_balance integer NOT NULL DEFAULT 0,
      creado_en timestamptz DEFAULT now()
    );

    CREATE TABLE public.agencias (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL,
      owner_id uuid NOT NULL UNIQUE REFERENCES public.perfiles(id),
      creado_en timestamptz DEFAULT now(),
      actualizado_en timestamptz DEFAULT now()
    );

    CREATE TABLE public.agencia_miembros (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      agencia_id uuid NOT NULL REFERENCES public.agencias(id),
      user_id uuid NOT NULL REFERENCES public.perfiles(id),
      rol text NOT NULL DEFAULT 'admin',
      estado text NOT NULL DEFAULT 'activo',
      UNIQUE (agencia_id, user_id)
    );

    CREATE TABLE public.suscripciones (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.perfiles(id),
      plan text NOT NULL,
      estado text NOT NULL,
      inicio timestamptz NOT NULL DEFAULT now(),
      fin timestamptz,
      trial_ends_at timestamptz,
      creditos_incluidos integer NOT NULL DEFAULT 0,
      creditos_usados_mes integer NOT NULL DEFAULT 0,
      proxima_renovacion_creditos timestamptz,
      cambio_gratuita boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.inmuebles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES public.perfiles(id),
      titulo text NOT NULL DEFAULT 'Inmueble',
      activo boolean NOT NULL DEFAULT true
    );

    CREATE TABLE public.inmueble_imagenes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      inmueble_id uuid NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
      orden integer NOT NULL DEFAULT 0
    );

    CREATE TABLE public.transacciones_creditos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.perfiles(id),
      tipo text,
      monto integer,
      precio_usd numeric,
      metodo_pago text,
      estado text,
      motivo_registro text
    );
  `)

  await db.exec(readFileSync('supabase/migrations/010_ordenes_pago_verificacion.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/011_cambio_plan_durante_prueba.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/012_limites_publicacion_en_bd.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/024_plan_profesional_plus.sql', 'utf8'))

  const adminId = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Admin') RETURNING id")).rows[0].id
  const soloAgent = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Asesor Top') RETURNING id")).rows[0].id

  // 1) Asignar Profesional Plus desde admin: otorga 12 créditos, tipo_cuenta='profesional' y NO crea agencia
  await db.query(
    "SELECT admin_gestionar_plan($1, $2, 'asignar', 'profesional_plus', 'activa', 30, NULL, 'Bienvenida')",
    [soloAgent, adminId],
  )
  const subRow = (
    await db.query("SELECT plan, estado, creditos_incluidos FROM suscripciones WHERE user_id = $1 AND estado = 'activa'", [soloAgent])
  ).rows[0]
  assert.equal(subRow.plan, 'profesional_plus')
  assert.equal(subRow.creditos_incluidos, 12)

  const perfRow = (await db.query('SELECT tipo_cuenta FROM perfiles WHERE id = $1', [soloAgent])).rows[0]
  assert.equal(perfRow.tipo_cuenta, 'profesional')

  const agCount = (await db.query('SELECT count(*)::int AS c FROM agencias WHERE owner_id = $1', [soloAgent])).rows[0].c
  assert.equal(agCount, 0, 'Profesional Plus NO debe aprovisionar entidad en `agencias`')

  // 2) Permite exactamente 35 inmuebles activos y bloquea el #36; permite 30 fotos y bloquea la #31
  let firstPropId = null
  for (let i = 1; i <= 35; i++) {
    const r = await db.query('INSERT INTO inmuebles (usuario_id, titulo) VALUES ($1, $2) RETURNING id', [
      soloAgent,
      `Captación #${i}`,
    ])
    if (i === 1) firstPropId = r.rows[0].id
  }
  await assert.rejects(
    db.query('INSERT INTO inmuebles (usuario_id, titulo) VALUES ($1, $2)', [soloAgent, 'Captación #36']),
    /Límite de publicaciones alcanzado para el plan profesional_plus/,
  )

  for (let i = 1; i <= 30; i++) {
    await db.query('INSERT INTO inmueble_imagenes (inmueble_id, orden) VALUES ($1, $2)', [firstPropId, i])
  }
  await assert.rejects(
    db.query('INSERT INTO inmueble_imagenes (inmueble_id, orden) VALUES ($1, 31)', [firstPropId]),
    /Límite de fotos alcanzado para el plan profesional_plus/,
  )

  // 3) Orden de pago: subida de `profesional` -> `profesional_plus` se activa al instante (`inicio <= now()`)
  const upUser = (await db.query("INSERT INTO perfiles (nombre, tipo_cuenta) VALUES ('Corredor', 'profesional') RETURNING id")).rows[0].id
  await db.query(
    "INSERT INTO suscripciones (user_id, plan, estado, inicio, fin, creditos_incluidos) VALUES ($1, 'profesional', 'activa', now() - interval '10 days', now() + interval '20 days', 5)",
    [upUser],
  )
  const ordUp = (
    await db.query(
      "INSERT INTO ordenes_pago (user_id, concepto, creditos, precio_usd, monto, metodo, moneda, destinatario) VALUES ($1, 'profesional_plus', 0, 19.99, 19.99, 'binance', 'USDT', '{}'::jsonb) RETURNING id",
      [upUser],
    )
  ).rows[0].id
  await db.query('SELECT otorgar_orden_pago($1)', [ordUp])

  const activeUp = (
    await db.query("SELECT plan, creditos_incluidos, inicio <= now() AS inmediata FROM suscripciones WHERE user_id = $1 AND estado = 'activa'", [upUser])
  ).rows[0]
  assert.equal(activeUp.plan, 'profesional_plus')
  assert.equal(activeUp.creditos_incluidos, 12)
  assert.equal(activeUp.inmediata, true)

  // 4) Orden de pago: bajada programada `agencia` -> `profesional_plus` inicia al vencer el período actual
  const agUser = (await db.query("INSERT INTO perfiles (nombre, tipo_cuenta) VALUES ('Agencia X', 'agencia') RETURNING id")).rows[0].id
  await db.query(
    "INSERT INTO suscripciones (user_id, plan, estado, inicio, fin, creditos_incluidos) VALUES ($1, 'agencia', 'activa', now() - interval '5 days', now() + interval '25 days', 20)",
    [agUser],
  )
  const ordDown = (
    await db.query(
      "INSERT INTO ordenes_pago (user_id, concepto, creditos, precio_usd, monto, metodo, moneda, destinatario) VALUES ($1, 'profesional_plus', 0, 19.99, 19.99, 'binance', 'USDT', '{}'::jsonb) RETURNING id",
      [agUser],
    )
  ).rows[0].id
  await db.query('SELECT otorgar_orden_pago($1)', [ordDown])

  const subsAg = (
    await db.query("SELECT plan, inicio > now() AS futura, creditos_incluidos FROM suscripciones WHERE user_id = $1 AND estado = 'activa' ORDER BY inicio ASC", [agUser])
  ).rows
  assert.equal(subsAg.length, 2)
  assert.equal(subsAg[0].plan, 'agencia')
  assert.equal(subsAg[0].futura, false)
  assert.equal(subsAg[1].plan, 'profesional_plus')
  assert.equal(subsAg[1].futura, true)
  assert.equal(subsAg[1].creditos_incluidos, 12)
})
