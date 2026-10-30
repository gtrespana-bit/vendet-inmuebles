-- 2026-10-30_cuenta_agencia_tuinmueble.sql
--
-- Cuenta de agencia "TuInmueble" + asignación de las 50 fichas de demostración.
--
-- Estado en el proyecto quxbqmqwiacfwbpqioev: YA APLICADO por SQL directo
-- (execute_query) el 2026-10-30. Este archivo deja el cambio reproducible.
--
-- La contraseña NO se guarda aquí: se pasa por variable de psql
--   \set pw 'la-contraseña'
-- o se sustituye el marcador :'pw' antes de ejecutar el archivo.
-- También se puede completar después con la API de admin de Supabase.
--
-- Requisitos previos:
--   * migración 001 (perfiles, inmuebles) y 002 (vw_propiedades_publicas) aplicadas.
--   * pgcrypto disponible en el esquema extensions (lo está por defecto en Supabase).
--   * Las 50 fichas de supabase/seeds/2026-10-30_propiedades_demo.sql insertadas.

begin;

-- 1. Vocabulario de cuentas y planes: se mantienen los valores antiguos para no
--    romper el formulario de verificación, y se añaden los nuevos de la migración 003.
alter table public.perfiles drop constraint if exists perfiles_tipo_cuenta_check;
alter table public.perfiles add constraint perfiles_tipo_cuenta_check
  check (tipo_cuenta in ('personal', 'agente', 'inmobiliaria', 'particular', 'profesional', 'agencia'));

alter table public.suscripciones drop constraint if exists suscripciones_plan_check;
alter table public.suscripciones add constraint suscripciones_plan_check
  check (plan in ('personal', 'agente', 'inmobiliaria', 'premium', 'gratuita', 'profesional', 'agencia'));

-- 2. Modelo de agencias (003)
create table if not exists public.agencias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  logo_url text,
  owner_id uuid not null references public.perfiles(id) on delete cascade,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists idx_agencias_owner_id on public.agencias(owner_id);

create table if not exists public.agencia_miembros (
  id uuid primary key default gen_random_uuid(),
  agencia_id uuid not null references public.agencias(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  rol text not null default 'agente' check (rol in ('admin', 'agente')),
  creado_en timestamptz not null default now(),
  unique (agencia_id, user_id)
);
create index if not exists idx_agencia_miembros_user_id on public.agencia_miembros(user_id);

alter table public.suscripciones
  add column if not exists creditos_incluidos integer not null default 0,
  add column if not exists creditos_usados_mes integer not null default 0,
  add column if not exists proxima_renovacion_creditos timestamptz;

alter table public.inmuebles
  add column if not exists agencia_id uuid references public.agencias(id) on delete set null,
  add column if not exists agente_asignado_id uuid references public.perfiles(id) on delete set null,
  add column if not exists plano_url text;

alter table public.agencias enable row level security;
alter table public.agencia_miembros enable row level security;

drop policy if exists "Agencias visibles para todos" on public.agencias;
create policy "Agencias visibles para todos" on public.agencias for select using (true);
drop policy if exists "Dueños pueden actualizar agencias" on public.agencias;
create policy "Dueños pueden actualizar agencias" on public.agencias for update using (auth.uid() = owner_id);
drop policy if exists "Miembros visibles para todos" on public.agencia_miembros;
create policy "Miembros visibles para todos" on public.agencia_miembros for select using (true);
drop policy if exists "Admins pueden gestionar miembros" on public.agencia_miembros;
create policy "Admins pueden gestionar miembros" on public.agencia_miembros for all using (
  exists (select 1 from public.agencias a where a.id = agencia_miembros.agencia_id and a.owner_id = auth.uid())
);

-- 3. Usuario de la agencia. El id es fijo para que el resto del archivo sea idempotente.
--    El trigger on_auth_user_created_vendet crea la fila en public.perfiles.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
  'authenticated', 'authenticated', 'gtrespana@gmail.com',
  extensions.crypt(:'pw', extensions.gen_salt('bf', 10)),
  now(), now(), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(
    'sub', '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
    'email', 'gtrespana@gmail.com',
    'nombre', 'TuInmueble',
    'email_verified', true,
    'phone_verified', false
  ),
  '', '', '', ''
where not exists (select 1 from auth.users where email = 'gtrespana@gmail.com');

insert into auth.identities (id, provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
  '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
  'email',
  jsonb_build_object(
    'sub', '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
    'email', 'gtrespana@gmail.com',
    'nombre', 'TuInmueble',
    'email_verified', true,
    'phone_verified', false
  ),
  now(), now(), now()
where not exists (
  select 1 from auth.identities where provider_id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0'
);

-- 4. Perfil con tipo de cuenta de agencia.
update public.perfiles set
  nombre = 'TuInmueble',
  email = 'gtrespana@gmail.com',
  tipo_cuenta = 'agencia',
  empresa_nombre = 'TuInmueble',
  descripcion_agente = 'Agencia inmobiliaria con presencia en Valencia, San Diego y Caracas. Venta y alquiler de apartamentos, casas y townhouses verificados.',
  estado = 'Carabobo',
  ciudad = 'Valencia',
  verificado = true,
  verificado_desde = now(),
  nivel_confianza = 3,
  whatsapp_disponible = true
where id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0';

-- 5. Agencia y membresía de administrador.
insert into public.agencias (nombre, descripcion, owner_id)
select
  'TuInmueble',
  'Agencia inmobiliaria con presencia en Valencia, San Diego y Caracas. Venta y alquiler de apartamentos, casas y townhouses verificados.',
  '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0'
where not exists (
  select 1 from public.agencias where owner_id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0'
);

insert into public.agencia_miembros (agencia_id, user_id, rol)
select a.id, '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0', 'admin'
from public.agencias a
where a.owner_id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0'
on conflict (agencia_id, user_id) do nothing;

-- 6. Suscripción con el plan de agencia (publicaciones ilimitadas).
insert into public.suscripciones (
  user_id, plan, estado, inicio, fin,
  creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos
)
select
  '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
  'agencia', 'activa', now(), now() + interval '1 year',
  20, 0, now() + interval '1 month'
where not exists (
  select 1 from public.suscripciones where user_id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0'
);

-- 7. Las 50 fichas de demostración pasan a la agencia.
update public.inmuebles
set usuario_id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
    agente_asignado_id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0',
    agencia_id = (
      select id from public.agencias
      where owner_id = '5c0e7b2f-8a41-4d96-b3f7-2e19c4d8a6b0'
      limit 1
    )
where imagen_url like '/propiedades/prop-%';

commit;
