// Archivo de referencia para corregir las consultas del dashboard
// Las consultas deben usar los nombres de columnas correctos de vw_propiedades_publicas

// Consulta CORRECTA para obtener productos del usuario:
supabase
  .from('vw_propiedades_publicas')
  .select('id, titulo, price, estado, city, state, activo, visitas, creado_en, main_image_url, operation_type, destacado, destacado_hasta, boosteado_en, estado_moderacion')
  .eq('user_id', user.id)
  .order('creado_en', { ascending: false })

// Columnas disponibles en vw_propiedades_publicas:
// - id, user_id, titulo, descripcion, slug
// - tipo_operacion, operacion_slug, operation_type
// - tipo_propiedad, tipo_slug, property_type
// - state_name, estado, city_name, ciudad, ubicacion_ciudad, ubicacion_estado, municipality_name
// - precio, price, precio_usd, currency
// - area_size, area, area_construida, bedrooms, bathrooms, parking_spaces, floors, year_built
// - activo, destacado, visitas, creado_en, actualizado_en, publicado_en
// - estado_moderacion, estado_aprobacion, moderacion_estado
// - imagenes, imagenes_urls, imagenes_json, imagen_portada, main_image_url, imagen_url, images
// - owner_name, propietario_nombre, owner_phone, owner_email, etc.
