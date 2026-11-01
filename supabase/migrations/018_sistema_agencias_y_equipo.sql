-- ============================================================================
-- 018_sistema_agencias_y_equipo.sql
-- Sistema completo de Agencia y Equipo de Agentes:
--   1. Restricción de 1 agencia por dueño y 1 membresía activa por usuario.
--   2. Tabla `agencia_invitaciones` (token hash SHA-256, expiración, estado).
--   3. Permisos RLS para que agentes asignados y admins de agencia gestionen
--      los inmuebles asignados sin poder eliminar ni secuestrar la propiedad.
--   4. Ampliación retrocompatible de `vw_propiedades_publicas` y
--      `vw_perfiles_publicos` con metadatos del agente asignado y su agencia.
--   5. RPCs atómicas: `transferir_creditos_agencia`,
--      `desvincular_miembro_agencia`, y soporte en `usar_boost`/`usar_destacado`
--      para créditos propios asignados al agente.
--   6. Auto-provisión de `agencias` en `handle_new_auth_user()` y backfill.
-- ============================================================================

BEGIN;

-- 1. Unicidad de una agencia por propietario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'agencias_owner_id_unique'
       AND conrelid = 'public.agencias'::regclass
  ) THEN
    ALTER TABLE public.agencias
      ADD CONSTRAINT agencias_owner_id_unique UNIQUE (owner_id);
  END IF;
END $$;

-- 2. Estado de membresía y unicidad de agencia activa por usuario
ALTER TABLE public.agencia_miembros
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'agencia_miembros_estado_check'
       AND conrelid = 'public.agencia_miembros'::regclass
  ) THEN
    ALTER TABLE public.agencia_miembros
      ADD CONSTRAINT agencia_miembros_estado_check
      CHECK (estado IN ('activo', 'suspendido'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agencia_miembros_active_user
  ON public.agencia_miembros (user_id)
  WHERE estado = 'activo';

-- 3. Columnas de agencia/agente en conversaciones (idempotente)
ALTER TABLE public.conversaciones
  ADD COLUMN IF NOT EXISTS agencia_id uuid REFERENCES public.agencias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agente_asignado_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inmuebles_agencia_id ON public.inmuebles(agencia_id);
CREATE INDEX IF NOT EXISTS idx_inmuebles_agente_asignado_id ON public.inmuebles(agente_asignado_id);

-- 4. Tabla de invitaciones de agencia (solo se guarda hash SHA-256 del token)
CREATE TABLE IF NOT EXISTS public.agencia_invitaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id uuid NOT NULL REFERENCES public.agencias(id) ON DELETE CASCADE,
  email text,
  rol text NOT NULL DEFAULT 'agente' CHECK (rol IN ('admin', 'agente')),
  token_hash text NOT NULL UNIQUE,
  invitado_por uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'revocada', 'expirada')),
  aceptada_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  aceptada_en timestamptz,
  expira_en timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agencia_invitaciones_agencia_estado
  ON public.agencia_invitaciones (agencia_id, estado);

ALTER TABLE public.agencia_invitaciones ENABLE ROW LEVEL SECURITY;

