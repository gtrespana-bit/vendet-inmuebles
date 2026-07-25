# Esquema Completo de la Base de Datos - Supabase

## Tablas y Columnas Detectadas

### 1. `caracteristicas`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | integer | NO | auto_increment | Primary Key |
| nombre | varchar | NO | - | Unique |
| slug | varchar | NO | - | Unique |
| categoria | varchar | YES | 'general' | - |
| icono | varchar | YES | - | - |

### 2. `destacados`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| producto_id | uuid | NO | - | FK -> inmuebles.id |
| user_id | uuid | NO | - | FK -> auth.users.id |
| inicio | timestamptz | NO | now() | - |
| fin | timestamptz | NO | - | - |
| pagado | boolean | YES | false | - |
| pago_id | uuid | YES | - | FK -> pagos.id |
| created_at | timestamptz | NO | now() | - |

### 3. `inmueble_caracteristicas` (Tabla intermedia)
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| inmueble_id | uuid | NO | - | Primary Key (compuesta) |
| caracteristica_id | integer | NO | - | Primary Key (compuesta) |

### 4. `inmueble_imagenes`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| inmueble_id | uuid | NO | - | FK -> inmuebles.id |
| url_imagen | text | NO | - | URL de la imagen |
| orden | integer | YES | 0 | Orden de visualización |
| es_portada | boolean | YES | false | Indica si es imagen principal |
| creado_en | timestamptz | YES | now() | - |

### 5. `inmuebles`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| usuario_id | uuid | NO | - | FK -> auth.users.id / perfiles.id |
| titulo | varchar | NO | - | Título del inmueble |
| descripcion | text | YES | - | Descripción detallada |
| operacion_id | integer | YES | - | FK -> operaciones.id |
| tipo_id | integer | YES | - | FK -> tipos_inmueble.id |
| estado | varchar | NO | - | Estado geográfico |
| ciudad | varchar | NO | - | Ciudad |
| municipio | varchar | YES | - | Municipio |
| direccion_exacta | text | YES | - | Dirección completa |
| latitud | numeric | YES | - | Coordenada Y |
| longitud | numeric | YES | - | Coordenada X |
| zona | varchar | YES | - | Zona específica |
| precio | numeric | NO | - | Precio |
| moneda | varchar | YES | 'USD' | Moneda del precio |
| area_total | numeric | YES | - | Área total (m²) |
| area_construida | numeric | YES | - | Área construida (m²) |
| habitaciones | integer | YES | 0 | Número de habitaciones |
| banos | integer | YES | 0 | Número de baños |
| puestos_estacionamiento | integer | YES | 0 | Puestos de estacionamiento |
| piso | integer | YES | - | Piso/Número de planta |
| condicion | varchar | YES | 'Bueno' | Condición del inmueble |
| antiguedad_anios | integer | YES | - | Años de antigüedad |
| destacado | boolean | YES | false | ¿Es destacado? |
| activo | boolean | YES | true | ¿Está activo/publicado? |
| visitas | integer | YES | 0 | Contador de visitas |
| creado_en | timestamptz | YES | now() | Fecha de creación |
| actualizado_en | timestamptz | YES | now() | Fecha de actualización |
| publicado_en | timestamptz | YES | - | Fecha de publicación |
| slug | text | YES | - | Slug único para URLs |

### 6. `mensajes`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| remitente_id | uuid | YES | - | FK -> auth.users.id |
| destinatario_id | uuid | YES | - | FK -> auth.users.id |
| producto_id | uuid | YES | - | FK -> inmuebles.id |
| mensaje | text | NO | - | Contenido del mensaje |
| leido | boolean | YES | false | ¿Leído? |
| creado_en | timestamptz | YES | now() | - |

### 7. `niveles_vendedor`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | integer | NO | auto_increment | Primary Key |
| nombre_nivel | text | YES | - | Nombre del nivel |
| min_ventas | integer | YES | - | Ventas mínimas requeridas |
| min_puntuacion | numeric | YES | - | Puntuación mínima |
| beneficios | jsonb | YES | - | Beneficios en JSON |

### 8. `operaciones`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | integer | NO | auto_increment | Primary Key |
| nombre | varchar | NO | - | Nombre (ej: Venta, Alquiler) |
| slug | varchar | NO | - | Slug único |
| activo | boolean | YES | true | ¿Activo? |

### 9. `pagos`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| user_id | uuid | NO | - | FK -> auth.users.id |
| suscripcion_id | uuid | YES | - | FK -> suscripciones.id |
| monto_usd | numeric | NO | - | Monto en USD |
| concepto | text | NO | - | Concepto del pago |
| metodo_pago | text | YES | - | Método utilizado |
| referencia | text | YES | - | Referencia externa |
| estado | text | YES | 'pendiente' | Estado del pago |
| notas | text | YES | - | Notas adicionales |
| created_at | timestamptz | NO | now() | - |
| aprobado_en | timestamptz | YES | - | Fecha de aprobación |

