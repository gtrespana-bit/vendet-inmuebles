# Auditoría de lanzamiento — Venezuela Inmuebles (2026-10-31)

Análisis a fondo de seguridad, UX/visual, rendimiento y SEO antes del lanzamiento.
Todas las correcciones marcadas como ✅ ya están aplicadas en esta rama.

---

## 1. SEGURIDAD

### 🔴 Críticas — CORREGIDAS

1. **Rutas admin de auditoría sin autenticación** ✅
   `/api/admin/auditoria/resumen` (GET) y `/api/admin/auditoria/limpiar` (POST) no
   verificaban sesión: cualquiera podía leer el resumen de auditoría y **borrar
   registros de auditoría** usando la service-role key. Ahora usan `requireAdmin()`
   (401 sin token / 401 con token inválido / 403 sin email admin). Verificado en build
   de producción: `401 {"error":"No autenticado"}`.

2. **Datos personales hardcodeados en el repositorio** ✅
   `/api/datos-pago` tenía un fallback con teléfono y **cédula reales** en el código
   fuente (y la consulta anon a `perfiles` nunca devolvía nada por RLS). Ahora los
   datos de Pago Móvil salen de variables de entorno del servidor
   (`PAGO_MOVIL_TELEFONO`, `PAGO_MOVIL_CEDULA`, `PAGO_MOVIL_BANCO`) y la ruta devuelve
   503 si no están configuradas. Añadidas a `.env.local.example`.

3. **Cabeceras de seguridad HTTP ausentes** ✅
   Añadidas en `next.config.js` (`headers()`): CSP completo, `X-Frame-Options: DENY`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS
   (2 años, preload) y `Cache-Control: immutable` para `/_next/static/*`. Verificado
   con curl en producción.

4. **Páginas de test/diagnóstico accesibles públicamente** ✅
   `/test-*` (6 rutas) y `/diagnostico` devolvían 200 con detalles internos (errores de
   BD, config de R2). Ahora devuelven **404 real** en producción (middleware) y
   `notFound()` en el build. Siguen disponibles en `npm run dev`.

5. **Soft-404 (HTTP 200 en URLs inexistentes)** ✅
   `notFound()` tras el rewrite de next-intl devolvía 200 (problema conocido de
   Next.js con middleware). El middleware ahora devuelve **404 real** en producción
   para cualquier slug de un solo segmento que no sea página válida ni ciudad
   conocida. Verificado: `/esto-no-existe-xyz` → 404, `/caracas` → 200.

6. **XSS en JSON-LD y markdown del blog** ✅
   - Todos los bloques `application/ld+json` ahora escapan `<` como `\u003c`
     (un título de inmueble con `</script>` podía inyectar script).
   - El renderizador de markdown del blog escapa HTML y solo permite enlaces
     `http(s)`, rutas relativas, `#` y `mailto:` (bloquea `javascript:`).

7. **Guardia de servidor para /admin y /dashboard** ✅
   Eran solo chequeos de cliente. Nuevos `layout.tsx` de servidor verifican la sesión
   contra Supabase (`auth.getUser`) y redirigen a `/login` (admin exige email en
   `ADMIN_EMAILS`). La autorización real sigue en cada API route (`requireAdmin`).

### 🟡 Verificadas como correctas

- RLS habilitado en las 25 tablas; `vw_perfiles_publicos` expone solo campos públicos
  (sin cédula, saldo ni datos de pago) con `security_barrier`.
- Rate limiting distribuido (Supabase) en login, publicar, mensajes, favoritos,
  contacto, R2, IA, push, telegram, etc.
- Webhook de Telegram valida el secret con comparación de tiempo constante.
- Cron de notificaciones exige `Authorization: Bearer $CRON_SECRET` (falla cerrado).
- `requireAdmin`/`requireAuthenticatedUser` en todas las rutas admin; ownership check
  en eliminar/marcar-vendido.
- Subida de imágenes a R2: solo jpeg/png/webp, máx 8 MB, requiere sesión + rate limit.
- `.env*` está en `.gitignore`; las claves secretas nunca usan `NEXT_PUBLIC_`.
- Sanitización de strings de entrada (`sanitizeString`) en publicar.

