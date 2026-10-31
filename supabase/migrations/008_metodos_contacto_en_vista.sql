-- 008: exponer metodos_contacto en la vista pública de propiedades
--
-- La ficha del anuncio (/inmueble/[id]) lee vw_propiedades_publicas y muestra
-- los métodos de contacto elegidos al publicar (chat siempre activo + teléfono
-- para llamadas y/o teléfono para WhatsApp, opcionales) como botones tel: y
-- wa.me con mensaje pre-escrito.
--
-- Se recrea la vista de la migración 003 añadiendo metodos_contacto al final
-- de la lista de columnas (CREATE OR REPLACE VIEW solo permite añadir columnas
-- al final). Los GRANT existentes se conservan.

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

GRANT SELECT ON public.vw_propiedades_publicas TO anon, authenticated, service_role;
