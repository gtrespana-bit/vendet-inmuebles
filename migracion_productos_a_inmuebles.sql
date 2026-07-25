-- ============================================================
-- MIGRACIÓN DE PRODUCTOS A INMUEBLES
-- ============================================================
-- Este script migra los datos de la tabla 'productos' a la tabla 'inmuebles'
-- manteniendo la integridad referencial y creando registros en tablas relacionadas
-- ============================================================

BEGIN;

-- 1. Asegurar que existen las operaciones necesarias
INSERT INTO operaciones (nombre, slug, activo)
SELECT DISTINCT 
  CASE 
    WHEN LOWER(p.operacion_tipo) = 'venta' THEN 'Venta'
    WHEN LOWER(p.operacion_tipo) = 'alquiler' THEN 'Alquiler'
    ELSE INITCAP(p.operacion_tipo)
  END as nombre,
  CASE 
    WHEN LOWER(p.operacion_tipo) = 'venta' THEN 'venta'
    WHEN LOWER(p.operacion_tipo) = 'alquiler' THEN 'alquiler'
    ELSE LOWER(p.operacion_tipo)
  END as slug,
  true as activo
FROM productos p
WHERE p.operacion_tipo IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

-- 2. Asegurar que existen los tipos de inmueble necesarios
INSERT INTO tipos_inmueble (nombre, slug, icono, activo)
SELECT DISTINCT 
  INITCAP(p.tipo_propiedad) as nombre,
  LOWER(REPLACE(p.tipo_propiedad, ' ', '-')) as slug,
  'home' as icono,
  true as activo
FROM productos p
WHERE p.tipo_propiedad IS NOT NULL 
  AND p.tipo_propiedad != ''
ON CONFLICT (slug) DO NOTHING;

-- 3. Migrar datos de productos a inmuebles
INSERT INTO inmuebles (
  id,
  usuario_id,
  titulo,
  descripcion,
  operacion_id,
  tipo_id,
  estado,
  ciudad,
  municipio,
  direccion_exacta,
  precio,
  moneda,
  area_total,
  habitaciones,
  banos,
  puestos_estacionamiento,
  destacado,
  activo,
  visitas,
  creado_en,
  actualizado_en,
  publicado_en,
  slug
)
SELECT 
  p.id as id,
  p.user_id as usuario_id,
  COALESCE(p.titulo, 'Sin título') as titulo,
  p.descripcion as descripcion,
  o.id as operacion_id,
  t.id as tipo_id,
  COALESCE(p.state, 'No especificado') as estado,
  COALESCE(p.city, 'No especificado') as ciudad,
  NULL as municipio,
  p.ubicacion_detalles as direccion_exacta,
  COALESCE(p.price, 0) as precio,
  'USD' as moneda,
  p.area_size as area_total,
  p.bedrooms as habitaciones,
  p.bathrooms as banos,
  NULL as puestos_estacionamiento,
  COALESCE(p.destacado, false) as destacado,
  COALESCE(p.activo, false) as activo,
  COALESCE(p.visitas, 0) as visitas,
  COALESCE(p.creado_en, NOW()) as creado_en,
  COALESCE(p.actualizado_en, NOW()) as actualizado_en,
  COALESCE(p.publicado_en, NOW()) as publicado_en,
  COALESCE(p.slug, CONCAT(REPLACE(LOWER(p.titulo), ' ', '-'), '-', LEFT(p.id::text, 8))) as slug
FROM productos p
LEFT JOIN operaciones o ON (
  CASE 
    WHEN LOWER(p.operacion_tipo) = 'venta' THEN 'venta'
    WHEN LOWER(p.operacion_tipo) = 'alquiler' THEN 'alquiler'
    ELSE LOWER(p.operacion_tipo)
  END = o.slug
)
LEFT JOIN tipos_inmueble t ON (
  LOWER(REPLACE(p.tipo_propiedad, ' ', '-')) = t.slug
)
WHERE p.id NOT IN (SELECT id FROM inmuebles);

-- 4. Migrar imágenes de productos a inmueble_imagenes
INSERT INTO inmueble_imagenes (
  id,
  inmueble_id,
  url_imagen,
  orden,
  es_portada,
  creado_en
)
SELECT 
  gen_random_uuid() as id,
  p.id as inmueble_id,
  TRIM(img::text) as url_imagen,
  row_number() OVER (PARTITION BY p.id ORDER BY ordinality) as orden,
  (row_number() OVER (PARTITION BY p.id ORDER BY ordinality) = 1) as es_portada,
  COALESCE(p.creado_en, NOW()) as creado_en
FROM productos p
CROSS JOIN LATERAL unnest(p.images) WITH ORDINALITY as img
WHERE p.images IS NOT NULL 
  AND array_length(p.images, 1) > 0
  AND p.id IN (SELECT id FROM inmuebles);

-- 5. Actualizar contadores y estados
UPDATE inmuebles i
SET 
  actualizado_en = NOW(),
  publicado_en = COALESCE(publicado_en, creado_en)
WHERE i.id IN (SELECT id FROM inmuebles WHERE creado_en > NOW() - INTERVAL '30 days');

COMMIT;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- Ejecutar estas consultas para verificar que la migración fue exitosa

-- Contar registros migrados
SELECT 
  'Productos originales' as tabla, 
  count(*) as cantidad 
FROM productos
UNION ALL
SELECT 
  'Inmuebles migrados', 
  count(*) 
FROM inmuebles
UNION ALL
SELECT 
  'Imágenes migradas', 
  count(*) 
FROM inmueble_imagenes;

-- Verificar detalles de la migración
SELECT 
  i.id,
  i.titulo,
  o.nombre as operacion,
  t.nombre as tipo,
  i.ciudad,
  i.estado,
  i.precio,
  i.habitaciones,
  i.banos,
  i.area_total,
  (SELECT count(*) FROM inmueble_imagenes ii WHERE ii.inmueble_id = i.id) as cantidad_imagenes
FROM inmuebles i
LEFT JOIN operaciones o ON i.operacion_id = o.id
LEFT JOIN tipos_inmueble t ON i.tipo_id = t.id
ORDER BY i.creado_en DESC;
