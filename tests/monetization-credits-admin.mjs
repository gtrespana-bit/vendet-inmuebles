import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()

await db.exec(`
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'service_role');
$$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false; $$;

CREATE TABLE public.perfiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (credito_balance >= 0),
  tipo_cuenta text NOT NULL DEFAULT 'particular'
);

CREATE TABLE public.suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  plan text NOT NULL,
  estado text NOT NULL,
  inicio timestamptz NOT NULL DEFAULT now(),
  fin timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  creditos_incluidos integer NOT NULL DEFAULT 0,
  creditos_usados_mes integer NOT NULL DEFAULT 0,
  proxima_renovacion_creditos timestamptz,
  cambio_gratuita boolean NOT NULL DEFAULT false
);

CREATE TABLE public.inmuebles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  activo boolean NOT NULL DEFAULT true,
  destacado boolean NOT NULL DEFAULT false,
  destacado_hasta timestamptz,
  boosteado_en timestamptz,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.destacados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES public.inmuebles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  pagado boolean NOT NULL DEFAULT true,
  pago_id uuid,
  creditos_usados integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transacciones_creditos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  monto integer NOT NULL CHECK (monto > 0),
  precio_usd numeric,
  metodo_pago text,
  estado text NOT NULL,
  motivo_registro text,
  referencia text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  aprobado_en timestamptz,
  aprobado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL
);

CREATE TABLE public.ordenes_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfiles(id),
  concepto text NOT NULL,
  creditos integer NOT NULL DEFAULT 0,
  precio_usd numeric NOT NULL,
  monto numeric NOT NULL,
  moneda text NOT NULL,
  metodo text NOT NULL,
  destinatario jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado text NOT NULL DEFAULT 'creada',
  otorgada_en timestamptz,
  suscripcion_id uuid,
  previas uuid[] DEFAULT '{}'
);
`)

await db.exec(readFileSync('supabase/migrations/011_cambio_plan_durante_prueba.sql', 'utf8'))
await db.exec(readFileSync('supabase/migrations/016_monetizacion_creditos_y_admin_atomico.sql', 'utf8'))
await db.exec(readFileSync('supabase/migrations/019_admin_planes_tiempo_extra.sql', 'utf8'))

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]

test('los créditos incluidos del plan se consumen antes que los comprados y admiten 12h/24h/48h', async () => {
  const { id: uid } = await one('INSERT INTO perfiles (credito_balance) VALUES (5) RETURNING id')
  await db.query(
    `INSERT INTO suscripciones (user_id, plan, estado, inicio, fin, creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos)
     VALUES ($1, 'profesional', 'activa', now() - interval '1 day', now() + interval '29 days', 5, 0, now() + interval '29 days')`,
    [uid]
  )
  const { id: pid } = await one('INSERT INTO inmuebles (usuario_id) VALUES ($1) RETURNING id', [uid])

  // 1) Boost (1 crédito): gasta del plan (5 -> 4), saldo comprado sigue en 5.
  const b1 = (await one('SELECT usar_boost($1, $2) AS r', [pid, uid])).r
  assert.equal(b1.ok, true)
  assert.equal(Number(b1.balance), 5)
  assert.equal(b1.creditos_plan_restantes, 4)
  assert.equal(Number(b1.creditos_disponibles), 9)

  // 2) Destacado 12h (4 créditos): agota los 4 restantes del plan; saldo comprado sigue en 5.
  const d12 = (await one('SELECT usar_destacado($1, $2, 12) AS r', [pid, uid])).r
  assert.equal(d12.ok, true)
  assert.equal(Number(d12.balance), 5)
  assert.equal(d12.creditos_plan_restantes, 0)

  // 3) Otro boost (1 crédito): ya sin saldo de plan, descuenta 1 del saldo comprado (5 -> 4).
  const b2 = (await one('SELECT usar_boost($1, $2) AS r', [pid, uid])).r
  assert.equal(b2.ok, true)
  assert.equal(Number(b2.balance), 4)
  assert.equal(b2.creditos_plan_restantes, 0)

  // 4) Duración inválida se rechaza sin tocar saldos.
  const bad = (await one('SELECT usar_destacado($1, $2, 99) AS r', [pid, uid])).r
  assert.equal(bad.ok, false)
  assert.equal(Number((await one('SELECT credito_balance FROM perfiles WHERE id = $1', [uid])).credito_balance), 4)
})

