# Registro de remediación — Bloques B, C, D y E

Fecha: 2026-11-01 · Rama: `arena/1b5f7152-vendet-inmuebles` · Proyecto Supabase: `quxbqmqwiacfwbpqioev`

## Resumen de hallazgos resueltos en código y base de datos

### Cierre de F07 (Bloque A)
- **F07 (Rate limit atómico y retención):** aplicada la migración `015_rate_limit_atomico.sql` (`20261101033653`), revocada la ejecución de `reservar_rate_limit` para `PUBLIC`, `anon` y `authenticated`, conectada la limpieza periódica `cleanOldRateLimits()` en `/api/cron/notificaciones-email` y restringida la autenticación del cron exclusivamente a la cabecera `Authorization: Bearer $CRON_SECRET` con comparación en tiempo constante (`timingSafeEqual`), verificado contra el job activo `notificaciones-email-chat` en `pg_cron`.

### Bloque B — Pagos, planes y consistencia de negocio (F08–F15)
- **F08 (Circuito antiguo `/api/comprar-creditos`):** bloqueado con `410 Gone` (`flujo_reemplazado`) redirigiendo toda nueva orden a `/pagos` con importes calculados en servidor (`payment-catalog.ts`).
- **F09 (Operaciones admin atómicas):** creadas y aplicadas en `016_monetizacion_creditos_y_admin_atomico.sql` (`20261101033727`) las funciones `admin_agregar_creditos` (bloqueo `FOR UPDATE`, saldo + auditoría en `transacciones_creditos` e idempotencia por referencia) y `admin_cambiar_plan` (cancelación + alta de suscripción + `tipo_cuenta` en una única transacción), conectadas en `/api/admin/add-creditos` y `/api/admin/planes`.
- **F10 & F18 (Créditos incluidos en el plan y destacado de 12 h):** creada `consumir_creditos_usuario` (consume primero los créditos mensuales incluidos en la suscripción vigente/trial y solo el remanente de `perfiles.credito_balance`, renovando el contador cada 30 días en suscripciones multimes y conservando `creditos_usados_mes` al cambiar de plan en prueba); actualizados `usar_boost` y `usar_destacado` (soporta `12h = 4`, `24h = 6` y `48h = 10` créditos, extendiendo `destacado_hasta` si seguía vigente) y conectado el saldo desglosado en `plans.ts` y el panel de usuario (`TabCreditos`).
- **F11 & F12 (Condiciones al vencer prueba y prestaciones reales de Agencia):** alineados `/planes` (ES/EN) y la portada con la regla real de conservación de anuncios/fotos existentes (`012_limites_publicacion_en_bd.sql`) y retiradas las promesas multiusuario no implementadas («5 usuarios incluidos», «créditos compartidos», «publicación masiva»).
- **F13 (Cuotas de fotos al editar):** validado en `PATCH /api/properties` antes de mutar, conservando fotos existentes tras bajada de plan sin truncar con `.slice(0, 20)`.
- **F15 (Cola administrativa de pagos):** `/api/admin/pagos` y `PagosTab.tsx` incorporan cola priorizada (`cola`: `revision` → `provisional` → `bloqueada` por antigüedad FIFO), filtro por estado, búsqueda por UUID/referencia, paginación y URLs firmadas solo para la página visible.

### Bloque C — Inventario, conversión, idiomas y moderación (F16–F19)
- **F16 (Listados por operación, estado y ciudad):** creado `src/lib/location-listings.ts` sobre las columnas reales de `vw_propiedades_publicas` (resolviendo slugs cortos como `san-diego`, IDs compuestos como `carabobo-san-diego` e inmuebles con `ubicacion_ciudad_id = null`), distinguiendo fallos de servicio (`role="alert"`) frente a ausencia de inventario en las 7 rutas de `/propiedades/**`. Movidos además en `src/lib/properties.ts` los filtros `min_bedrooms`, `min_bathrooms`, `min_area` y `amenities` a SQL antes de `.range(from, to)`.
- **F17 & F18 (Página de Créditos ES/EN):** reemplazado `dangerouslySetInnerHTML` por `t.rich`, corregida la interpolación ICU `{count}` en `orFeatured`, conectado `CREDIT_PACKAGES`, retirado el método inactivo `Transferencia` y actualizados los pasos `step1..step4` en ES y EN para describir la activación provisional y la verificación posterior.
- **F19 (Moderación unificada en servidor):** normalizada la coincidencia por palabra/frase completa en `src/lib/moderacion.ts` (`evaluarModeracionServidor`) evitando falsos positivos en vocabulario inmobiliario habitual y aplicada en servidor tanto en `POST`/`PATCH /api/properties` (con rate limit `producto:create`) como en `POST /api/publicar` (ignorando cualquier `estado_moderacion` enviado por el cliente).

