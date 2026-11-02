import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

import {
  aggregateAgentPerformance,
  buildFunnelCsv,
  computeMedianFirstResponseMinutes,
  computePortfolioListingFunnels,
  computeReviewDistribution,
} from '../src/lib/listing-funnel.ts'
import { RESERVED_STOREFRONT_SLUGS } from '../src/lib/storefront-slug.ts'
import { buildSitemapEntries } from '../src/lib/seo-sitemap.ts'

test('Etapa C — Embudo de conversión de 4 etapas, diagnóstico inteligente y desglose por asesor', () => {
  const listings = [
    {
      id: 'prop-1',
      slug: 'casa-san-diego',
      titulo: 'Casa Quinta en San Diego',
      precio: 85000,
      ciudad: 'San Diego',
      estado: 'Carabobo',
      activo: true,
      vendido: false,
      destacado: true,
      visitas: 40,
      usuario_id: 'owner-1',
      agente_asignado_id: 'agent-1',
    },
    {
      id: 'prop-2',
      slug: 'apto-valencia',
      titulo: 'Apartamento en El Parral',
      precio: 62000,
      ciudad: 'Valencia',
      estado: 'Carabobo',
      activo: true,
      vendido: false,
      destacado: false,
      visitas: 55,
      usuario_id: 'owner-1',
      agente_asignado_id: 'agent-2',
    },
  ]

  const events = [
    { tipo: 'vista_inmueble', session_id: 's1', meta: { inmueble_id: 'prop-1' } },
    { tipo: 'vista_inmueble', session_id: 's2', meta: { inmueble_id: 'prop-1' } },
    { tipo: 'compartir', session_id: 's1', meta: { inmueble_id: 'prop-1' } },
    { tipo: 'click_contacto', session_id: 's1', meta: { inmueble_id: 'prop-1', canal: 'whatsapp' } },
    { tipo: 'click_contacto', session_id: 's2', meta: { inmueble_id: 'prop-1', canal: 'llamar' } },
  ]

  const { items, summary } = computePortfolioListingFunnels({
    listings,
    events,
    favoriteCountsByProperty: { 'prop-1': 4, 'prop-2': 0 },
    conversations: [{ id: 'c1', producto_id: 'prop-1' }],
    visits: [
      {
        id: 'v1',
        inmueble_id: 'prop-1',
        agente_id: 'agent-1',
        propietario_id: 'owner-1',
        estado: 'confirmada',
      },
    ],
  })

  assert.equal(summary.totalListings, 2)
  assert.equal(summary.effectiveViews, 95)
  assert.equal(summary.favorites, 4)
  assert.equal(summary.shares, 1)
  assert.equal(summary.whatsappClicks, 1)
  assert.equal(summary.phoneClicks, 1)
  assert.equal(summary.chatLeads, 1)
  assert.equal(summary.totalContacts, 3)
  assert.equal(summary.visitRequests, 1)
  assert.equal(summary.confirmedVisits, 1)
  assert.equal(summary.totalLeads, 4)

  const p1 = items.find((i) => i.propertyId === 'prop-1')
  const p2 = items.find((i) => i.propertyId === 'prop-2')
  assert.ok(p1 && p2)
  assert.equal(p1.uniqueViewSessions, 2)
  assert.equal(p1.diagnostic, 'strong_conversion')
  assert.equal(p2.diagnostic, 'high_views_low_leads')

  const byAgent = aggregateAgentPerformance({
    listingFunnels: items,
    agentNamesById: { 'agent-1': 'María Gómez', 'agent-2': 'Carlos Ruiz' },
    reviewsByAgentId: new Map([['agent-1', { count: 3, avg: 4.7 }]]),
  })

  assert.equal(byAgent.length, 2)
  assert.equal(byAgent[0].agentId, 'agent-1')
  assert.equal(byAgent[0].totalLeads, 4)
  assert.equal(byAgent[0].averageRating, 4.7)

  // CSV anti-inyección de fórmulas
  const csv = buildFunnelCsv(
    [{ ...p1, title: '=CMD("calc")' }],
    { 'agent-1': 'María Gómez' },
    'es',
  )
  assert.match(csv, /"'=CMD\(""calc""\)"/)
})

