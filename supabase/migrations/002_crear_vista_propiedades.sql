-- ============================================
-- VISTA vw_propiedades_publicas (ACTUALIZADA)
-- Esta vista une todas las tablas relacionadas con inmuebles
-- para facilitar las consultas desde el frontend
-- ============================================

-- Eliminar vista si existe
DROP VIEW IF EXISTS vw_propiedades_publicas CASCADE;

CREATE OR REPLACE VIEW vw_propiedades_publicas AS
SELECT 
  i.id,
  i.usuario_id as user_id,
  i.titulo,
  i.descripcion,
  i.slug,
  
  -- Operación (venta/alquiler)
  o.nombre as tipo_operacion,
  o.slug as operacion_slug,
  o.slug as operation_type,  -- Legacy para compatibilidad
  
  -- Tipo de inmueble
  t.nombre as tipo_propiedad,
  t.slug as tipo_slug,
  t.slug as property_type,  -- Legacy para compatibilidad
  
  -- Ubicación
  i.estado as state_name,
  i.estado,
  i.ciudad as city_name,
  i.ciudad,
  i.ciudad as ubicacion_ciudad,
  i.estado as ubicacion_estado,
  i.municipio as municipality_name,
  i.direccion_exacta as direccion,
  i.latitud,
  i.longitud,
  i.zona,
  
  -- Precio
  i.precio,
  i.precio as price,  -- Legacy
  i.precio as precio_usd,  -- Legacy
  i.moneda as currency,
  
  -- Características físicas
  i.area_total as area_size,
  i.area_total as area,  -- Legacy
  i.area_construida,
  i.habitaciones as bedrooms,
  i.banos as bathrooms,
  i.puestos_estacionamiento as parking_spaces,
  i.piso as floors,
  i.condicion,
  i.antiguedad_anios as year_built,
  
  -- Estado y moderación
  i.activo,
  i.destacado,
  i.visitas,
  i.creado_en,
  i.actualizado_en,
  i.publicado_en,
  true as estado_moderacion,  -- Simulado como aprobado para todos los activos
  true as estado_aprobacion,  -- Alias
  'aprobado' as moderacion_estado,  -- Texto para compatibilidad
  
  -- Campos legacy para destacados/boost
  null as boosteado_en,
  i.destacado as destacado_hasta,
  false as vendido,
  null as vendido_en,
  null as comprador_id,
  
  -- Imágenes como JSON array ordenado (URLs simples)
  COALESCE(
    (
      SELECT json_agg(ii.url_imagen ORDER BY ii.orden, ii.es_portada DESC)
      FROM inmueble_imagenes ii
      WHERE ii.inmueble_id = i.id
    ),
    '[]'::json
  ) as imagenes,
  
  -- Array simple de URLs de imágenes
  COALESCE(
    (
      SELECT array_agg(ii.url_imagen ORDER BY ii.orden, ii.es_portada DESC)
      FROM inmueble_imagenes ii
      WHERE ii.inmueble_id = i.id
    ),
    ARRAY[]::text[]
  ) as imagenes_urls,
  
  -- Imágenes como JSON con objetos completos
  COALESCE(
    (
      SELECT json_agg(json_build_object('url_imagen', ii.url_imagen, 'orden', ii.orden, 'es_portada', ii.es_portada) ORDER BY ii.orden, ii.es_portada DESC)
      FROM inmueble_imagenes ii
      WHERE ii.inmueble_id = i.id
    ),
    '[]'::json
  ) as imagenes_json,
  
  -- URL de la imagen de portada (primera imagen o null)
  (
    SELECT ii.url_imagen
    FROM inmueble_imagenes ii
    WHERE ii.inmueble_id = i.id
    ORDER BY ii.orden, ii.es_portada DESC
    LIMIT 1
  ) as imagen_portada,
  
  -- Alias para compatibilidad con frontend
  (
    SELECT ii.url_imagen
    FROM inmueble_imagenes ii
    WHERE ii.inmueble_id = i.id
    ORDER BY ii.orden, ii.es_portada DESC
    LIMIT 1
  ) as main_image_url,
  
  -- Imagen URL alternativa
  (
    SELECT ii.url_imagen
    FROM inmueble_imagenes ii
    WHERE ii.inmueble_id = i.id
    ORDER BY ii.orden, ii.es_portada DESC
    LIMIT 1
  ) as imagen_url,
  
  -- Images array alias
  COALESCE(
    (
      SELECT array_agg(ii.url_imagen ORDER BY ii.orden, ii.es_portada DESC)
      FROM inmueble_imagenes ii
      WHERE ii.inmueble_id = i.id
    ),
    ARRAY[]::text[]
  ) as images,
  
  -- Características como JSON
  COALESCE(
    (
      SELECT json_agg(c.nombre)
      FROM inmueble_caracteristicas ic
      JOIN caracteristicas c ON ic.caracteristica_id = c.id
      WHERE ic.inmueble_id = i.id
    ),
    '[]'::json
  ) as caracteristicas,
  
  -- Datos del propietario desde perfiles
  p.nombre as owner_name,
  p.nombre as propietario_nombre,
  p.telefono as owner_phone,
  p.telefono as propietario_telefono,
  p.email as owner_email,
  p.email as propietario_email,
  p.foto_perfil_url,
  p.verificado,
  p.nivel_confianza,
  p.empresa_nombre as agency_name,
  p.logo_url as agency_logo_url,
  
  -- Categoría y subcategoría (legacy, para compatibilidad)
  t.id as categoria_id,
  null as subcategoria,
  null as marca,
  
  -- Visitas y estadísticas
  i.visitas as views_count,
  0 as contacts_count,
  0 as favorites_count,
  
  -- Última actividad
  i.actualizado_en as last_activity,
  i.publicado_en as published_at,
  i.creado_en as created_at,
  i.actualizado_en as updated_at
  
FROM inmuebles i
LEFT JOIN operaciones o ON i.operacion_id = o.id
LEFT JOIN tipos_inmueble t ON i.tipo_id = t.id
LEFT JOIN perfiles p ON i.usuario_id = p.id
WHERE i.activo = true;

-- Grant permissions
GRANT SELECT ON vw_propiedades_publicas TO public;
GRANT SELECT ON vw_propiedades_publicas TO authenticated;

-- Comment
COMMENT ON VIEW vw_propiedades_publicas IS 'Vista pública de propiedades activas con imágenes y datos relacionados';
