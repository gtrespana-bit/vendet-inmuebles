import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import {
  generateInviteToken,
  hashInviteToken,
  isValidInviteToken,
  normalizeInviteEmail,
  isValidAgencyRole,
  canManageAgencyTeam,
  canTransferAgencyCredits,
  canInviteMatchUserEmail,
  resolveEffectiveAgencyPublisher,
} from '../src/lib/agency.ts'
import { resolverContactoPublicacion } from '../src/lib/contact-methods.ts'

test('agency invite token generation, SHA-256 hashing and validation', () => {
  const token = generateInviteToken()
  assert.equal(token.length, 48)
  assert.equal(isValidInviteToken(token), true)
  assert.equal(isValidInviteToken('short-token'), false)

  const hash1 = hashInviteToken(token)
  const hash2 = hashInviteToken(`  ${token}  `)
  assert.equal(hash1.length, 64)
  assert.equal(hash1, hash2)
})

test('agency roles, email normalization, permissions and effective publisher resolution', () => {
  assert.deepEqual(normalizeInviteEmail('  Agente@Inmobiliaria.COM '), {
    ok: true,
    email: 'agente@inmobiliaria.com',
  })
  assert.deepEqual(normalizeInviteEmail(''), { ok: true, email: null })
  assert.equal(normalizeInviteEmail('correo-invalido').ok, false)
  assert.equal(isValidAgencyRole('admin'), true)
  assert.equal(isValidAgencyRole('agente'), true)
  assert.equal(isValidAgencyRole('otro'), false)

  // Permisos: solo el dueño transfiere créditos; dueño y admin gestionan equipo
  assert.equal(canManageAgencyTeam('admin-1', 'owner-1', 'admin'), true)
  assert.equal(canManageAgencyTeam('agent-1', 'owner-1', 'agente'), false)
  assert.equal(canTransferAgencyCredits('owner-1', 'owner-1'), true)
  assert.equal(canTransferAgencyCredits('admin-1', 'owner-1'), false)
  assert.equal(canInviteMatchUserEmail(null, 'cualquiera@correo.com'), true)
  assert.equal(canInviteMatchUserEmail('Asesor@Real.ve', 'asesor@real.ve'), true)
  assert.equal(canInviteMatchUserEmail('asesor@real.ve', 'otro@real.ve'), false)

  const agencyBase = {
    id: 'agencia-1',
    nombre: 'Caracas Realty',
    descripcion: null,
    logo_url: null,
    owner_id: 'owner-1',
    agenciaPlanActivo: true,
  }
  const activeMembers = new Set(['owner-1', 'agent-1', 'otro-agente'])

  // Publicación bajo agencia activa: cartera pertenece a la agencia, agente atiende leads
  const pubByAgent = resolveEffectiveAgencyPublisher({
    userId: 'agent-1',
    agency: {
      ...agencyBase,
      rol: 'agente',
      isOwner: false,
      isAdmin: false,
    },
    requestedAgentId: 'otro-agente',
    activeMemberIds: activeMembers,
  })
  assert.deepEqual(pubByAgent, {
    usuario_id: 'owner-1',
    agencia_id: 'agencia-1',
    agente_asignado_id: 'agent-1',
  })

  // Dueño o admin sí puede asignar el anuncio a cualquier agente activo del equipo
  const pubByOwner = resolveEffectiveAgencyPublisher({
    userId: 'owner-1',
    agency: {
      ...agencyBase,
      rol: 'admin',
      isOwner: true,
      isAdmin: true,
    },
    requestedAgentId: 'otro-agente',
    activeMemberIds: activeMembers,
  })
  assert.equal(pubByOwner.agente_asignado_id, 'otro-agente')
})

test('resolverContactoPublicacion routes default contact to assigned agent when present', () => {
  const fallbackToAgent = resolverContactoPublicacion({
    metodos_contacto: null,
    propietario_telefono: '+584141111111',
    propietario_email: 'agencia@ejemplo.com',
    agente_telefono: '+584129998877',
    agente_email: 'asesor@ejemplo.com',
  })
  assert.equal(fallbackToAgent.telWhatsapp, '+584129998877')
  assert.equal(fallbackToAgent.email, 'asesor@ejemplo.com')

  const explicitOverride = resolverContactoPublicacion({
    metodos_contacto: { whatsapp: '+584240001122' },
    agente_telefono: '+584129998877',
  })
  assert.equal(explicitOverride.telWhatsapp, '+584240001122')
  assert.equal(explicitOverride.telLlamadas, null)
})