### 🟠 Recomendaciones pendientes (config/infraestructura)

- `images.dangerouslyAllowSVG: true` se mantiene porque `AuthShell` usa
  `next/image` con `/brand-mark.svg`; está mitigado con CSP `sandbox` en imágenes.
  Valorar quitarlo si se sirve el SVG como `<img>`/inline.
- El cron acepta `?secret=` en query (lo usa pg_cron); sale en logs de acceso.
  Valorar solo header cuando pg_cron lo permita.
- Considerar verificación de sesión en middleware una vez `@supabase/ssr` sea
  edge-safe, para evitar el meta-refresh en /admin (hoy redirige vía layout).

---

## 2. SEO (Venezuela)

### ✅ Corregido

1. **Imagen OG inexistente** — `og:image` y `twitter:image` apuntaban a
   `/og-image.png` que devolvía 404, y la home usaba una foto demo. Creada
   `public/og-image.png` (1200×630, 249 KB, identidad de marca) y la home ahora la usa.
2. **robots.txt y sitemap duplicados** — existían en raíz y en `[locale]` (el de
   `[locale]` nunca se servía o generaba sitemaps duplicados sin prefijo).
   Eliminados los duplicados; un único `/robots.txt` (bloquea admin, dashboard, chat,
   auth, api, test-*, buscar, offline) y un único `/sitemap.xml`.
3. **Sitemap ampliado**: 816 URLs con alternates hreflang (`es-VE`, `en-US`,
   `x-default`) en cada entrada — incluye las **328 ciudades de Venezuela** × 2
   idiomas, `/propiedades/{venta|alquiler}/{estado}` (24 estados), blog con fechas
   reales del frontmatter e inmuebles activos desde `vw_propiedades_publicas`.
4. **Ruta basura eliminada**: `/[ciudad]/[categoria]` generaba miles de páginas de
   "vehículos/moda/empleo… | Clasificados" (su `generateStaticParams` devolvía claves
   incorrectas y daba 500). Eliminada; nada enlazaba a ella.
5. **Keywords de ciudades limpiadas**: de "productos usados/marketplace" a términos
   inmobiliarios reales (`casas en venta Caracas Distrito Capital`, `bienes raíces…`).
6. **404/soft-404**: ver seguridad #5. Además `blog/[slug]` e `inmueble/[id]` no
   encontrados llevan `robots: noindex`.
7. **Contenido duplicado de detalle**: `/propiedades/[slug]` ahora redirige
   permanentemente (308) al canonical `/inmueble/[id]` (que tiene metadata completa:
   título con operación + ciudad/estado, canonical, OG con la foto principal).
8. **JSON-LD en la home**: antes 0 bloques sin inventario; ahora siempre
   `Organization` + `WebSite` (con `SearchAction` a `/buscar?q=`) + `ItemList` cuando
   hay anuncios. Las landings de ciudad ya tenían JSON-LD (3 bloques en /caracas).
9. **Schema del blog**: logo del publisher corregido a `/logo-venezuela-inmuebles.png`
   (antes `/logo.png` → 404).
10. **Wording legacy**: "Clasificados Venezuela Inmuebles" en /buscar → "Venezuela
    Inmuebles".

### ✅ Ya estaban bien

- Canonical, hreflang (`es-VE`/`en-US`/`x-default`) en home y páginas clave.
- `metadataBase`, title template, OG/Twitter cards, `formatDetection` off,
  `robots: index,follow` con googlebot, categoría `real_estate`.
- 328 landings de ciudad estáticas con título/descripción/keywords únicos,
  canonical propio, breadcrumbs y JSON-LD; `dynamicParams = false`.
- Páginas `/propiedades/venta|alquiler/[estado]` por los 24 estados + DC.
- Blog estático desde `src/content/blog/*.md` con Article schema y fechas reales.

### 🟠 Para posicionar en toda Venezuela (siguientes pasos operativos)