test('consumo mixto: combina créditos restantes del plan con comprados y falla si la suma no alcanza', async () => {
  const { id: uid } = await one('INSERT INTO perfiles (credito_balance) VALUES (4) RETURNING id')
  await db.query(
    `INSERT INTO suscripciones (user_id, plan, estado, inicio, fin, creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos)
     VALUES ($1, 'profesional', 'activa', now(), now() + interval '30 days', 5, 3, now() + interval '30 days')`,
    [uid]
  )
  const { id: pid } = await one('INSERT INTO inmuebles (usuario_id) VALUES ($1) RETURNING id', [uid])

  // Tiene 2 de plan + 4 comprados = 6 totales. Destacado 48h cuesta 10 -> falla sin descontar nada.
  const fail48 = (await one('SELECT usar_destacado($1, $2, 48) AS r', [pid, uid])).r
  assert.equal(fail48.ok, false)
  assert.equal(Number((await one('SELECT credito_balance FROM perfiles WHERE id = $1', [uid])).credito_balance), 4)
  assert.equal((await one('SELECT creditos_usados_mes FROM suscripciones WHERE user_id = $1', [uid])).creditos_usados_mes, 3)

  // Destacado 24h cuesta 6 -> usa los 2 del plan + 4 comprados.
  const ok24 = (await one('SELECT usar_destacado($1, $2, 24) AS r', [pid, uid])).r
  assert.equal(ok24.ok, true)
  assert.equal(Number(ok24.balance), 0)
  assert.equal(ok24.creditos_plan_restantes, 0)
  assert.equal((await one('SELECT creditos_usados_mes FROM suscripciones WHERE user_id = $1', [uid])).creditos_usados_mes, 5)
})

test('cambiar repetidamente de plan en prueba no duplica créditos y al caducar desaparece el cupo del plan', async () => {
  const { id: uid } = await one('INSERT INTO perfiles (credito_balance) VALUES (1) RETURNING id')
  const { id: sid } = await one(
    `INSERT INTO suscripciones (user_id, plan, estado, inicio, fin, trial_ends_at, creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos)
     VALUES ($1, 'profesional', 'trial', now(), now() + interval '15 days', now() + interval '15 days', 5, 0, now() + interval '15 days')
     RETURNING id`,
    [uid]
  )
  const { id: pid } = await one('INSERT INTO inmuebles (usuario_id) VALUES ($1) RETURNING id', [uid])

  // Gasta 5 créditos en Profesional (1 boost + 1 destacado 12h).
  await one('SELECT usar_boost($1, $2)', [pid, uid])
  await one('SELECT usar_destacado($1, $2, 12)', [pid, uid])
  assert.equal((await one('SELECT creditos_usados_mes FROM suscripciones WHERE id = $1', [sid])).creditos_usados_mes, 5)

  // Cambia Gratuita -> Agencia -> Profesional: en Profesional ya usó 5 de 5, así que quedan 0 de plan.
  await db.query("SELECT cambiar_plan_prueba($1, 'gratuita')", [uid])
  await db.query("SELECT cambiar_plan_prueba($1, 'agencia')", [uid])
  await db.query("SELECT cambiar_plan_prueba($1, 'profesional')", [uid])

  // Solo le queda su crédito comprado (1). Un destacado de 12h (4) debe rechazarse.
  const intento = (await one('SELECT usar_destacado($1, $2, 12) AS r', [pid, uid])).r
  assert.equal(intento.ok, false)

  // Sube a Agencia (20 incluidos, 5 ya usados -> 15 disponibles) pero caduca la prueba -> 0 disponibles de plan.
  await db.query("SELECT cambiar_plan_prueba($1, 'agencia')", [uid])
  await db.query("UPDATE suscripciones SET trial_ends_at = now() - interval '1 minute', fin = now() - interval '1 minute' WHERE id = $1", [sid])
  const trasVencer = (await one('SELECT usar_destacado($1, $2, 12) AS r', [pid, uid])).r
  assert.equal(trasVencer.ok, false)
  assert.equal(Number((await one('SELECT credito_balance FROM perfiles WHERE id = $1', [uid])).credito_balance), 1)
})

test('renovación automática del contador mensual cuando proxima_renovacion_creditos vence dentro de una suscripción activa', async () => {
  const { id: uid } = await one('INSERT INTO perfiles (credito_balance) VALUES (0) RETURNING id')
  await db.query(
    `INSERT INTO suscripciones (user_id, plan, estado, inicio, fin, creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos)
     VALUES ($1, 'profesional', 'activa', now() - interval '35 days', now() + interval '330 days', 5, 5, now() - interval '5 days')`,
    [uid]
  )
  const { id: pid } = await one('INSERT INTO inmuebles (usuario_id) VALUES ($1) RETURNING id', [uid])

  const res = (await one('SELECT usar_boost($1, $2) AS r', [pid, uid])).r
  assert.equal(res.ok, true)
  assert.equal(res.creditos_plan_restantes, 4)
  const sub = await one('SELECT creditos_usados_mes, (proxima_renovacion_creditos > now()) AS futura FROM suscripciones WHERE user_id = $1', [uid])
  assert.equal(sub.creditos_usados_mes, 1)
  assert.equal(sub.futura, true)
})