### 10. `perfiles`
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | uuid | NO | - | Primary Key (FK -> auth.users.id) |
| nombre | text | YES | - | Nombre completo |
| email | text | YES | - | Correo electrónico |
| telefono | text | YES | - | Teléfono |
| estado | text | YES | - | Estado geográfico |
| ciudad | text | YES | - | Ciudad |
| credito_balance | numeric | YES | 0 | Saldo de créditos |
| verificado | boolean | YES | false | ¿Verificado? |
| nivel_confianza | integer | YES | 0 | Nivel de confianza (0-100) |
| foto_perfil_url | text | YES | - | URL de foto de perfil |
| badges_automaticos | jsonb | YES | '[]' | Badges en JSON |
| ultima_actividad | timestamptz | YES | now() | Última actividad |
| creado_en | timestamptz | YES | now() | Fecha de creación |
| tipo_cuenta | text | YES | 'personal' | personal/empresa |
| empresa_nombre | text | YES | - | Nombre de empresa |
| licencia_corredor | text | YES | - | Licencia de corredor |
| descripcion_agente | text | YES | - | Descripción como agente |
| logo_url | text | YES | - | URL del logo |

### 11. `profiles` (Tabla legacy o duplicada)
| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| id | uuid | NO | - | Primary Key |
| email | text | YES | - | - |
| full_name | text | YES | - | - |
| avatar_url | text | YES | - | - |

*Nota: Parece haber dos tablas de perfiles. Se recomienda usar `perfiles` como principal.*

### 12. `suscripciones` (Falta en el dump, pero mencionada en RLS)
*Se asume estructura basada en RLS:*
| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid | Primary Key |
| user_id | uuid | FK -> auth.users.id |
| plan | text | Plan contratado |
| estado | text | Estado |
| inicio | timestamptz | Fecha inicio |
| fin | timestamptz | Fecha fin |
| trial_ends_at | timestamptz | Fin de prueba |
| created_at | timestamptz | - |
| updated_at | timestamptz | - |

### 13. `tipos_inmueble` (Falta en el dump, pero mencionada en RLS y FK)
*Se asume estructura basada en descripción inicial:*
| Columna | Tipo | Notas |
|---------|------|-------|
| id | integer | Primary Key |
| nombre | varchar | Unique |
| slug | varchar | Unique |
| icono | varchar | Nullable |
| activo | boolean | Nullable |

---

## Relaciones Clave (Foreign Keys implícitas)

1. **inmuebles.usuario_id** → **perfiles.id** / **auth.users.id**
2. **inmuebles.operacion_id** → **operaciones.id**
3. **inmuebles.tipo_id** → **tipos_inmueble.id**
4. **inmueble_imagenes.inmueble_id** → **inmuebles.id**
5. **inmueble_caracteristicas.inmueble_id** → **inmuebles.id**
6. **inmueble_caracteristicas.caracteristica_id** → **caracteristicas.id**
7. **destacados.producto_id** → **inmuebles.id**
8. **destacados.user_id** → **perfiles.id**
9. **mensajes.remitente_id/destinatario_id** → **perfiles.id**
10. **mensajes.producto_id** → **inmuebles.id**
11. **pagos.user_id** → **perfiles.id**
12. **pagos.suscripcion_id** → **suscripciones.id**

---

## Vistas Conocidas

### `vw_propiedades_publicas`
*Vista crítica para el frontend. Debe incluir:*
- Todos los campos de `inmuebles`
- `operacion_nombre` y `operacion_slug` desde `operaciones`
- `tipo_nombre` y `tipo_slug` desde `tipos_inmueble`
- `main_image_url`: Primera imagen (es_portada=true OR orden=0) desde `inmueble_imagenes`
- `imagenes`: Array de todas las imágenes desde `inmueble_imagenes`
- `propietario_nombre`, `propietario_telefono`, `propietario_email` desde `perfiles`

---

## Problemas Identificados

1. **Tablas faltantes en el dump**: `suscripciones` y `tipos_inmueble` no aparecieron en la consulta, pero son necesarias.
2. **Duplicidad de perfiles**: Existencia de `profiles` y `perfiles`.
3. **Imágenes nulas**: Los inmuebles no tienen registros en `inmueble_imagenes`.
4. **Vista posiblemente desactualizada**: La vista `vw_propiedades_publicas` podría no estar uniendo correctamente con `inmueble_imagenes`.

---

## Recomendaciones Inmediatas

1. Verificar existencia de `tipos_inmueble` y `suscripciones`.
2. Unificar o eliminar tabla `profiles` en favor de `perfiles`.
3. Recrear vista `vw_propiedades_publicas` con JOIN correcto a `inmueble_imagenes`.
4. Insertar imágenes de prueba o asegurar que el frontend use `/sinimagen.webp` cuando `main_image_url` sea NULL.