1. Enviar `/sitemap.xml` a **Google Search Console** y verificar el dominio
   `venezuela-inmuebles.online` (hay scripts `generate-venezuela-inmuebles-urls.sh`,
   `create-batches.py`, `copy-urls-to-gsc.py` para envío por lotes).
2. Configurar `PAGO_MOVIL_*`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, SMTP (Resend)
   y VAPID en Vercel antes del lanzamiento.
3. Crear perfiles de Google Business / redes con el mismo nombre para señales de marca.
4. Publicar contenido de blog Orientado a búsquedas venezolanas ("cómo comprar un
   apartamento en Caracas", "precio del metro cuadrado en Valencia", "tasa BCV hoy"
   — ya hay `/api/tasa-bcv`).
5. Rich results: validar los JSON-LD en https://search.google.com/test/rich-results.

---

## 3. RENDIMIENTO

### ✅ Verificado / corregido

- **Build de producción OK**: `next build` compila sin errores (659 páginas estáticas),
  `tsc --noEmit` y `next lint` limpios.
- First Load JS compartido: **203 kB**; splitChunks separa react/react-dom/next/
  supabase/intl/lucide en chunks propios; `compress: true`; `poweredByHeader: false`.
- Imágenes: AVIF/WebP, `minimumCacheTTL` 30 días, `deviceSizes` completos; solo 2
  `<img>` crudos (popups de Leaflet, aceptable); mapa con `next/dynamic` + `ssr:false`.
- Fuentes **autoalojadas** (`@fontsource-variable` Inter + Fraunces) — antes se
  importaban solo en la home; ahora en `[locale]/layout.tsx` (todas las páginas, sin
  peticiones externas ni CLS).
- ISR: home `revalidate = 120`, ciudades `300`, catálogo/mapa `600`.
- Headers de caché: assets `immutable` 1 año; imágenes públicas 1 día + SWR.
- PWA: `manifest.json`, `sw.js` (offline → `/offline`), iconos 192/512,
  `apple-touch-icon`, `theme-color`.
- Analítica: Vercel Analytics + Speed Insights; Sentry con `sendDefaultPii: false`.

### 🟠 Notas

- TTFB depende de la latencia de Supabase; con ISR las páginas públicas quedan cacheadas
  (home servía en ~50 ms desde caché en pruebas).
- `output: 'standalone'`: en servidor propio usar `node .next/standalone/server.js`
  (y copiar `public/` y `.next/static/` dentro de `.next/standalone/`). En Vercel no
  hace falta.
- El CSS global es grande (~168 KB minificado por la hoja principal); candidato a
  purgar clases legacy de la plantilla de clasificados si se quiere raspar más.

---

## 4. VISUAL / UX

- Identidad consistente: paleta marino `#16294B` + latón `#B08542` sobre papel cálido,
  tipografías Fraunces (display) + Inter (texto), skip-link, `sr-only`, aria-labels
  en header/nav, `lang` correcto por locale.
- Home con hero a pantalla completa, buscador, destacados, categorías y CTA de
  publicación; estados de carga (`loading.tsx`), `not-found.tsx` localizado,
  breadcrumbs accesibles.
- PWA instalable con banner de instalación y navegación inferior móvil (`BottomTabNav`).
- ES/EN completo vía next-intl con `localePrefix: 'as-needed'` y conmutador ES/EN.
- `viewport` con `maximum-scale=5` (accesibilidad: permite zoom).
- Demo listings claramente etiquetados como muestra cuando no hay inventario.

### 🟠 Pendiente de revisión manual

- Revisión visual final en móvil real (ES/EN) con datos reales de Supabase — en este
  entorno sin claves solo se ven los estados demo.
- La página `/planes` seguía siendo borrador según `ROADMAP_SIGUIENTE_SESION.md`
  (matriz de planes aprobada pendiente de reflejar).

---

## 5. CHECKLIST PRE-LANZAMIENTO

- [x] Build de producción sin errores; lint y tipos limpios
- [x] Seguridad: auth en todas las rutas sensibles, headers HTTP, sin PII en el repo,
      404 reales, XSS mitigado en JSON-LD/markdown