test('admin_agregar_creditos y admin_cambiar_plan son atómicos, idempotentes y restringidos a service_role', async () => {
  const { id: adminId } = await one('INSERT INTO perfiles DEFAULT VALUES RETURNING id')
  const { id: uid } = await one('INSERT INTO perfiles (credito_balance) VALUES (2) RETURNING id')

  const r1 = await one("SELECT * FROM admin_agregar_creditos($1, $2, 10, 'Compensación', 'admin:req-1')", [uid, adminId])
  assert.equal(Number(r1.nuevo_balance), 12)
  assert.equal(r1.ya_aplicado, false)

  // Reintento con la misma referencia no duplica saldo ni asiento contable.
  const r2 = await one("SELECT * FROM admin_agregar_creditos($1, $2, 10, 'Compensación', 'admin:req-1')", [uid, adminId])
  assert.equal(Number(r2.nuevo_balance), 12)
  assert.equal(r2.ya_aplicado, true)
  assert.equal(Number((await one('SELECT count(*) AS c FROM transacciones_creditos WHERE user_id = $1', [uid])).c), 1)

  // Cambio de plan admin cancela el anterior y actualiza tipo_cuenta en la misma operación.
  const p1 = (await one("SELECT admin_cambiar_plan($1, $2, 'agencia', 'activa') AS r", [uid, adminId])).r
  assert.equal(p1.ok, true)
  assert.equal(p1.suscripcion.plan, 'agencia')
  assert.equal((await one('SELECT tipo_cuenta FROM perfiles WHERE id = $1', [uid])).tipo_cuenta, 'agencia')

  const p2 = (await one("SELECT admin_cambiar_plan($1, $2, 'gratuita', 'cancelar') AS r", [uid, adminId])).r
  assert.equal(p2.plan, 'gratuita')
  assert.equal((await one('SELECT tipo_cuenta FROM perfiles WHERE id = $1', [uid])).tipo_cuenta, 'particular')
  assert.equal(Number((await one("SELECT count(*) AS c FROM suscripciones WHERE user_id = $1 AND estado IN ('activa','trial')", [uid])).c), 0)

  // Permisos: ni anon ni authenticated pueden ejecutar funciones internas/admin.
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await one("SELECT has_function_privilege($1, 'public.consumir_creditos_usuario(uuid, integer)', 'EXECUTE') AS ok", [role])).ok, false)
    assert.equal((await one("SELECT has_function_privilege($1, 'public.admin_agregar_creditos(uuid, uuid, integer, text, text)', 'EXECUTE') AS ok", [role])).ok, false)
    assert.equal((await one("SELECT has_function_privilege($1, 'public.admin_cambiar_plan(uuid, uuid, text, text)', 'EXECUTE') AS ok", [role])).ok, false)
    assert.equal((await one("SELECT has_function_privilege($1, 'public.admin_gestionar_plan(uuid, uuid, text, text, text, integer, integer, text)', 'EXECUTE') AS ok", [role])).ok, false)
  }
})

