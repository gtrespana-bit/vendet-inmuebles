# Punto 1 — Seguridad, sesiones y cupos: primera entrega

## Estado del despliegue

Implementado y probado en la rama de trabajo. **No desplegado ni aplicado a Supabase real.**
La migración `012_limites_publicacion_en_bd.sql` está lista para revisión/aplicación; mientras no se aplique, las escrituras directas de producción NO cuentan con estos nuevos controles. No se han cambiado saldos, suscripciones, anuncios ni archivos de usuarios reales.

## Cambios

### Dependencias — F01 parcialmente resuelto

- Next 14.2.35 → 15.5.28; next-intl 3 → 4; sharp, Nodemailer y Sentry actualizados.
- Adaptados params/searchParams asíncronos de Next 15, clientes con `useParams`, y configuración de dependencias externas/trazado de OCR.
- Overrides compatibles de `cookie` y PostCSS para no conservar sus versiones vulnerables transitivas; package-lock actualizado, sin `audit fix --force`.
- Auditoría de producción: **12 → 5 paquetes señalados; 0 críticos, 0 altos, 0 bajos, 5 moderados**. Antes: 1 crítico, 5 altos, 4 moderados, 2 bajos.
- Árbol completo: **29 → 21**, todos moderados. No se declara F01 completamente cerrado.
- Los 5 restantes de producción corresponden a glob/minimatch y a sus dependientes de plugins de compilación de Sentry. La integración webpack de Sentry permanece desactivada como antes; no se ha demostrado explotación por una petición de usuario. Requieren seguimiento de versiones/compatibilidad, no una supresión de avisos ni overrides de majors a ciegas.
- Desactivado `dangerouslyAllowSVG` en el optimizador remoto; esto no elimina SVG de iconos locales ni modifica documentos subidos.
- Se conserva el splitting por ruta de Next en vez del bundle global manual: JS inicial compartido medido por build **183 kB**, frente a 204 kB en el build anterior. No equivale a una medición de Core Web Vitals.

### Sesiones — F03/F04 corregidos en código

- Una suscripción de autenticación por montaje; cleanup y remontaje compatibles con Strict Mode.
- La lectura inicial lenta no puede sobrescribir un logout/evento posterior.
- No se vuelve a inyectar el usuario inicial del servidor tras cerrar sesión en el navegador.
- Identidad de servidor obtenida únicamente de `auth.getUser`; **sin fallback de payload JWT sin firma**.
- Timeout de 4 segundos con cancelación de la petición; ante error de red/configuración se deniega acceso.
- Verificación memoizada por render del servidor, no una caché global de usuarios.
- Prueba HTTP con cookie falsificada y backend inaccesible: paneles devuelven redirección de login en el stream; no se interpreta el HTTP 200 del stream como autorización concedida.

### Cupos — F02 preparado; requiere migración 012 en producción

- Triggers de BD para nuevas altas activas, reactivaciones y cambios de propietario: **3/10/999999** anuncios según plan efectivo.
- Fotos por inmueble: **8/20/30**; también al mover una imagen de otro inmueble.
- Perfil bloqueado por cuenta antes de contar e insertar, para serializar consumidores concurrentes del cupo.
- Suscripciones futuras, vencidas o pruebas caducadas no conceden cupo de pago.
- Funciones internas SECURITY DEFINER con search_path fijo y sin EXECUTE para anon/authenticated.
- La migración **no pausa ni elimina inventario existente**. Tras una bajada permite editar/reordenar/reducir inventario previo, pero no incrementarlo por encima del nuevo límite.
- El conteo conserva el criterio vigente de `activo=true`, también si el anuncio está marcado vendido. Cambiar ese criterio es una decisión de producto separada.
- Se han ensayado inserciones directas con rol authenticated, altas múltiples que deben hacer rollback y reejecución de la migración.

### Fotos y panel — parte de F13/F19

- Eliminado el recorte silencioso a 20 fotos al editar.
- Validación del cupo, URLs, pertenencia y duplicados de IDs de imágenes antes de modificar campos.
- La galería existente por encima del nuevo cupo se puede conservar/reordenar, pero no ampliar sin liberar cupo.
- Formulario de edición consulta el límite del servidor; admite Agencia 30 y evita subir lotes que excedan el espacio disponible.
- Alta rechaza el exceso explícitamente en vez de descartar fotos.
- Reactivación de vendido restablece `vendido=false`; pausar/reactivar muestra errores en vez de recargar como si hubiera funcionado.
- **Pendiente:** edición completa transaccional de campos/fotos/características y unificación de formularios. No se declara F13/F19 cerrado íntegramente.

## Validación realizada

- `npm test`: **97/97 pruebas**, más comprobación de traducciones de edición.
- TypeScript y lint: correctos.
- Build Next 15: correcto, con variables Supabase de ejemplo, no una prueba autenticada de producción.
- PostgreSQL real efímero: dos conexiones independientes bloqueadas simultáneamente compiten por el último anuncio y la última foto. En cada caso solo una confirma; la otra falla con `23514`. Conteo final: 3 anuncios / 8 fotos.
- Smoke HTTP local: login ES/EN y pagos disponibles; API sin token 401; paneles con cookie inventada redirigen a login.
- No se han hecho pagos, publicación real ni pruebas con cuentas de clientes. Falta E2E autenticado en staging.

Pruebas de concurrencia opcionales (requieren Python y paquetes externos solo de test):

```sh
python3 -m venv .venv
.venv/bin/pip install pgserver 'psycopg[binary]'
.venv/bin/python tests/security-quota-concurrency.py
```

El servidor se crea y elimina localmente; el test no recibe URL ni credenciales de Supabase.

## Puesta en producción recomendada

1. Revisar PR/diff, backup y preview con las variables reales del entorno de prueba. Verificar login/logout/refresh y una cuenta de cada plan.
2. Desplegar la aplicación compatible con Next 15 y los nuevos errores de cupo.
3. Aplicar migración 012 completa con un rol administrador de migraciones. No ejecutar partes sueltas ni dar EXECUTE de las funciones internas al navegador.
4. Verificar definiciones/activación de ambos triggers, permisos y conteos sin modificar anuncios reales; hacer smoke autorizado con cuentas de prueba.
5. Solo entonces marcar F02 como protegido en producción. La pausa automática del exceso al vencer sigue siendo F11, aún pendiente.

Reversión de emergencia de los triggers, si fuera necesaria:

```sql
BEGIN;
DROP TRIGGER IF EXISTS exigir_cupo_imagen ON public.inmueble_imagenes;
DROP TRIGGER IF EXISTS exigir_cupo_inmueble ON public.inmuebles;
DROP FUNCTION IF EXISTS public.exigir_cupo_imagen();
DROP FUNCTION IF EXISTS public.exigir_cupo_inmueble();
DROP FUNCTION IF EXISTS public.plan_efectivo_publicacion(uuid);
COMMIT;
```

Esta reversión no borra datos, pero **reabre la elusión de cupos**; no debe usarse como solución permanente.

## Trabajo de seguridad que queda

- F01: resolver/seguir avisos moderados restantes sin romper herramientas.
- F05: privacidad real de teléfono/dirección/coordenadas en vistas públicas; acordar contrato de publicación antes de restringir datos utilizados por las fichas.
- F06: validación/reescritura de imágenes y endurecimiento de presigned/diagnóstico R2.
- F07: rate limiting general atómico y política de fallo por operación; revisión controlada de destinos push.
- E2E con navegador, cookies renovadas y cuentas reales de prueba; revisión de MFA/backups/infraestructura.

Esta entrega no implica que toda la seguridad de la web esté resuelta.