### Bloque D — SEO, internacionalización, accesibilidad y rendimiento (F20–F25)
- **F20 (Canonicals y títulos sin duplicación):** creado `buildPageAlternates` (`src/lib/seo-metadata.ts`), eliminado el `alternates.canonical` global de `src/app/[locale]/layout.tsx` que apuntaba páginas internas a la portada y añadidos canonicals/hreflang propios y títulos sin duplicar `Venezuela Inmuebles` en `/planes`, `/creditos`, `/contacto`, `/como-funciona`, `/faq`, `/sobre-nosotros`, `/terminos-y-condiciones`, `/politica-de-privacidad`, `/como-instalar-app`, `/blog` y `/inmueble/[id]`.
- **F21 & F22 (`noindex`, `robots.ts` y `sitemap.ts`):** aplicado `NOINDEX_ROBOTS` en `(auth)`, `/pagos`, `/dashboard`, `/admin`, `/chat`, `/mi-perfil`, `/eliminar-cuenta`, `/reset-password`, `/confirm`, `/offline` y `/buscar`; bloqueadas en `robots.ts` las variantes ES y `/en/*`; excluido `/buscar` de `sitemap.ts`, eliminadas fechas artificiales en páginas estáticas y paginada la lectura de inmuebles activos con registro explícito de errores.
- **F23 (`<html lang>`, `LocalLink` y retorno de `/pagos`):** `<html lang={lang}>` dinámico en `src/app/layout.tsx`, preservación de `query`/`search`/`hash` en `LocalLink.tsx`, preservación de `?plan=` / `?creditos=` al redirigir de `/pagos` a `/login` y traducción completa de `/en/planes`.
- **F24 & F25 (Memoización en ficha y landmarks accesibles):** envuelta `getPublicProperty` en `React.cache` y condicionada la consulta por UUID a `isValidUUID(identifier)` en `/inmueble/[id]`; eliminados los `<main>` anidados en `/pagos` y `/contacto` y traducido el enlace «Saltar al contenido principal» / «Skip to main content».

### Bloque E — Operación, retención y CI (F26, F27, F29)
- **F26 (Texto de retención en eliminación de cuenta):** actualizado `deleteAccount.keptText` en ES/EN para reflejar con veracidad la conservación legal/antifraude de registros contables y órdenes de pago sin prometer un borrado automático a 30 días inexistente.
- **F27 (Reserva atómica en cola de correo):** añadida reserva condicional por arrendamiento temporal (`programado_para`) en `procesarNotificacionesEmailPendientes` antes de enviar cada correo para impedir envíos duplicados ante ejecuciones concurrentes del cron.
- **F29 (Integración continua):** añadido `.github/workflows/ci.yml` ejecutando `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` en PRs y pushes, ampliando la batería automatizada a **136 pruebas** (incluyendo PGlite sobre migraciones reales).

## Elementos marcados como PENDIENTE

- [ ] **PENDIENTE (F14 — Operación pagos/OCR):** Prueba real de pago de bajo importe (Pago Móvil y Binance Pay) verificando conciliación bancaria real y calibración del OCR con comprobantes reales anonimizados de distintos bancos.
- [ ] **PENDIENTE (F12 — Backlog de producto Agencia/Profesional):** Implementación futura de funciones multiusuario de Agencia (hasta 5 agentes, bandeja privada asignable, carga/edición masiva) y URL personalizada de escaparate (retiradas mientras tanto de los textos comerciales para no anunciar funciones inexistentes).
- [ ] **PENDIENTE (F24 / F25 — Rendimiento y accesibilidad en campo):** Medición real de Core Web Vitals / Lighthouse / axe tras despliegue y validación manual con teclado, lector de pantalla y móviles reales (Android/iOS).
- [ ] **PENDIENTE (F20–F22 — Search Console):** Revisión de cobertura, canonicals elegidos y `sitemap.xml` en Google Search Console tras el despliegue a producción.
- [ ] **PENDIENTE (F26 — Legal/privacidad):** Revisión legal independiente de política de privacidad, retención contable/antifraude y banner de preferencias de cookies según jurisdicción aplicable.
- [ ] **PENDIENTE (F27 — Correo/DNS):** Verificación de entregabilidad SMTP, rebotes y registros DNS `SPF` / `DKIM` / `DMARC` en el dominio productivo.
- [ ] **PENDIENTE (F28 — Observabilidad y continuidad):** Confirmación de captura de errores en Sentry sin datos sensibles, alertas operativas, MFA en proveedores (Vercel/GitHub/Supabase) y ensayo periódico de restauración de backup.
- [ ] **PENDIENTE (F29 — E2E en navegador):** Incorporar suite Playwright de recorridos autenticados por rol (`visitante`, `particular`, `profesional`, `agencia`, `admin`) sobre entorno de pruebas.