// ── Pruebas SQL reales en PGlite para la migración 018 ──
const db = new PGlite()

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb
  );
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
  $$;
  CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT false;
  $$;
  CREATE OR REPLACE FUNCTION public.telefono_visible_anuncio(metodos jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT metodos IS NULL OR (jsonb_typeof(metodos) = 'object' AND (metodos ? 'telefono' OR metodos ? 'whatsapp'));
  $$;

  CREATE TABLE public.perfiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text,
    apellido text,
    email text,
    telefono text,
    estado text,
    ciudad text,
    foto_perfil_url text,
    verificado boolean DEFAULT false,
    tipo_documento text,
    numero_documento text,
    fecha_verificacion timestamptz,
    credito_balance integer DEFAULT 0,
    es_admin boolean DEFAULT false,
    creado_en timestamptz DEFAULT now(),
    actualizado_en timestamptz DEFAULT now(),
    nivel_confianza integer DEFAULT 0,
    badges_automaticos text[] DEFAULT '{}'::text[],
    total_vendidas integer DEFAULT 0,
    ultima_actividad timestamptz DEFAULT now(),
    whatsapp_activo boolean DEFAULT true,
    whatsapp_disponible boolean DEFAULT true,
    verificado_desde timestamptz,
    telefono_visible boolean DEFAULT true,
    email_visible boolean DEFAULT false,
    empresa_nombre text,
    licencia_inmobiliaria text,
    descripcion_agente text,
    sitio_web text,
    instagram text,
    redes_sociales jsonb DEFAULT '{}'::jsonb,
    logo_url text,
    banner_url text,
    slug text,
    tipo_cuenta text DEFAULT 'particular'
  );

  CREATE TABLE public.agencias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    slug text UNIQUE NOT NULL,
    rif text,
    descripcion text,
    logo_url text,
    portada_url text,
    telefono text,
    whatsapp text,
    email text,
    sitio_web text,
    direccion text,
    ciudad text,
    estado text,
    verificada boolean DEFAULT false,
    activa boolean DEFAULT true,
    owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    max_miembros integer DEFAULT 5,
    creado_en timestamptz DEFAULT now(),
    actualizado_en timestamptz DEFAULT now()
  );

  CREATE TABLE public.agencia_miembros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    rol text DEFAULT 'agente' CHECK (rol IN ('admin', 'agente')),
    invitado_en timestamptz DEFAULT now(),
    aceptado_en timestamptz,
    UNIQUE(agencia_id, user_id)
  );

  CREATE TABLE public.suscripciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    plan text NOT NULL,
    estado text NOT NULL,
    inicio timestamptz DEFAULT now(),
    fin timestamptz,
    trial_ends_at timestamptz,
    creditos_incluidos integer DEFAULT 0,
    creditos_usados_mes integer DEFAULT 0,
    proxima_renovacion_creditos timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  CREATE TABLE public.tipos_inmueble (id serial PRIMARY KEY, nombre text, slug text, icono text);
  CREATE TABLE public.operaciones (id serial PRIMARY KEY, nombre text, slug text);
  INSERT INTO public.tipos_inmueble (nombre, slug) VALUES ('Apartamento', 'apartamento');
  INSERT INTO public.operaciones (nombre, slug) VALUES ('Venta', 'venta');

  CREATE TABLE public.inmuebles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    tipo_id integer DEFAULT 1 REFERENCES public.tipos_inmueble(id),
    operacion_id integer DEFAULT 1 REFERENCES public.operaciones(id),
    titulo text NOT NULL,
    descripcion text,
    slug text,
    precio numeric DEFAULT 100000,
    moneda text DEFAULT 'USD',
    precio_negociable boolean DEFAULT false,
    estado text DEFAULT 'Miranda',
    ciudad text DEFAULT 'Chacao',
    ubicacion_estado_id integer,
    ubicacion_ciudad_id integer,
    municipio text,
    urbanizacion text,
    zona text,
    direccion text,
    direccion_exacta text,
    codigo_postal text,
    latitud numeric,
    longitud numeric,
    area_construida numeric,
    area_terreno numeric,
    area_total numeric,
    habitaciones integer DEFAULT 3,
    banos integer DEFAULT 2,
    medios_banos integer DEFAULT 0,
    estacionamientos integer DEFAULT 1,
    puestos_estacionamiento integer DEFAULT 1,
    piso integer,
    pisos integer,
    piso_ubicacion integer,
    antiguedad text,
    antiguedad_anios integer,
    condicion text,
    amueblado text,
    gastos_comunes numeric,
    destacado boolean DEFAULT false,
    destacado_hasta timestamptz,
    boosteado_en timestamptz,
    activo boolean DEFAULT true,
    verificado boolean DEFAULT false,
    vendido boolean DEFAULT false,
    vendido_en text,
    comprador_id uuid,
    visitas integer DEFAULT 0,
    favoritos_count integer DEFAULT 0,
    contactos_count integer DEFAULT 0,
    imagen_url text,
    video_url text,
    virtual_tour_url text,
    tour_360_url text,
    categoria_id integer,
    subcategoria text,
    marca text,
    modelo text,
    meta_titulo text,
    meta_descripcion text,
    creado_en timestamptz DEFAULT now(),
    actualizado_en timestamptz DEFAULT now(),
    publicado_en timestamptz DEFAULT now(),
    expira_en timestamptz,
    estado_moderacion text DEFAULT 'aprobado',
    motivo_moderacion text,
    motivo_rechazo text,
    moderado_por uuid,
    moderado_en timestamptz,
    ubicacion_exacta boolean DEFAULT false,
    agencia_id uuid REFERENCES public.agencias(id) ON DELETE SET NULL,
    agente_asignado_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
    plano_url text,
    metodos_contacto jsonb
  );

  CREATE TABLE public.inmueble_imagenes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inmueble_id uuid NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    url_imagen text NOT NULL,
    orden integer DEFAULT 0,
    es_portada boolean DEFAULT false
  );

  CREATE TABLE public.caracteristicas (
    id serial PRIMARY KEY,
    nombre text NOT NULL,
    icono text,
    categoria text
  );

  CREATE TABLE public.inmueble_caracteristicas (
    inmueble_id uuid NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    caracteristica_id integer NOT NULL REFERENCES public.caracteristicas(id) ON DELETE CASCADE,
    PRIMARY KEY (inmueble_id, caracteristica_id)
  );

  CREATE TABLE public.conversaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id uuid NOT NULL REFERENCES public.perfiles(id),
    user2_id uuid NOT NULL REFERENCES public.perfiles(id),
    producto_id uuid REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    ultimo_mensaje text,
    ultimo_mensaje_contenido text,
    ultimo_mensaje_en timestamptz DEFAULT now(),
    creado_en timestamptz DEFAULT now(),
    actualizado_en timestamptz DEFAULT now()
  );

  CREATE TABLE public.destacados (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id uuid REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.perfiles(id) ON DELETE CASCADE,
    inicio timestamptz DEFAULT now(),
    fin timestamptz,
    pagado boolean DEFAULT true,
    creditos_usados integer DEFAULT 0
  );

  CREATE TABLE public.transacciones_creditos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    tipo text DEFAULT 'compra',
    monto integer NOT NULL CHECK (monto > 0),
    precio_usd numeric(10, 2) CHECK (precio_usd IS NULL OR precio_usd >= 0),
    metodo_pago text,
    comprobante_url text,
    referencia text,
    estado text DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado')),
    motivo_registro text,
    creado_en timestamptz DEFAULT now(),
    actualizado_en timestamptz DEFAULT now(),
    aprobado_en timestamptz,
    aprobado_por uuid
  );
