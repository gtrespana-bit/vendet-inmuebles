-- ============================================
-- VERIFICAR Y RECREAR VISTA vw_propiedades_publicas
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Verificar si existen las tablas base
SELECT 
    table_name,
    CASE WHEN table_name = 'inmuebles' THEN '✓' ELSE '✗' END as inmuebles,
    CASE WHEN table_name = 'operaciones' THEN '✓' ELSE '✗' END as operaciones,
    CASE WHEN table_name = 'tipos_inmueble' THEN '✓' ELSE '✗' END as tipos_inmueble,
    CASE WHEN table_name = 'inmueble_imagenes' THEN '✓' ELSE '✗' END as inmueble_imagenes,
    CASE WHEN table_name = 'perfiles' THEN '✓' ELSE '✗' END as perfiles
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('inmuebles', 'operaciones', 'tipos_inmueble', 'inmueble_imagenes', 'perfiles');

-- 2. Verificar datos en cada tabla
SELECT 'inmuebles' as tabla, count(*) as registros FROM inmuebles
UNION ALL
SELECT 'operaciones', count(*) FROM operaciones
UNION ALL
SELECT 'tipos_inmueble', count(*) FROM tipos_inmueble
UNION ALL
SELECT 'inmueble_imagenes', count(*) FROM inmueble_imagenes
UNION ALL
SELECT 'perfiles', count(*) FROM perfiles;

-- 3. Verificar si existe la vista
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%propiedades%';

-- 4. Recrear la vista (ejecutar si no existe o está desactualizada)
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
  
  -- Tipo de inmueble
  t.nombre as tipo_propiedad,
  t.slug as tipo_slug,
  
  -- Ubicación
  i.estado,
  i.ciudad,
  i.municipio,
  i.direccion_exacta as direccion,
  i.latitud,
  i.longitud,
  i.zona,
  
  -- Precio
  i.precio,
  i.moneda,
  
  -- Características físicas
  i.area_total as area_size,
  i.area_construida,
  i.habitaciones as bedrooms,
  i.banos as bathrooms,
  i.puestos_estacionamiento,
  i.piso as floors,
  i.condicion,
  i.antiguedad_anios,
  
  -- Estado
  i.activo,
  i.destacado,
  i.visitas,
  i.creado_en,
  i.actualizado_en,
  i.publicado_en,
  
  -- Imágenes como JSON array ordenado (urls solas)
  COALESCE(
    (
      SELECT json_agg(ii.url_imagen ORDER BY ii.orden, ii.es_portada DESC)
      FROM inmueble_imagenes ii
      WHERE ii.inmueble_id = i.id
    ),
    '[]'::json
  ) as imagenes,
  
  -- URL de la imagen de portada (primera imagen o null)
  (
    SELECT ii.url_imagen
    FROM inmueble_imagenes ii
    WHERE ii.inmueble_id = i.id
    ORDER BY ii.orden, ii.es_portada DESC
    LIMIT 1
  ) as imagen_portada,
  
  -- Imágenes como JSON con objetos completos
  COALESCE(
    (
      SELECT json_agg(json_build_object('url_imagen', ii.url_imagen, 'orden', ii.orden, 'es_portada', ii.es_portada) ORDER BY ii.orden, ii.es_portada DESC)
      FROM inmueble_imagenes ii
      WHERE ii.inmueble_id = i.id
    ),
    '[]'::json
  ) as imagenes_json,
  
  -- Array simple de URLs de imágenes
  COALESCE(
    (
      SELECT array_agg(ii.url_imagen ORDER BY ii.orden, ii.es_portada DESC)
      FROM inmueble_imagenes ii
      WHERE ii.inmueble_id = i.id
    ),
    ARRAY[]::text[]
  ) as imagenes_urls,
  
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
  p.nombre as propietario_nombre,
  p.telefono as propietario_telefono,
  p.email as propietario_email,
  p.foto_perfil_url,
  p.verificado,
  p.nivel_confianza,
  p.empresa_nombre,
  p.logo_url,
  
  -- Campos legacy para compatibilidad (mapeados)
  i.precio as price,
  o.slug as operation_type,
  t.slug as property_type,
  i.ciudad as city,
  i.estado as state,
  i.ciudad as ubicacion_ciudad,
  i.area_total as area,
  i.habitaciones,
  i.banos,
  
  -- Campos para moderación y destacados
  true as estado_moderacion,
  null as boosteado_en,
  null as destacado_hasta,
  null as vendido,
  null as vendido_en,
  null as comprador_id
  
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

-- 5. Verificar que la vista funciona
SELECT 
    id, 
    titulo, 
    activo, 
    imagen_portada,
    json_array_length(imagenes) as num_imagenes,
    city,
    state,
    price
FROM vw_propiedades_publicas 
ORDER BY creado_en DESC 
LIMIT 10;
