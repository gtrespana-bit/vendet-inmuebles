-- 003_modelo_planes_agencias.sql

-- 1. Actualizar constraints de tipo de cuenta en perfiles
ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_tipo_cuenta_check;
ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_tipo_cuenta_check CHECK (tipo_cuenta IN ('particular', 'profesional', 'agencia'));
UPDATE public.perfiles SET tipo_cuenta = 'particular' WHERE tipo_cuenta = 'personal';
UPDATE public.perfiles SET tipo_cuenta = 'profesional' WHERE tipo_cuenta = 'agente';
UPDATE public.perfiles SET tipo_cuenta = 'agencia' WHERE tipo_cuenta = 'inmobiliaria';

-- 2. Actualizar constraints de planes en suscripciones
ALTER TABLE public.suscripciones DROP CONSTRAINT IF EXISTS suscripciones_plan_check;
ALTER TABLE public.suscripciones ADD CONSTRAINT suscripciones_plan_check CHECK (plan IN ('gratuita', 'profesional', 'agencia'));
UPDATE public.suscripciones SET plan = 'gratuita' WHERE plan = 'personal' OR plan = 'premium';
UPDATE public.suscripciones SET plan = 'profesional' WHERE plan = 'agente';
UPDATE public.suscripciones SET plan = 'agencia' WHERE plan = 'inmobiliaria';

-- 3. Tabla Agencias (Organizaciones)
CREATE TABLE IF NOT EXISTS public.agencias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    descripcion text,
    logo_url text,
    owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agencias_owner_id ON public.agencias(owner_id);

