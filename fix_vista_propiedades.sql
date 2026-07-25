-- ============================================
-- VERIFICAR Y CORREGIR VISTA vw_propiedades_publicas
-- ============================================

-- 1. Verificar estructura actual de la vista
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vw_propiedades_publicas'
ORDER BY ordinal_position;

-- 2. Verificar datos en la vista
SELECT 
  id, 
  titulo, 
  activo,
  estado_moderacion,
  tipo_operacion,
  operacion_slug,
  tipo_propiedad,
  tipo_slug,
  ciudad,
  estado,
  precio,
  imagen_portada,
  imagenes_urls,
  imagenes_json
FROM vw_propiedades_publicas 
LIMIT 5;

-- 3. Contar registros
SELECT COUNT(*) as total FROM vw_propiedades_publicas;
SELECT COUNT(*) as activos FROM inmuebles WHERE activo = true;

-- 4. Verificar inmueble_imagenes
SELECT COUNT(*) as total_imagenes FROM inmueble_imagenes;
SELECT inmueble_id, url_imagen, orden, es_portada 
FROM inmueble_imagenes 
ORDER BY creado_en DESC 
LIMIT 10;