test('Etapa C — Velocidad mediana de respuesta en chat y distribución de reseñas verificadas', () => {
  const messages = [
    // Conversación 1: respuesta en 18 minutos
    {
      conversacion_id: 'conv-1',
      remitente_id: 'buyer-a',
      creado_en: '2026-11-01T14:00:00Z',
    },
    {
      conversacion_id: 'conv-1',
      remitente_id: 'advisor-1',
      creado_en: '2026-11-01T14:18:00Z',
    },
    // Conversación 2: respuesta en 42 minutos
    {
      conversacion_id: 'conv-2',
      remitente_id: 'buyer-b',
      creado_en: '2026-11-01T16:00:00Z',
    },
    {
      conversacion_id: 'conv-2',
      remitente_id: 'advisor-1',
      creado_en: '2026-11-01T16:42:00Z',
    },
  ]

  const speed = computeMedianFirstResponseMinutes(messages, ['advisor-1'])
  assert.equal(speed.sampleConversations, 2)
  assert.equal(speed.medianMinutes, 30)
  assert.equal(speed.tier, 'fast_under_1h')

  const dist = computeReviewDistribution([
    { puntuacion: 5, tipo_interaccion: 'visita_confirmada' },
    { puntuacion: 5, tipo_interaccion: 'cierre_operacion' },
    { puntuacion: 4, tipo_interaccion: 'conversacion' },
  ])
  assert.equal(dist.total, 3)
  assert.equal(dist.average, 4.7)
  assert.equal(dist.countsByStar[5], 2)
  assert.equal(dist.countsByStar[4], 1)
  assert.equal(dist.countsByOrigin.visita_confirmada, 1)
  assert.equal(dist.countsByOrigin.cierre_operacion, 1)
  assert.equal(dist.countsByOrigin.conversacion, 1)
})

test('Etapa C — Directorio SEO /asesores, slugs reservados y sitemap libre de contenido vacío', () => {
  assert.ok(RESERVED_STOREFRONT_SLUGS.has('asesores'))
  assert.ok(RESERVED_STOREFRONT_SLUGS.has('agencias'))

  const middlewareSrc = readFileSync('src/middleware.ts', 'utf8')
  assert.match(middlewareSrc, /'asesores'/)

  const asesoresPageSrc = readFileSync('src/app/[locale]/asesores/page.tsx', 'utf8')
  assert.match(asesoresPageSrc, /export async function generateMetadata/)
  assert.match(asesoresPageSrc, /buildPageAlternates\(locale,\s*'\/asesores'\)/)
  assert.doesNotMatch(asesoresPageSrc, /\|\s*Venezuela Inmuebles/)

  const emptySellersSitemap = buildSitemapEntries({ properties: [], sellers: [] })
  assert.ok(
    !emptySellersSitemap.some((e) => e.url.endsWith('/asesores')),
    'Sin asesores/agencias activos, /asesores no debe inflar el sitemap',
  )

  const activeSellersSitemap = buildSitemapEntries({
    properties: [],
    sellers: [{ id: '38b802d2-7f26-4c88-a105-5df28473df1f', slug: 'inmobiliaria-centro' }],
  })
  assert.ok(activeSellersSitemap.some((e) => e.url === 'https://venezuela-inmuebles.online/asesores'))
  assert.ok(
    activeSellersSitemap.some((e) => e.url === 'https://venezuela-inmuebles.online/en/asesores'),
  )
})