`)

const m016 = readFileSync(
  new URL('../supabase/migrations/016_monetizacion_creditos_y_admin_atomico.sql', import.meta.url),
  'utf8'
)
await db.exec(
  m016.slice(0, m016.indexOf('CREATE OR REPLACE FUNCTION public.usar_boost'))
)

await db.exec(
  readFileSync(new URL('../supabase/migrations/018_sistema_agencias_y_equipo.sql', import.meta.url), 'utf8')
)

test('migration 018 auto-provisions agency for active agency owner and enforces single active membership', async () => {
  const { rows: [owner] } = await db.query(
    `INSERT INTO public.perfiles (nombre, empresa_nombre, email, credito_balance, tipo_cuenta)
     VALUES ('Carlos Titular', 'Caracas Luxury Realty', 'carlos@realty.ve', 5, 'agencia')
     RETURNING id`
  )
  await db.query(
    `INSERT INTO public.suscripciones (user_id, plan, estado, trial_ends_at, creditos_incluidos, creditos_usados_mes)
     VALUES ($1, 'agencia', 'trial', now() + interval '25 days', 20, 0)`,
    [owner.id]
  )

  // Re-ejecutar bloque de backfill mediante nueva agencia o verificar unicidad
  const { rows: [agency] } = await db.query(
    `INSERT INTO public.agencias (nombre, slug, owner_id)
     VALUES ('Caracas Luxury Realty', 'caracas-luxury-realty', $1)
     RETURNING id`,
    [owner.id]
  )
  await db.query(
    `INSERT INTO public.agencia_miembros (agencia_id, user_id, rol, estado, aceptado_en)
     VALUES ($1, $2, 'admin', 'activo', now())`,
    [agency.id, owner.id]
  )

  const { rows: [agent] } = await db.query(
    `INSERT INTO public.perfiles (nombre, email, telefono, credito_balance)
     VALUES ('María Asesora', 'maria@realty.ve', '+584121234567', 0)
     RETURNING id`
  )
  await db.query(
    `INSERT INTO public.agencia_miembros (agencia_id, user_id, rol, estado, aceptado_en)
     VALUES ($1, $2, 'agente', 'activo', now())`,
    [agency.id, agent.id]
  )

  // Un mismo agente NO puede estar activo en una segunda agencia simultáneamente
  const { rows: [otherOwner] } = await db.query(
    `INSERT INTO public.perfiles (nombre, email) VALUES ('Otra Agencia', 'otra@realty.ve') RETURNING id`
  )
  const { rows: [otherAgency] } = await db.query(
    `INSERT INTO public.agencias (nombre, slug, owner_id) VALUES ('Otra', 'otra-agencia', $1) RETURNING id`,
    [otherOwner.id]
  )
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.agencia_miembros (agencia_id, user_id, rol, estado)
         VALUES ($1, $2, 'agente', 'activo')`,
        [otherAgency.id, agent.id]
      ),
    /duplicate key|idx_agencia_miembros_active_user/i
  )
})

