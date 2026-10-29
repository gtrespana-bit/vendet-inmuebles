-- Vista de lectura pública y de gestión propia para propiedades.
-- No se conceden permisos de escritura sobre esta vista.
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

  -- Operación / tipo de inmueble
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

  -- Ubicación (nombres y claves para las páginas localizadas)
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

  -- Precio y características
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

  -- Estado, moderación y promoción
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

  -- Multimedia
  coalesce(media.imagenes, '[]'::jsonb) AS imagenes,
  coalesce(media.imagenes_urls, ARRAY[]::text[]) AS imagenes_urls,
  coalesce(media.imagenes_json, '[]'::jsonb) AS imagenes_json,
  coalesce(media.imagenes_urls[1], i.imagen_url) AS imagen_portada,
  coalesce(media.imagenes_urls[1], i.imagen_url) AS main_image_url,
  coalesce(media.imagenes_urls[1], i.imagen_url) AS imagen_url,
  coalesce(media.imagenes_urls, ARRAY[]::text[]) AS images,
  i.video_url,
  i.virtual_tour_url,
  coalesce(amenities.caracteristicas, '[]'::jsonb) AS caracteristicas,

  -- Datos de contacto públicos. El email sólo se expone si el propietario lo permite.
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
  p.empresa_nombre AS agencia_nombre,
  p.empresa_nombre AS agency_name,
  p.logo_url AS agency_logo,
  p.logo_url AS agency_logo_url,

  -- Alias para componentes antiguos que aún muestran categorías genéricas.
  coalesce(i.categoria_id, i.tipo_id) AS categoria_id,
  i.subcategoria,
  i.marca,
  i.modelo,

  -- SEO y fechas
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
  'Vista de lectura de inmuebles con nombres, imágenes y datos públicos del propietario. Los registros inactivos sólo se muestran a su propietario o a administradores.';

GRANT SELECT ON public.vw_propiedades_publicas TO anon, authenticated, service_role;

-- Perfil público de vendedores: nunca expone saldo, cédula ni datos de Pago Móvil.
CREATE OR REPLACE VIEW public.vw_perfiles_publicos
WITH (security_barrier = true, security_invoker = false)
AS
SELECT
  p.id,
  p.nombre,
  p.telefono,
  p.estado,
  p.ciudad,
  p.foto_perfil_url,
  p.email_visible AS email_disponible,
  CASE WHEN p.email_visible THEN p.email ELSE NULL END AS email_publico,
  (p.telefono IS NOT NULL AND btrim(p.telefono) <> '') AS telefono_disponible,
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
  'Datos de perfil seleccionados para páginas públicas de vendedores. No incluye saldo, cédula ni datos de pago.';
GRANT SELECT ON public.vw_perfiles_publicos TO anon, authenticated, service_role;