test('Etapa C — PGlite: Migración 023 recalcula nivel_confianza/badges, protege reseñas inmutables y amplía vw_perfiles_publicos', async () => {
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
    CREATE OR REPLACE FUNCTION public.telefono_visible_anuncio(mc jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
      SELECT true;
    $$;

    CREATE TABLE public.perfiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text,
      email text,
      telefono text,
      estado text,
      ciudad text,
      foto_perfil_url text,
      email_visible boolean DEFAULT false,
      whatsapp_disponible boolean DEFAULT true,
      verificado boolean DEFAULT false,
      verificado_desde timestamptz,
      nivel_confianza smallint DEFAULT 0,
      badges_automaticos jsonb DEFAULT '[]'::jsonb,
      ultima_actividad timestamptz,
      creado_en timestamptz DEFAULT now(),
      tipo_cuenta text DEFAULT 'asesor',
      empresa_nombre text,
      licencia_corredor text,
      descripcion_agente text,
      logo_url text,
      slug text
    );

    CREATE TABLE public.agencias (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL,
      descripcion text,
      logo_url text,
      owner_id uuid NOT NULL REFERENCES public.perfiles(id),
      creado_en timestamptz DEFAULT now(),
      actualizado_en timestamptz DEFAULT now()
    );

    CREATE TABLE public.agencia_miembros (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      agencia_id uuid NOT NULL REFERENCES public.agencias(id),
      user_id uuid NOT NULL REFERENCES public.perfiles(id),
      rol text NOT NULL DEFAULT 'agente',
      estado text NOT NULL DEFAULT 'activo'
    );

    CREATE TABLE public.inmuebles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES public.perfiles(id),
      agencia_id uuid REFERENCES public.agencias(id),
      agente_asignado_id uuid REFERENCES public.perfiles(id),
      titulo text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      vendido boolean NOT NULL DEFAULT false,
      estado_moderacion text NOT NULL DEFAULT 'aprobado',
      metodos_contacto jsonb,
      creado_en timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.eventos_web (
      id bigserial PRIMARY KEY,
      tipo text NOT NULL,
      ruta text NOT NULL,
      meta jsonb,
      creado_en timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.resenas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      producto_id uuid NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
      vendedor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
      comprador_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
      puntuacion smallint NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
      comentario text,
      producto_titulo text,
      creado_en timestamptz NOT NULL DEFAULT now(),
      UNIQUE (producto_id, vendedor_id, comprador_id)
    );
    ALTER TABLE public.resenas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY resenas_select_publico ON public.resenas FOR SELECT USING (true);

    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    GRANT UPDATE ON public.resenas TO authenticated;
  `)

  await db.exec(readFileSync('supabase/migrations/021_etapa_b_alertas_visitas_comparador.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/022_etapa_b_visitas_comprador_rls.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/023_etapa_c_analitica_escaparate_reputacion.sql', 'utf8'))

  const uOwner = (
    await db.query(
      "INSERT INTO perfiles (nombre, verificado, empresa_nombre, slug) VALUES ('Inmobiliaria Ávila', true, 'Inmobiliaria Ávila', 'inmobiliaria-avila') RETURNING id",
    )
  ).rows[0].id
  const uAgent = (
    await db.query(
      "INSERT INTO perfiles (nombre, verificado, licencia_corredor, zonas_especialidad, anos_experiencia, slug) VALUES ('Ana Gómez', true, 'CIV #1420', ARRAY['San Diego','El Parral'], 7, 'ana-gomez') RETURNING id",
    )
  ).rows[0].id
  const uBuyer1 = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Comprador Uno') RETURNING id")).rows[0].id
  const uBuyer2 = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Comprador Dos') RETURNING id")).rows[0].id
  const uBuyer3 = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Comprador Tres') RETURNING id")).rows[0].id
  const uStranger = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Externo') RETURNING id")).rows[0].id

  const agenciaId = (
    await db.query("INSERT INTO agencias (nombre, owner_id) VALUES ('Inmobiliaria Ávila', $1) RETURNING id", [uOwner])
  ).rows[0].id
  await db.query(
    "INSERT INTO agencia_miembros (agencia_id, user_id, rol, estado) VALUES ($1, $2, 'admin', 'activo'), ($1, $3, 'agente', 'activo')",
    [agenciaId, uOwner, uAgent],
  )

  const prop1 = (
    await db.query(
      "INSERT INTO inmuebles (usuario_id, agencia_id, agente_asignado_id, titulo) VALUES ($1, $2, $3, 'Casa en San Diego') RETURNING id",
      [uOwner, agenciaId, uAgent],
    )
  ).rows[0].id

  // 3 visitas confirmadas -> activa automáticamente badge `atencion_visitas`
  for (const b of [uBuyer1, uBuyer2, uBuyer3]) {
    await db.query(
      `INSERT INTO solicitudes_visita (inmueble_id, propietario_id, agencia_id, agente_id, solicitante_user_id, nombre_contacto, telefono_contacto, estado)
       VALUES ($1, $2, $3, $4, $5, 'Cliente', '+584121234567', 'confirmada')`,
      [prop1, uOwner, agenciaId, uAgent, b],
    )
  }

  // 3 reseñas 5★ -> activa automáticamente `buena_reputacion` y sube `nivel_confianza` a 5
  const rev1Id = (
    await db.query(
      `INSERT INTO resenas (producto_id, vendedor_id, comprador_id, puntuacion, comentario, tipo_interaccion)
       VALUES ($1, $2, $3, 5, 'Excelente atención en la visita', 'visita_confirmada')
       RETURNING id`,
      [prop1, uAgent, uBuyer1],
    )
  ).rows[0].id
  await db.query(
    `INSERT INTO resenas (producto_id, vendedor_id, comprador_id, puntuacion, comentario, tipo_interaccion)
     VALUES ($1, $2, $3, 5, 'Muy puntual', 'visita_confirmada'),
            ($1, $2, $4, 4, 'Buena asesoría', 'conversacion')`,
    [prop1, uAgent, uBuyer2, uBuyer3],
  )

  const agentRep = (
    await db.query('SELECT nivel_confianza, badges_automaticos FROM perfiles WHERE id = $1', [uAgent])
  ).rows[0]
  assert.equal(agentRep.nivel_confianza, 5)
  assert.ok(agentRep.badges_automaticos.includes('vendedor_activo'))
  assert.ok(agentRep.badges_automaticos.includes('atencion_visitas'))
  assert.ok(agentRep.badges_automaticos.includes('buena_reputacion'))

  // RLS + inmutabilidad en `resenas`:
  // 1) Un externo NO puede responder la reseña
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uStranger}', false);`)
  const strangerUpd = await db.query(
    "UPDATE resenas SET respuesta_vendedor = 'Intruso' WHERE id = $1 RETURNING id",
    [rev1Id],
  )
  assert.equal(strangerUpd.rows.length, 0)

  // 2) El dueño de la agencia SÍ puede publicar respuesta oficial en nombre de su agente
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uOwner}', false);`)
  const ownerReply = await db.query(
    "UPDATE resenas SET respuesta_vendedor = '¡Muchas gracias por visitarnos!' WHERE id = $1 RETURNING respuesta_vendedor, respuesta_en",
    [rev1Id],
  )
  assert.equal(ownerReply.rows.length, 1)
  assert.equal(ownerReply.rows[0].respuesta_vendedor, '¡Muchas gracias por visitarnos!')
  assert.ok(ownerReply.rows[0].respuesta_en)

  // 3) Ni siquiera el propio agente puede alterar la puntuación o el comentario del comprador
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uAgent}', false);`)
  await assert.rejects(
    db.query('UPDATE resenas SET puntuacion = 1 WHERE id = $1', [rev1Id]),
  )

  // 4) Vista `vw_perfiles_publicos` expone credenciales y métricas agregadas exactas
  await db.exec('RESET ROLE;')
  const pubRow = (
    await db.query(
      'SELECT licencia_corredor, zonas_especialidad, propiedades_activas, num_resenas, promedio_resenas, visitas_atendidas FROM vw_perfiles_publicos WHERE id = $1',
      [uAgent],
    )
  ).rows[0]
  assert.equal(pubRow.licencia_corredor, 'CIV #1420')
  assert.deepEqual(pubRow.zonas_especialidad, ['San Diego', 'El Parral'])
  assert.equal(pubRow.propiedades_activas, 1)
  assert.equal(pubRow.num_resenas, 3)
  assert.equal(Number(pubRow.promedio_resenas), 4.67)
  assert.equal(pubRow.visitas_atendidas, 3)
})