-- 4. Tabla Miembros de Agencia
CREATE TABLE IF NOT EXISTS public.agencia_miembros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
    rol text NOT NULL DEFAULT 'agente' CHECK (rol IN ('admin', 'agente')),
    creado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE(agencia_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_agencia_miembros_user_id ON public.agencia_miembros(user_id);

-- 5. Añadir campos para créditos y prueba en suscripciones
ALTER TABLE public.suscripciones
ADD COLUMN IF NOT EXISTS creditos_incluidos integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS creditos_usados_mes integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS proxima_renovacion_creditos timestamptz;

-- 6. Ampliar inmuebles y conversaciones para el flujo de agencia
ALTER TABLE public.inmuebles
ADD COLUMN IF NOT EXISTS agencia_id uuid REFERENCES public.agencias(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS agente_asignado_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS plano_url text;

ALTER TABLE public.conversaciones
ADD COLUMN IF NOT EXISTS agencia_id uuid REFERENCES public.agencias(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS agente_asignado_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- 7. RLS para agencias y miembros
ALTER TABLE public.agencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencia_miembros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agencias visibles para todos" ON public.agencias FOR SELECT USING (true);
CREATE POLICY "Dueños pueden actualizar agencias" ON public.agencias FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Miembros visibles para todos" ON public.agencia_miembros FOR SELECT USING (true);
CREATE POLICY "Admins pueden gestionar miembros" ON public.agencia_miembros FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.agencias a WHERE a.id = agencia_miembros.agencia_id AND a.owner_id = auth.uid()
    )
);

-- 8. Relajar campos de pago movil en verificacion
ALTER TABLE public.solicitudes_verificacion ALTER COLUMN pago_movil_telefono DROP NOT NULL;
ALTER TABLE public.solicitudes_verificacion ALTER COLUMN pago_movil_cedula DROP NOT NULL;
ALTER TABLE public.solicitudes_verificacion ALTER COLUMN pago_movil_banco DROP NOT NULL;
ALTER TABLE public.solicitudes_verificacion ADD COLUMN IF NOT EXISTS tipo_cuenta text;

-- 9. Actualizar vista pública de propiedades para incluir campos nuevos
DROP VIEW IF EXISTS public.vw_propiedades_publicas;
CREATE VIEW public.vw_propiedades_publicas
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  i.id,
  i.usuario_id,
  i.usuario_id AS user_id,
  i.titulo,
  i.descripcion,
  i.slug,
  i.agencia_id,
  i.agente_asignado_id,
  o.nombre AS operacion_nombre,
  o.nombre AS operacion_tipo,
  o.slug AS operacion_slug,
  o.slug AS tipo_operacion,
  o.slug AS operation_type,
  t.nombre AS tipo_nombre,
  t.nombre AS tipo_propiedad,
  t.slug AS tipo_slug,
  t.slug AS property_type,
  t.icono AS tipo_icono,
  i.estado AS estado,
  i.estado AS state_name,
  i.estado AS ubicacion_estado,
  i.ciudad AS ciudad,
  i.ciudad AS city_name,
  i.ciudad AS ubicacion_ciudad,
  i.ubicacion_estado_id,
  i.ubicacion_ciudad_id,
  i.municipio,
  i.municipio AS municipality_name,
  i.direccion_exacta,
  i.direccion_exacta AS direccion,
  i.latitud,
  i.longitud,
  i.zona,
  i.precio,
  i.precio AS precio_usd,
  i.precio AS price,
  i.moneda,
  i.moneda AS currency,
  i.area_total,
  i.area_total AS area_size,
  i.area_total AS area,
  i.area_construida,
  i.habitaciones,
  i.habitaciones AS bedrooms,
  i.banos,
  i.banos AS bathrooms,
  i.puestos_estacionamiento,
  i.puestos_estacionamiento AS parking_spaces,
  i.piso,
  i.piso AS floors,
  i.condicion,
  i.antiguedad_anios,
  i.antiguedad_anios AS year_built,
  i.activo,
  i.vendido,
  i.vendido_en,
  i.comprador_id,
  i.estado_moderacion,
  (i.estado_moderacion = 'aprobado') AS estado_aprobacion,
  i.estado_moderacion AS moderacion_estado,
  i.motivo_moderacion,
  i.destacado,
  i.destacado_hasta,
  i.boosteado_en,
  i.visitas,
  i.visitas AS views_count,
  0::integer AS contacts_count,
  0::integer AS favorites_count,
  coalesce(media.imagenes, '[]'::jsonb) AS imagenes,
  coalesce(media.imagenes_urls, ARRAY[]::text[]) AS imagenes_urls,
  coalesce(media.imagenes_json, '[]'::jsonb) AS imagenes_json,
  coalesce(media.imagenes_urls[1], i.imagen_url) AS imagen_portada,
  coalesce(media.imagenes_urls[1], i.imagen_url) AS main_image_url,
  coalesce(media.imagenes_urls[1], i.imagen_url) AS imagen_url,
  coalesce(media.imagenes_urls, ARRAY[]::text[]) AS images,
  i.video_url,
  i.virtual_tour_url,
  i.plano_url,
  coalesce(amenities.caracteristicas, '[]'::jsonb) AS caracteristicas,
  p.nombre AS propietario_nombre,
  p.nombre AS owner_name,
  p.nombre AS seller_nombre,
  p.telefono AS seller_telefono,
  p.telefono AS propietario_telefono,
  p.telefono AS owner_phone,
  CASE WHEN p.email_visible THEN p.email ELSE NULL END AS propietario_email,
  CASE WHEN p.email_visible THEN p.email ELSE NULL END AS owner_email,
  p.foto_perfil_url,
  p.foto_perfil_url AS propietario_foto,
  p.verificado AS propietario_verificado,
  p.verificado AS vendedor_verificado,
  p.nivel_confianza,
  p.tipo_cuenta AS propietario_tipo,
  p.empresa_nombre AS propietario_empresa,
  ag.nombre AS agencia_nombre,
  ag.nombre AS agency_name,
  ag.logo_url AS agency_logo,
  ag.logo_url AS agency_logo_url,
  coalesce(i.categoria_id, i.tipo_id) AS categoria_id,
  i.subcategoria,
  i.marca,
  i.modelo,
  i.meta_titulo,
  i.meta_titulo AS meta_title,
  i.meta_descripcion,
  i.meta_descripcion AS meta_description,
  i.creado_en,
  i.creado_en AS created_at,
  i.actualizado_en,
  i.actualizado_en AS updated_at,
  i.publicado_en,
  i.publicado_en AS published_at,
  i.actualizado_en AS last_activity
FROM public.inmuebles AS i
LEFT JOIN public.operaciones AS o ON o.id = i.operacion_id
LEFT JOIN public.tipos_inmueble AS t ON t.id = i.tipo_id
LEFT JOIN public.perfiles AS p ON p.id = i.usuario_id
LEFT JOIN public.agencias AS ag ON ag.id = i.agencia_id
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(ii.url_imagen ORDER BY ii.es_portada DESC, ii.orden ASC) AS imagenes,
    array_agg(ii.url_imagen ORDER BY ii.es_portada DESC, ii.orden ASC) AS imagenes_urls,
    jsonb_agg(
      jsonb_build_object(
        'url_imagen', ii.url_imagen,
        'orden', ii.orden,
        'es_portada', ii.es_portada
      ) ORDER BY ii.es_portada DESC, ii.orden ASC
    ) AS imagenes_json
  FROM public.inmueble_imagenes AS ii
  WHERE ii.inmueble_id = i.id
) AS media ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(c.nombre ORDER BY c.nombre) AS caracteristicas
  FROM public.inmueble_caracteristicas AS ic
  JOIN public.caracteristicas AS c ON c.id = ic.caracteristica_id
  WHERE ic.inmueble_id = i.id
) AS amenities ON true
WHERE
  (i.activo AND NOT i.vendido AND i.estado_moderacion = 'aprobado')
  OR i.usuario_id = auth.uid()
  OR public.is_admin();

GRANT SELECT ON public.vw_propiedades_publicas TO anon, authenticated, service_role;