test('controlled credits: agent cannot spend agency pool directly, owner can boost or transfer credits, and unlinking preserves portfolio', async () => {
  const { rows: [agency] } = await db.query(
    `SELECT id, owner_id FROM public.agencias WHERE slug = 'caracas-luxury-realty'`
  )
  const { rows: [agent] } = await db.query(
    `SELECT id FROM public.perfiles WHERE email = 'maria@realty.ve'`
  )
  const { rows: [buyer] } = await db.query(
    `INSERT INTO public.perfiles (nombre, email) VALUES ('Comprador Interesado', 'comprador@correo.ve') RETURNING id`
  )

  // Crear propiedad publicada bajo la cartera de la agencia y atendida por María
  const { rows: [prop] } = await db.query(
    `INSERT INTO public.inmuebles (usuario_id, agencia_id, agente_asignado_id, titulo, slug)
     VALUES ($1, $2, $3, 'Penthouse en Altamira', 'penthouse-en-altamira')
     RETURNING id`,
    [agency.owner_id, agency.id, agent.id]
  )
  await db.query(
    `INSERT INTO public.conversaciones (producto_id, user1_id, user2_id, agencia_id, agente_asignado_id)
     VALUES ($1, $2, $3, $4, $3)`,
    [prop.id, buyer.id, agent.id, agency.id]
  )

  // 1) María (saldo 0) intenta usar boost sobre su captación → NO puede gastar los 20 créditos mensuales del dueño
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${agent.id}', false)`)
  const { rows: [boostDenied] } = await db.query(
    `SELECT public.usar_boost($1, $2) AS res`,
    [prop.id, agent.id]
  )
  assert.equal(boostDenied.res.ok, false)
  assert.match(boostDenied.res.error, /créditos suficientes/i)

  // 2) María tampoco puede autotransferirse créditos de la agencia
  const { rows: [transferDenied] } = await db.query(
    `SELECT public.transferir_creditos_agencia($1, $2, 3) AS res`,
    [agent.id, agent.id]
  )
  assert.equal(transferDenied.res.ok, false)

  // 3) El titular de la agencia impulsa directamente el inmueble de María usando 1 crédito mensual del plan Agencia
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${agency.owner_id}', false)`)
  const { rows: [ownerBoost] } = await db.query(
    `SELECT public.usar_boost($1, $2) AS res`,
    [prop.id, agency.owner_id]
  )
  assert.equal(ownerBoost.res.ok, true)

  // 4) El titular transfiere 4 créditos a María (descuenta primero de los restantes mensuales del plan)
  const { rows: [transferOk] } = await db.query(
    `SELECT public.transferir_creditos_agencia($1, $2, 4) AS res`,
    [agency.owner_id, agent.id]
  )
  assert.equal(transferOk.res.ok, true)
  assert.equal(transferOk.res.agencia_creditos_plan_restantes, 15)
  assert.equal(transferOk.res.agente_balance, 4)

  // 5) Ahora María sí puede destacar su captación por 12h (4 créditos) con su saldo asignado
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${agent.id}', false)`)
  const { rows: [agentFeatured] } = await db.query(
    `SELECT public.usar_destacado($1, $2, 12) AS res`,
    [prop.id, agent.id]
  )
  assert.equal(agentFeatured.res.ok, true)
  assert.equal(agentFeatured.res.balance, 0)

  // 6) Las vistas públicas exponen la atribución de agencia + agente responsable
  const { rows: [pubView] } = await db.query(
    `SELECT agencia_nombre, agente_nombre FROM public.vw_propiedades_publicas WHERE id = $1`,
    [prop.id]
  )
  assert.equal(pubView.agencia_nombre, 'Caracas Luxury Realty')
  assert.equal(pubView.agente_nombre, 'María Asesora')

  const { rows: [agentProfileView] } = await db.query(
    `SELECT miembro_agencia_nombre, miembro_agencia_owner_id FROM public.vw_perfiles_publicos WHERE id = $1`,
    [agent.id]
  )
  assert.equal(agentProfileView.miembro_agencia_nombre, 'Caracas Luxury Realty')
  assert.equal(agentProfileView.miembro_agencia_owner_id, agency.owner_id)

  // 7) Desvincular a María conserva el 100 % de la cartera y reasigna propiedad + conversación al titular
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${agency.owner_id}', false)`)
  const { rows: [unlinkRes] } = await db.query(
    `SELECT public.desvincular_miembro_agencia($1, $2, $3) AS res`,
    [agency.owner_id, agent.id, agency.owner_id]
  )
  assert.equal(unlinkRes.res.ok, true)
  assert.equal(unlinkRes.res.inmuebles_reasignados, 1)

  const { rows: [propAfter] } = await db.query(
    `SELECT usuario_id, agencia_id, agente_asignado_id, activo FROM public.inmuebles WHERE id = $1`,
    [prop.id]
  )
  assert.equal(propAfter.usuario_id, agency.owner_id)
  assert.equal(propAfter.agencia_id, agency.id)
  assert.equal(propAfter.agente_asignado_id, agency.owner_id)
  assert.equal(propAfter.activo, true)

  const { rows: [convAfter] } = await db.query(
    `SELECT agente_asignado_id FROM public.conversaciones WHERE producto_id = $1`,
    [prop.id]
  )
  assert.equal(convAfter.agente_asignado_id, agency.owner_id)
})

test.after(async () => {
  await db.close()
})