test('admin_gestionar_plan permite sumar tiempo extra manual a agencias seleccionadas y aprovisiona agencia + auditoría', async () => {
  await db.exec(`
    ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS nombre text;
    ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS empresa_nombre text;

    CREATE TABLE IF NOT EXISTS public.agencias (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL,
      owner_id uuid NOT NULL UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
      creado_en timestamptz NOT NULL DEFAULT now(),
      actualizado_en timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.agencia_miembros (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
      rol text NOT NULL CHECK (rol IN ('admin', 'agente')),
      estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
      UNIQUE (agencia_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS public.auditoria (
      id bigserial PRIMARY KEY,
      usuario_id uuid,
      tabla_afectada text NOT NULL,
      operacion text NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
      registro_id uuid,
      datos_anteriores jsonb,
      datos_nuevos jsonb,
      fecha_registro timestamptz NOT NULL DEFAULT now()
    );
  `)

  const { id: adminId } = await one("INSERT INTO perfiles (nombre) VALUES ('Admin') RETURNING id")
  const { id: agenciaElegida } = await one(
    "INSERT INTO perfiles (nombre, empresa_nombre, tipo_cuenta) VALUES ('Ana', 'Inmobiliaria Caracas', 'agencia') RETURNING id"
  )
  const { id: otraAgencia } = await one(
    "INSERT INTO perfiles (nombre, empresa_nombre, tipo_cuenta) VALUES ('Luis', 'Inmobiliaria Valencia', 'agencia') RETURNING id"
  )

  // Ambas agencias inician con sus 30 días estándar de prueba
  await db.query(
    `INSERT INTO suscripciones (user_id, plan, estado, inicio, fin, trial_ends_at, creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos)
     VALUES
       ($1, 'agencia', 'trial', now(), now() + interval '30 days', now() + interval '30 days', 20, 0, now() + interval '30 days'),
       ($2, 'agencia', 'trial', now(), now() + interval '30 days', now() + interval '30 days', 20, 0, now() + interval '30 days')`,
    [agenciaElegida, otraAgencia]
  )

  // Admin regala +30 días extra SOLO a agenciaElegida -> debe quedar en ~60 días totales
  const ext = (await one(
    "SELECT admin_gestionar_plan($1, $2, 'extender', 'agencia', 'trial', 30, NULL, 'Cortesía nueva agencia') AS r",
    [agenciaElegida, adminId]
  )).r
  assert.equal(ext.ok, true)
  assert.equal(ext.operacion, 'extender')
  assert.equal(ext.dias, 30)

  const diasElegida = Number((await one(
    "SELECT EXTRACT(EPOCH FROM (fin - now())) / 86400.0 AS d FROM suscripciones WHERE user_id = $1 AND estado = 'trial'",
    [agenciaElegida]
  )).d)
  const diasOtra = Number((await one(
    "SELECT EXTRACT(EPOCH FROM (fin - now())) / 86400.0 AS d FROM suscripciones WHERE user_id = $1 AND estado = 'trial'",
    [otraAgencia]
  )).d)

  assert.ok(diasElegida > 59 && diasElegida < 61, `Se esperaban ~60 días en agencia elegida y obtuvo ${diasElegida}`)
  assert.ok(diasOtra > 29 && diasOtra < 31, `Otra agencia no debía alterarse y obtuvo ${diasOtra}`)

  // Verifica auto-aprovisionamiento de agencia + membresía admin + registro en auditoría
  const agRow = await one('SELECT id, nombre FROM agencias WHERE owner_id = $1', [agenciaElegida])
  assert.equal(agRow.nombre, 'Inmobiliaria Caracas')
  const memRow = await one('SELECT rol, estado FROM agencia_miembros WHERE agencia_id = $1 AND user_id = $2', [agRow.id, agenciaElegida])
  assert.equal(memRow.rol, 'admin')
  assert.equal(memRow.estado, 'activo')

  const audRow = await one("SELECT operacion, datos_nuevos FROM auditoria WHERE registro_id = $1 ORDER BY id DESC LIMIT 1", [ext.suscripcion.id])
  assert.equal(audRow.operacion, 'UPDATE')
  assert.equal(audRow.datos_nuevos.accion, 'extender_tiempo_extra')
  assert.equal(audRow.datos_nuevos.dias, 30)

  // Asignación manual por 90 días con cupo personalizado de 35 créditos mensuales
  const asig = (await one(
    "SELECT admin_gestionar_plan($1, $2, 'asignar', 'agencia', 'activa', 90, 35, 'Acuerdo trimestral') AS r",
    [agenciaElegida, adminId]
  )).r
  assert.equal(asig.ok, true)
  assert.equal(asig.suscripcion.estado, 'activa')
  assert.equal(asig.suscripcion.creditos_incluidos, 35)
  const diasAsig = Number((await one(
    "SELECT EXTRACT(EPOCH FROM (fin - now())) / 86400.0 AS d FROM suscripciones WHERE id = $1",
    [asig.suscripcion.id]
  )).d)
  assert.ok(diasAsig > 89 && diasAsig < 91)
})

test('circuito antiguo retirado y bandeja admin de pagos priorizada y bajo demanda', () => {
  const legacyRoute = readFileSync('src/app/api/comprar-creditos/route.ts', 'utf8')
  assert.match(legacyRoute, /status:\s*410/)
  assert.match(legacyRoute, /DEPRECATED_CHECKOUT/)
  assert.doesNotMatch(legacyRoute, /transacciones_creditos'\)\.insert/)

  const tabCreditos = readFileSync('src/app/[locale]/dashboard/components/tabs/TabCreditos.tsx', 'utf8')
  assert.doesNotMatch(tabCreditos, /\/api\/comprar-creditos/)
  assert.doesNotMatch(tabCreditos, /04126443099|V20794917/)
  assert.match(tabCreditos, /\/pagos\?creditos=/)

  const adminPagos = readFileSync('src/app/api/admin/pagos/route.ts', 'utf8')
  assert.match(adminPagos, /ascending:\s*oldestFirst/)
  assert.match(adminPagos, /params\.get\(['"]firmar['"]\)/)
})

test.after(async () => {
  await db.close()
})