- [x] SEO: robots/sitemap únicos y completos, OG image, hreflang, JSON-LD,
      landings de 328 ciudades, no soft-404, canonical único de detalle
- [ ] **Configurar variables de entorno en Vercel** (ver `.env.local.example`):
      Supabase, `SUPABASE_SERVICE_ROLE_KEY`, `PAGO_MOVIL_*`, `CRON_SECRET`,
      Telegram, SMTP/Resend, VAPID, `NEXT_PUBLIC_BASE_URL`
- [ ] Enviar sitemap a Google Search Console y pedir indexación de la home
- [ ] Probar flujo completo con cuentas reales: registro → publicar → moderación →
      chat → créditos → pago móvil (con datos de prueba)
- [ ] Revisión visual móvil ES/EN con inventario real
- [ ] Actualizar `/planes` según la matriz aprobada (ver ROADMAP)


---

## 6. PANEL ADMIN PROFESIONAL (2026-10-31, segunda pasada)

Se reconstruyó la pestaña Dashboard del admin como un **panel de analítica interna real**:

### Infraestructura de tracking (nueva)
- Migración `007_analytics_eventos.sql`: tabla `eventos_web` con RLS (insert público,
  lectura solo admin), índices por fecha/tipo/ruta/sesión/usuario/UTM, y RPCs
  `SECURITY DEFINER` que agregan todo en el servidor (el cliente nunca descarga tablas).
- Endpoint público `POST /api/track` (204 fire-and-forget, rate limit 300/h por IP,
  whitelist de tipos, sanitización de ruta/meta, detección de bots, UTM first-touch,
  dispositivo/navegador/país desde headers) + `POST /api/inmueble/visita` (incrementa
  el contador `visitas` vía RPC `registrar_visita_inmueble`).
- Eventos instrumentados: pageview (cada navegación, vía `TrackPageView` en el layout),
  `registro`, `login`, `publicacion_creada`, `mensaje_enviado`, `inicio_chat`,
  `favorito`, `busqueda` (términos buscados), `contacto`, `compra_creditos`,
  `vista_inmueble`.

### Panel (`/admin?tab=dashboard` → "Analítica")
- 5 sub-pestañas con datos agregados vía `/api/admin/analytics/*` (todas `requireAdmin`,
  verificado 401 sin sesión):
  - **Resumen**: 12 KPIs con delta vs periodo anterior (▲/▼ %), gráfica de evolución
    diaria multi-serie (pageviews, sesiones, registros, publicaciones, mensajes,
    compras), embudo de conversión (pageview→registro→publicación, contacto→compra),
    créditos vendidos e ingresos.
  - **Tráfico**: top páginas, referrers, campañas UTM, búsquedas internas más frecuentes,
    dispositivos y navegadores (donut), países por IP, horas pico (hora Venezuela).
  - **Usuarios**: registros/logins/activos por día, totales, nuevos, activos, verificados,
    tipo de cuenta, planes activos, saldo de créditos en circulación, top estados/ciudades.
  - **Contenido**: publicaciones por día/estado/ciudad/tipo/operación, alerta de
    moderación pendiente + tiempo medio de moderación, inmuebles más vistos, vendedores
    con más mensajes, estadísticas de chat (conversaciones, mensajes, no leídos, tasa de
    respuesta).
  - **Actividad**: feed unificado en vivo (auditoría admin + registros, publicaciones,
    compras, contactos).
- Selector de periodo (Hoy / 7 / 30 / 90 días), auto-refresh 60 s, indicador
  "actualizado hace…", gráficas SVG propias sin librerías (bundle sin peso extra).
- Gráficas y KPIs calculados en PostgreSQL (una llamada por vista), no en el cliente.

---

**Veredicto final: con las correcciones de seguridad/SEO de la sección 5, el panel admin
profesional de la sección 6, la migración 007 aplicada en Supabase y las variables de
entorno configuradas en Vercel, el proyecto está listo para lanzar.**
