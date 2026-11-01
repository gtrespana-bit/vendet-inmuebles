-- 013 · Privacidad de contacto y ubicación en las vistas públicas (F05)
--
-- Problema comprobado en la auditoría: el teléfono del perfil se publicaba
-- aunque el anuncio eligiera «solo chat», y la vista incluía dirección exacta y
-- coordenadas con precisión total para cualquiera.
--
-- Reglas que aplica esta migración (mismas columnas, mismos tipos y orden):
--   * Teléfono del anuncio: solo se publica si el anuncio no configura
--     métodos (anuncios anteriores a la elección) o si eligió teléfono/WhatsApp.
--     El propietario y la administración siempre lo ven.
--   * Teléfono del perfil público: solo si el vendedor eligió teléfono/WhatsApp
--     en al menos un anuncio publicado, o si es el propio vendedor/admin.
--   * Dirección exacta: nula para el público. «zona» y ciudad siguen públicas.
--   * Coordenadas: redondeadas a 3 decimales (≈100 m) para el público; exactas
--     para el propietario y la administración.
--
-- No borra datos, no pausa anuncios y no cambia el esquema de las tablas.

BEGIN;

-- Elección explícita del anuncio. `metodos_contacto` NULL = anuncio anterior a
-- esta configuración: se conserva el comportamiento histórico.
CREATE OR REPLACE FUNCTION public.telefono_visible_anuncio(p_metodos jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT p_metodos IS NULL
      OR (p_metodos ? 'telefono')
      OR (p_metodos ? 'whatsapp');
$$;
COMMENT ON FUNCTION public.telefono_visible_anuncio(jsonb) IS
  'true si el anuncio permite que su teléfono sea público (o no configuró métodos).';
REVOKE ALL ON FUNCTION public.telefono_visible_anuncio(jsonb) FROM PUBLIC, anon, authenticated;

-- ¿Algún anuncio publicado del vendedor permite contacto telefónico?
CREATE OR REPLACE FUNCTION public.perfil_admite_contacto_telefonico(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inmuebles i
    WHERE i.usuario_id = p_user
      AND i.activo AND NOT i.vendido AND i.estado_moderacion = 'aprobado'
      AND public.telefono_visible_anuncio(i.metodos_contacto)
  );
$$;
COMMENT ON FUNCTION public.perfil_admite_contacto_telefonico(uuid) IS
  'true si alguna publicación pública del vendedor permite contacto por teléfono o WhatsApp.';
REVOKE ALL ON FUNCTION public.perfil_admite_contacto_telefonico(uuid) FROM PUBLIC, anon, authenticated;

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
  CASE WHEN i.usuario_id = auth.uid() OR public.is_admin()
    THEN i.direccion_exacta END AS direccion_exacta,
  CASE WHEN i.usuario_id = auth.uid() OR public.is_admin()
    THEN i.direccion_exacta END AS direccion,
  CASE WHEN i.usuario_id = auth.uid() OR public.is_admin()
    THEN i.latitud ELSE round(i.latitud, 3)::numeric(10,7) END AS latitud,
  CASE WHEN i.usuario_id = auth.uid() OR public.is_admin()
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
  CASE WHEN i.usuario_id = auth.uid() OR public.is_admin()
    OR public.telefono_visible_anuncio(i.metodos_contacto)
    THEN p.telefono END AS seller_telefono,
  CASE WHEN i.usuario_id = auth.uid() OR public.is_admin()
    OR public.telefono_visible_anuncio(i.metodos_contacto)
    THEN p.telefono END AS propietario_telefono,
  CASE WHEN i.usuario_id = auth.uid() OR public.is_admin()
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
  i.metodos_contacto AS metodos_contacto_publicacion
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

COMMENT ON VIEW public.vw_propiedades_publicas IS
  'Lectura pública de inmuebles. El teléfono solo aparece si el anuncio lo permite; dirección exacta y coordenadas exactas solo para el propietario y la administración.';
GRANT SELECT ON public.vw_propiedades_publicas TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_perfiles_publicos
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  p.id,
  p.nombre,
  CASE WHEN p.id = auth.uid() OR public.is_admin()
    OR public.perfil_admite_contacto_telefonico(p.id)
    THEN p.telefono END AS telefono,
  p.estado,
  p.ciudad,
  p.foto_perfil_url,
  p.email_visible AS email_disponible,
  CASE WHEN p.email_visible THEN p.email ELSE NULL END AS email_publico,
  (p.telefono IS NOT NULL AND btrim(p.telefono) <> ''
    AND (p.id = auth.uid() OR public.is_admin()
      OR public.perfil_admite_contacto_telefonico(p.id))) AS telefono_disponible,
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
  (SELECT count(*)::integer FROM public.inmuebles i
    WHERE i.usuario_id = p.id AND i.vendido) AS total_vendidas,
  greatest(0, floor(extract(epoch FROM (now() - p.creado_en)) / 86400))::integer AS antiguedad_dias
FROM public.perfiles p
WHERE p.verificado OR EXISTS (
  SELECT 1 FROM public.inmuebles i
  WHERE i.usuario_id = p.id
    AND i.activo
    AND NOT i.vendido
    AND i.estado_moderacion = 'aprobado'
);

COMMENT ON VIEW public.vw_perfiles_publicos IS
  'Perfil público del vendedor. El teléfono solo se publica si alguna de sus publicaciones permite contacto telefónico.';
GRANT SELECT ON public.vw_perfiles_publicos TO anon, authenticated, service_role;

COMMIT;