-- 5. Funciones auxiliares de autorización de equipo
CREATE OR REPLACE FUNCTION public.es_admin_de_agencia(p_agencia_id uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_agencia_id IS NULL OR p_actor IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.agencias a
       WHERE a.id = p_agencia_id AND a.owner_id = p_actor
    ) OR EXISTS (
      SELECT 1 FROM public.agencia_miembros am
       WHERE am.agencia_id = p_agencia_id
         AND am.user_id = p_actor
         AND am.estado = 'activo'
         AND am.rol = 'admin'
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.es_admin_de_agencia(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.puede_gestionar_inmueble_agencia(
  p_agencia_id uuid,
  p_agente_id uuid,
  p_actor uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_agencia_id IS NULL OR p_actor IS NULL THEN false
    ELSE public.es_admin_de_agencia(p_agencia_id, p_actor)
      OR (
        p_agente_id = p_actor
        AND EXISTS (
          SELECT 1 FROM public.agencia_miembros am
           WHERE am.agencia_id = p_agencia_id
             AND am.user_id = p_actor
             AND am.estado = 'activo'
        )
      )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.puede_gestionar_inmueble_agencia(uuid, uuid, uuid) TO anon, authenticated, service_role;

-- 6. Políticas RLS actualizadas para agencias, miembros, invitaciones e inmuebles
DROP POLICY IF EXISTS "Dueños pueden insertar agencias" ON public.agencias;
CREATE POLICY "Dueños pueden insertar agencias"
  ON public.agencias FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "Dueños pueden actualizar agencias" ON public.agencias;
CREATE POLICY "Dueños pueden actualizar agencias"
  ON public.agencias FOR UPDATE
  USING (auth.uid() = owner_id OR public.es_admin_de_agencia(id, auth.uid()) OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.es_admin_de_agencia(id, auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Admins pueden gestionar miembros" ON public.agencia_miembros;
CREATE POLICY "Admins pueden gestionar miembros"
  ON public.agencia_miembros FOR ALL
  USING (public.es_admin_de_agencia(agencia_id, auth.uid()) OR public.is_admin())
  WITH CHECK (public.es_admin_de_agencia(agencia_id, auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Admins de agencia gestionan invitaciones" ON public.agencia_invitaciones;
CREATE POLICY "Admins de agencia gestionan invitaciones"
  ON public.agencia_invitaciones FOR ALL
  USING (public.es_admin_de_agencia(agencia_id, auth.uid()) OR public.is_admin())
  WITH CHECK (public.es_admin_de_agencia(agencia_id, auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "inmuebles_select_publico_o_propietario" ON public.inmuebles;
CREATE POLICY "inmuebles_select_publico_o_propietario"
  ON public.inmuebles FOR SELECT
  USING (
    (activo AND NOT vendido AND estado_moderacion = 'aprobado')
    OR auth.uid() = usuario_id
    OR public.puede_gestionar_inmueble_agencia(agencia_id, agente_asignado_id, auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "inmuebles_update_propietario" ON public.inmuebles;
CREATE POLICY "inmuebles_update_propietario"
  ON public.inmuebles FOR UPDATE
  USING (
    auth.uid() = usuario_id
    OR public.puede_gestionar_inmueble_agencia(agencia_id, agente_asignado_id, auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = usuario_id
    OR (
      agencia_id IS NOT NULL
      AND usuario_id = (SELECT a.owner_id FROM public.agencias a WHERE a.id = agencia_id)
      AND public.puede_gestionar_inmueble_agencia(agencia_id, agente_asignado_id, auth.uid())
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "inmueble_imagenes_select_publico" ON public.inmueble_imagenes;
CREATE POLICY "inmueble_imagenes_select_publico"
  ON public.inmueble_imagenes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_imagenes.inmueble_id
         AND (
           (i.activo AND NOT i.vendido AND i.estado_moderacion = 'aprobado')
           OR i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  );

DROP POLICY IF EXISTS "inmueble_imagenes_insert_propietario" ON public.inmueble_imagenes;
CREATE POLICY "inmueble_imagenes_insert_propietario"
  ON public.inmueble_imagenes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_imagenes.inmueble_id
         AND (
           i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  );

DROP POLICY IF EXISTS "inmueble_imagenes_update_propietario" ON public.inmueble_imagenes;
CREATE POLICY "inmueble_imagenes_update_propietario"
  ON public.inmueble_imagenes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_imagenes.inmueble_id
         AND (
           i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_imagenes.inmueble_id
         AND (
           i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  );

DROP POLICY IF EXISTS "inmueble_imagenes_delete_propietario" ON public.inmueble_imagenes;
CREATE POLICY "inmueble_imagenes_delete_propietario"
  ON public.inmueble_imagenes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_imagenes.inmueble_id
         AND (
           i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  );

DROP POLICY IF EXISTS "inmueble_caracteristicas_select_publico" ON public.inmueble_caracteristicas;
CREATE POLICY "inmueble_caracteristicas_select_publico"
  ON public.inmueble_caracteristicas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_caracteristicas.inmueble_id
         AND (
           (i.activo AND NOT i.vendido AND i.estado_moderacion = 'aprobado')
           OR i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  );

DROP POLICY IF EXISTS "inmueble_caracteristicas_insert_propietario" ON public.inmueble_caracteristicas;
CREATE POLICY "inmueble_caracteristicas_insert_propietario"
  ON public.inmueble_caracteristicas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_caracteristicas.inmueble_id
         AND (
           i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  );

DROP POLICY IF EXISTS "inmueble_caracteristicas_delete_propietario" ON public.inmueble_caracteristicas;
CREATE POLICY "inmueble_caracteristicas_delete_propietario"
  ON public.inmueble_caracteristicas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.inmuebles i
       WHERE i.id = inmueble_caracteristicas.inmueble_id
         AND (
           i.usuario_id = auth.uid()
           OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
           OR public.is_admin()
         )
    )
  );

-- 7. Backfill de agencias para cuentas existentes con tipo_cuenta = 'agencia' o plan 'agencia'
INSERT INTO public.agencias (nombre, descripcion, logo_url, owner_id)
SELECT
  coalesce(nullif(btrim(p.empresa_nombre), ''), nullif(btrim(p.nombre), ''), 'Agencia Inmobiliaria'),
  p.descripcion_agente,
  coalesce(p.logo_url, p.foto_perfil_url),
  p.id
FROM public.perfiles p
WHERE (
  p.tipo_cuenta = 'agencia'
  OR EXISTS (
    SELECT 1 FROM public.suscripciones s
     WHERE s.user_id = p.id
       AND s.plan = 'agencia'
       AND s.estado IN ('activa', 'trial')
  )
)
AND NOT EXISTS (
  SELECT 1 FROM public.agencias a WHERE a.owner_id = p.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.agencia_miembros am WHERE am.user_id = p.id AND am.estado = 'activo'
)
ON CONFLICT (owner_id) DO NOTHING;

INSERT INTO public.agencia_miembros (agencia_id, user_id, rol, estado)
SELECT a.id, a.owner_id, 'admin', 'activo'
FROM public.agencias a
WHERE NOT EXISTS (
  SELECT 1 FROM public.agencia_miembros am
   WHERE am.user_id = a.owner_id AND am.estado = 'activo'
)
ON CONFLICT (agencia_id, user_id) DO UPDATE
  SET rol = 'admin', estado = 'activo';

UPDATE public.inmuebles i
   SET agencia_id = a.id,
       agente_asignado_id = coalesce(i.agente_asignado_id, a.owner_id)
  FROM public.agencias a
 WHERE i.usuario_id = a.owner_id
   AND i.agencia_id IS NULL;

-- 8. Vistas públicas ampliadas (conservando exactamente el orden y tipos de las columnas previas)
CREATE OR REPLACE VIEW public.vw_propiedades_publicas
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
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
    THEN i.direccion_exacta END AS direccion_exacta,
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
    THEN i.direccion_exacta END AS direccion,
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
    THEN i.latitud ELSE round(i.latitud, 3)::numeric(10,7) END AS latitud,
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
    THEN i.longitud ELSE round(i.longitud, 3)::numeric(10,7) END AS longitud,
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
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
         OR public.telefono_visible_anuncio(i.metodos_contacto)
    THEN p.telefono END AS seller_telefono,
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
         OR public.telefono_visible_anuncio(i.metodos_contacto)
    THEN p.telefono END AS propietario_telefono,
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
         OR public.telefono_visible_anuncio(i.metodos_contacto)
    THEN p.telefono END AS owner_phone,
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
  i.actualizado_en AS last_activity,
  i.metodos_contacto,
  i.metodos_contacto AS metodos_contacto_publicacion,
  -- Columnas añadidas al final en 018 para atribución de agencia y agente asignado
  p.slug AS propietario_slug,
  pa.nombre AS agente_nombre,
  pa.foto_perfil_url AS agente_foto,
  pa.verificado AS agente_verificado,
  pa.slug AS agente_slug,
  CASE WHEN i.usuario_id = auth.uid()
         OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
         OR public.is_admin()
         OR public.telefono_visible_anuncio(i.metodos_contacto)
    THEN pa.telefono END AS agente_telefono,
  CASE WHEN pa.email_visible THEN pa.email ELSE NULL END AS agente_email
FROM public.inmuebles AS i
LEFT JOIN public.operaciones AS o ON o.id = i.operacion_id
LEFT JOIN public.tipos_inmueble AS t ON t.id = i.tipo_id
LEFT JOIN public.perfiles AS p ON p.id = i.usuario_id
LEFT JOIN public.agencias AS ag ON ag.id = i.agencia_id
LEFT JOIN public.perfiles AS pa ON pa.id = i.agente_asignado_id
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
  OR public.puede_gestionar_inmueble_agencia(i.agencia_id, i.agente_asignado_id, auth.uid())
  OR public.is_admin();

GRANT SELECT ON public.vw_propiedades_publicas TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_perfiles_publicos
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.nombre,
  CASE
    WHEN p.id = auth.uid() OR public.is_admin() OR (EXISTS (
      SELECT 1
        FROM public.inmuebles i
       WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
         AND i.activo
         AND NOT i.vendido
         AND i.estado_moderacion = 'aprobado'::text
         AND public.telefono_visible_anuncio(i.metodos_contacto)
    )) THEN p.telefono
    ELSE NULL::text
  END AS telefono,
  p.estado,
  p.ciudad,
  p.foto_perfil_url,
  p.email_visible AS email_disponible,
  CASE
    WHEN p.email_visible THEN p.email
    ELSE NULL::text
  END AS email_publico,
  p.telefono IS NOT NULL AND btrim(p.telefono) <> ''::text AND (
    p.id = auth.uid() OR public.is_admin() OR (EXISTS (
      SELECT 1
        FROM public.inmuebles i
       WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
         AND i.activo
         AND NOT i.vendido
         AND i.estado_moderacion = 'aprobado'::text
         AND public.telefono_visible_anuncio(i.metodos_contacto)
    ))
  ) AS telefono_disponible,
  p.whatsapp_disponible,
  p.verificado,
  p.verificado_desde,
  p.nivel_confianza,
  p.badges_automaticos,
  p.ultima_actividad,
  p.creado_en,
  p.tipo_cuenta,
  p.empresa_nombre,
  p.descripcion_agente,
  p.logo_url,
  (
    SELECT count(*)::integer
      FROM public.inmuebles i
     WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
       AND i.vendido
  ) AS total_vendidas,
  GREATEST(0::numeric, floor(EXTRACT(epoch FROM now() - p.creado_en) / 86400::numeric))::integer AS antiguedad_dias,
  p.slug,
  ag_ctx.agencia_id AS miembro_agencia_id,
  ag_ctx.agencia_nombre AS miembro_agencia_nombre,
  ag_ctx.agencia_slug AS miembro_agencia_slug,
  ag_ctx.agencia_owner_id AS miembro_agencia_owner_id
FROM public.perfiles p
LEFT JOIN LATERAL (
  SELECT
    a.id AS agencia_id,
    a.nombre AS agencia_nombre,
    po.slug AS agencia_slug,
    a.owner_id AS agencia_owner_id
  FROM public.agencia_miembros am
  JOIN public.agencias a ON a.id = am.agencia_id
  JOIN public.perfiles po ON po.id = a.owner_id
  WHERE am.user_id = p.id
    AND am.estado = 'activo'
  LIMIT 1
) ag_ctx ON true
WHERE p.verificado
   OR ag_ctx.agencia_id IS NOT NULL
   OR (EXISTS (
     SELECT 1
       FROM public.inmuebles i
      WHERE (i.usuario_id = p.id OR i.agente_asignado_id = p.id)
        AND i.activo
        AND NOT i.vendido
        AND i.estado_moderacion = 'aprobado'::text
   ));

GRANT SELECT ON public.vw_perfiles_publicos TO anon, authenticated, service_role;

-- 9. RPC atómica: transferir créditos del dueño de la agencia a un agente de su equipo
CREATE OR REPLACE FUNCTION public.transferir_creditos_agencia(
  p_actor_id uuid,
  p_agente_id uuid,
  p_cantidad integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_agencia public.agencias%ROWTYPE;
  v_es_miembro boolean;
  v_res record;
  v_nuevo_saldo_agente numeric(12,2);
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cantidad de créditos inválida');
  END IF;

  IF p_actor_id = p_agente_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No puedes transferirte créditos a ti mismo');
  END IF;

  SELECT * INTO v_agencia
    FROM public.agencias
   WHERE owner_id = p_actor_id
   FOR UPDATE;

  IF v_agencia.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el titular de la agencia puede asignar créditos');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agencia_miembros
     WHERE agencia_id = v_agencia.id
       AND user_id = p_agente_id
       AND estado = 'activo'
  ) INTO v_es_miembro;

  IF NOT v_es_miembro THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El usuario no es un miembro activo de tu agencia');
  END IF;

  SELECT * INTO v_res FROM public.consumir_creditos_usuario(p_actor_id, p_cantidad);
  IF NOT coalesce(v_res.ok, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_res.error, 'La agencia no tiene créditos suficientes'));
  END IF;

  UPDATE public.perfiles
     SET credito_balance = coalesce(credito_balance, 0) + p_cantidad,
         actualizado_en = now()
   WHERE id = p_agente_id
   RETURNING credito_balance INTO v_nuevo_saldo_agente;

  INSERT INTO public.transacciones_creditos (
    user_id, tipo, monto, precio_usd, metodo_pago, estado, motivo_registro, aprobado_en, aprobado_por
  ) VALUES
    (
      p_actor_id,
      'asignacion_agencia_enviada',
      p_cantidad,
      0,
      'agencia_interna',
      'aprobado',
      format('Créditos asignados a agente %s (%s)', p_agente_id, v_agencia.nombre),
      now(),
      p_actor_id
    ),
    (
      p_agente_id,
      'asignacion_agencia_recibida',
      p_cantidad,
      0,
      'agencia_interna',
      'aprobado',
      format('Créditos recibidos de agencia %s', v_agencia.nombre),
      now(),
      p_actor_id
    );

  RETURN jsonb_build_object(
    'ok', true,
    'agente_balance', coalesce(v_nuevo_saldo_agente, 0),
    'agencia_balance_comprados', v_res.balance_comprados,
    'agencia_creditos_plan_restantes', v_res.restantes_plan,
    'agencia_creditos_disponibles', v_res.total_disponible
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transferir_creditos_agencia(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transferir_creditos_agencia(uuid, uuid, integer) TO authenticated, service_role;

-- 10. RPC atómica: desvincular miembro reasignando toda su cartera a otro agente o al dueño
CREATE OR REPLACE FUNCTION public.desvincular_miembro_agencia(
  p_actor_id uuid,
  p_miembro_user_id uuid,
  p_reasignar_a uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_miembro public.agencia_miembros%ROWTYPE;
  v_agencia public.agencias%ROWTYPE;
  v_destino uuid;
  v_reasignados integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_actor_id
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_miembro
    FROM public.agencia_miembros
   WHERE user_id = p_miembro_user_id
     AND estado = 'activo'
   FOR UPDATE;

  IF v_miembro.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Miembro activo no encontrado');
  END IF;

  SELECT * INTO v_agencia
    FROM public.agencias
   WHERE id = v_miembro.agencia_id
   FOR UPDATE;

  IF v_agencia.owner_id = p_miembro_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El titular principal de la agencia no puede desvincularse');
  END IF;

  -- Puede ejecutarlo el dueño/admin de la agencia o el propio agente al salir voluntariamente
  IF p_actor_id <> p_miembro_user_id
     AND NOT public.es_admin_de_agencia(v_agencia.id, p_actor_id)
     AND NOT public.is_admin()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No tienes permisos para desvincular a este agente');
  END IF;

  -- Si un admin (no dueño) intenta expulsar a otro admin, solo el dueño puede hacerlo
  IF v_miembro.rol = 'admin'
     AND p_actor_id <> p_miembro_user_id
     AND p_actor_id <> v_agencia.owner_id
     AND NOT public.is_admin()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solo el dueño de la agencia puede desvincular a un administrador');
  END IF;

  v_destino := coalesce(p_reasignar_a, v_agencia.owner_id);
  IF v_destino = p_miembro_user_id THEN
    v_destino := v_agencia.owner_id;
  END IF;

  IF v_destino <> v_agencia.owner_id AND NOT EXISTS (
    SELECT 1 FROM public.agencia_miembros
     WHERE agencia_id = v_agencia.id
       AND user_id = v_destino
       AND estado = 'activo'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'El agente destino debe pertenecer activamente a la agencia');
  END IF;

  UPDATE public.inmuebles
     SET agente_asignado_id = v_destino,
         actualizado_en = now()
   WHERE agencia_id = v_agencia.id
     AND agente_asignado_id = p_miembro_user_id;
  GET DIAGNOSTICS v_reasignados = ROW_COUNT;

  UPDATE public.conversaciones
     SET agente_asignado_id = v_destino,
         actualizado_en = now()
   WHERE agencia_id = v_agencia.id
     AND agente_asignado_id = p_miembro_user_id;

  DELETE FROM public.agencia_miembros WHERE id = v_miembro.id;

  RETURN jsonb_build_object(
    'ok', true,
    'inmuebles_reasignados', v_reasignados,
    'reasignado_a', v_destino
  );
END;
$$;

REVOKE ALL ON FUNCTION public.desvincular_miembro_agencia(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desvincular_miembro_agencia(uuid, uuid, uuid) TO authenticated, service_role;

-- 11. Permitir a agentes asignados usar SUS propios créditos asignados en `usar_boost` y `usar_destacado`
CREATE OR REPLACE FUNCTION public.usar_boost(
  p_producto_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_owner uuid;
  v_agencia_id uuid;
  v_agente_id uuid;
  v_res record;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  SELECT usuario_id, agencia_id, agente_asignado_id
    INTO v_owner, v_agencia_id, v_agente_id
    FROM public.inmuebles
   WHERE id = p_producto_id AND activo = true
   FOR UPDATE;

  IF NOT FOUND OR (
    v_owner <> p_user_id
    AND NOT public.puede_gestionar_inmueble_agencia(v_agencia_id, v_agente_id, p_user_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Publicación no encontrada o inactiva');
  END IF;

  -- Siempre descuenta del saldo de quien ejecuta la acción (`p_user_id`),
  -- de modo que los agentes solo consumen los créditos que el dueño les haya asignado.
  SELECT * INTO v_res FROM public.consumir_creditos_usuario(p_user_id, 1);
  IF NOT coalesce(v_res.ok, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_res.error, 'No tienes créditos suficientes'));
  END IF;

  UPDATE public.inmuebles
     SET boosteado_en = now(), actualizado_en = now()
   WHERE id = p_producto_id;

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_res.balance_comprados,
    'creditos_plan_restantes', v_res.restantes_plan,
    'creditos_disponibles', v_res.total_disponible
  );
END;
$$;

REVOKE ALL ON FUNCTION public.usar_boost(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usar_boost(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.usar_destacado(
  p_producto_id uuid,
  p_user_id uuid,
  p_horas integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_owner uuid;
  v_agencia_id uuid;
  v_agente_id uuid;
  v_destacado boolean;
  v_destacado_hasta timestamptz;
  v_creditos integer;
  v_base timestamptz;
  v_fin timestamptz;
  v_res record;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
  END IF;

  v_creditos := CASE p_horas WHEN 12 THEN 4 WHEN 24 THEN 6 WHEN 48 THEN 10 ELSE 0 END;
  IF v_creditos = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Duración de destacado no válida');
  END IF;

  SELECT usuario_id, agencia_id, agente_asignado_id, destacado, destacado_hasta
    INTO v_owner, v_agencia_id, v_agente_id, v_destacado, v_destacado_hasta
    FROM public.inmuebles
   WHERE id = p_producto_id AND activo = true
   FOR UPDATE;

  IF NOT FOUND OR (
    v_owner <> p_user_id
    AND NOT public.puede_gestionar_inmueble_agencia(v_agencia_id, v_agente_id, p_user_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Publicación no encontrada o inactiva');
  END IF;

  SELECT * INTO v_res FROM public.consumir_creditos_usuario(p_user_id, v_creditos);
  IF NOT coalesce(v_res.ok, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', coalesce(v_res.error, 'No tienes créditos suficientes'));
  END IF;

  v_base := CASE
    WHEN v_destacado IS TRUE AND v_destacado_hasta IS NOT NULL AND v_destacado_hasta > now()
      THEN v_destacado_hasta
    ELSE now()
  END;
  v_fin := v_base + make_interval(hours => p_horas);

  UPDATE public.inmuebles
     SET destacado = true,
         destacado_hasta = v_fin,
         actualizado_en = now()
   WHERE id = p_producto_id;

  INSERT INTO public.destacados (producto_id, user_id, inicio, fin, pagado, creditos_usados)
  VALUES (p_producto_id, p_user_id, now(), v_fin, true, v_creditos);

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_res.balance_comprados,
    'creditos_plan_restantes', v_res.restantes_plan,
    'creditos_disponibles', v_res.total_disponible,
    'destacado_hasta', v_fin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.usar_destacado(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usar_destacado(uuid, uuid, integer) TO authenticated, service_role;

-- 12. Auto-crear registro en `agencias` y `agencia_miembros` al registrar cuenta Agencia
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_tipo text := nullif(btrim(coalesce(v_meta ->> 'tipo_cuenta', '')), '');
  v_plan text := nullif(btrim(coalesce(v_meta ->> 'plan', '')), '');
  v_trial_dias integer := 30;
  v_fin timestamptz;
  v_empresa text;
  v_nombre text;
  v_agencia_id uuid;
BEGIN
  IF v_tipo IS NULL OR v_tipo NOT IN ('particular', 'profesional', 'agencia') THEN
    v_tipo := 'particular';
  END IF;

  IF v_plan IS NULL OR v_plan NOT IN ('gratuita', 'profesional', 'agencia') THEN
    v_plan := CASE v_tipo
      WHEN 'agencia' THEN 'agencia'
      WHEN 'profesional' THEN 'profesional'
      ELSE 'gratuita'
    END;
  END IF;

  v_fin := now() + make_interval(days => v_trial_dias);
  v_nombre := coalesce(
    nullif(btrim(coalesce(v_meta ->> 'nombre_completo', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'nombre', '')), '')
  );
  v_empresa := nullif(btrim(coalesce(v_meta ->> 'empresa_nombre', '')), '');

  INSERT INTO public.perfiles (
    id, nombre, email, telefono, estado, ciudad, tipo_cuenta, empresa_nombre, licencia_corredor
  )
  VALUES (
    NEW.id,
    v_nombre,
    NEW.email,
    nullif(btrim(coalesce(v_meta ->> 'telefono', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'estado', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'ciudad', '')), ''),
    v_tipo,
    v_empresa,
    nullif(btrim(coalesce(v_meta ->> 'licencia_corredor', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nombre = coalesce(nullif(public.perfiles.nombre, ''), EXCLUDED.nombre),
        telefono = coalesce(public.perfiles.telefono, EXCLUDED.telefono),
        estado = coalesce(public.perfiles.estado, EXCLUDED.estado),
        ciudad = coalesce(public.perfiles.ciudad, EXCLUDED.ciudad),
        tipo_cuenta = EXCLUDED.tipo_cuenta,
        empresa_nombre = coalesce(public.perfiles.empresa_nombre, EXCLUDED.empresa_nombre),
        licencia_corredor = coalesce(public.perfiles.licencia_corredor, EXCLUDED.licencia_corredor);

  INSERT INTO public.suscripciones (
    user_id, plan, estado, inicio, fin, trial_ends_at,
    creditos_incluidos, creditos_usados_mes, proxima_renovacion_creditos
  )
  SELECT
    NEW.id,
    v_plan,
    'trial',
    now(),
    v_fin,
    v_fin,
    CASE v_plan WHEN 'profesional' THEN 5 WHEN 'agencia' THEN 20 ELSE 0 END,
    0,
    v_fin
  WHERE NOT EXISTS (
    SELECT 1 FROM public.suscripciones s WHERE s.user_id = NEW.id
  );

  IF v_tipo = 'agencia' OR v_plan = 'agencia' THEN
    INSERT INTO public.agencias (nombre, owner_id)
    VALUES (coalesce(v_empresa, v_nombre, 'Agencia Inmobiliaria'), NEW.id)
    ON CONFLICT (owner_id) DO UPDATE
      SET actualizado_en = now()
    RETURNING id INTO v_agencia_id;

    IF v_agencia_id IS NOT NULL THEN
      INSERT INTO public.agencia_miembros (agencia_id, user_id, rol, estado)
      VALUES (v_agencia_id, NEW.id, 'admin', 'activo')
      ON CONFLICT (agencia_id, user_id) DO UPDATE
        SET rol = 'admin', estado = 'activo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

COMMIT;
