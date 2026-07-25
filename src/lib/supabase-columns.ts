/**
 * CONFIGURACIÓN CENTRALIZADA DE COLUMNAS DE SUPABASE
 * 
 * Este archivo define EXACTAMENTE las columnas que existen en la vista `vw_propiedades_publicas`.
 * Úsalo para garantizar que todas las consultas .select() coincidan con la BD real.
 * 
 * Última verificación: 25/07/2026
 */

// Lista BLANCA de columnas existentes en vw_propiedades_publicas
export const VALID_PROPERTY_COLUMNS = [
  'id',
  'titulo',
  'descripcion',
  'precio',
  'moneda',
  'ciudad',
  'estado',
  'municipio',
  'zona',
  'area_total',
  'area_construida',
  'habitaciones',
  'banos',
  'puestos_estacionamiento',
  'piso',
  'condicion',
  'antiguedad_anios',
  'latitud',
  'longitud',
  'direccion_exacta',
  'slug',
  'activo',
  'destacado',
  'visitas',
  'creado_en',
  'actualizado_en',
  'publicado_en',
  'operacion_nombre',
  'operacion_slug',
  'tipo_nombre',
  'tipo_slug',
  'tipo_icono',
  'propietario_nombre',
  'propietario_telefono',
  'propietario_email',
  'propietario_foto',
  'propietario_verificado',
  'propietario_tipo',
  'propietario_empresa',
  'main_image_url',
  'imagenes',
  'caracteristicas'
] as const;

// Columnas permitidas para filtrar (WHERE)
export const FILTERABLE_COLUMNS = [
  'activo',
  'ciudad',
  'estado',
  'operacion_nombre', // Antes operation_type
  'tipo_nombre',      // Antes tipo_propiedad
  'precio',
  'habitaciones',
  'banos',
  'area_total'
];

// Columnas permitidas para ordenar (ORDER)
export const SORTABLE_COLUMNS = [
  'creado_en',
  'precio',
  'visitas',
  'titulo'
];

// Mapeo de nombres antiguos (frontend) -> nombres reales (BD)
export const COLUMN_MAPPING: Record<string, string> = {
  // Precios
  'price': 'precio',
  'precio_usd': 'precio',
  
  // Ubicaciones
  'city': 'ciudad',
  'ubicacion_ciudad': 'ciudad',
  'state': 'estado',
  
  // Características físicas
  'bedrooms': 'habitaciones',
  'bathrooms': 'banos',
  'area_size': 'area_total',
  'area': 'area_total',
  
  // Tipos y Operaciones
  'operation_type': 'operacion_nombre',
  'operacion_tipo': 'operacion_nombre',
  'tipo_propiedad': 'tipo_nombre',
  
  // Imágenes
  'imagen_url': 'main_image_url',
  'imagenes_urls': 'imagenes',
  'images': 'imagenes'
  // NOTA: Las siguientes columnas NO EXISTEN en la vista y deben ser ignoradas en los filtros:
  // - estado_moderacion
  // - boosteado_en
  // - destacado_hasta
  // - categoria_id
  // - subcategoria
  // - marca
  // El frontend debe filtrar estos campos después de obtener los datos, no en la consulta SQL
};

// Verifica si una columna existe realmente
export function isValidColumn(col: string): boolean {
  return VALID_PROPERTY_COLUMNS.includes(col as any);
}

// Obtiene el nombre real de una columna (o null si no existe)
export function getRealColumnName(col: string): string | null {
  if (VALID_PROPERTY_COLUMNS.includes(col as any)) {
    return col;
  }
  return COLUMN_MAPPING[col] || null;
}
