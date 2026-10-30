# Venezuela Inmuebles — Proyecto

## General
- **Repositorio:** GitHub, conectado a Vercel.
- **Branch principal:** `main`
- **Dominio canónico:** `https://venezuela-inmuebles.online`
- **Deploy:** Vercel (`venezuela-inmuebles`)
- **Supabase:** `Venezuela Inmuebles` (`quxbqmqwiacfwbpqioev`, `us-east-1`)
- **Estado inicial:** esquema y catálogos configurados; sin usuarios ni publicaciones importados.
- **Stack:** Next.js (App Router, TS), Supabase (Postgres + Auth + Storage + Realtime), PWA
- **Node:** v24.14.0

## Estructura de Carpetas

### Páginas (src/app/)
- `/` — HomePage (landing con hero, categorias, productos destacados)
- `/[ciudad]/page.tsx` — Página por ciudad
- `/[ciudad]/[categoria]/page.tsx` — Lista por ciudad + categoría
- `/buscar/page.tsx` — Buscador de productos
- `/catalogo/page.tsx` — Catálogo general con filtros
- `/producto/[slug]/page.tsx + ProductoPageClient.tsx` — Detalle de producto
- `/producto/editar/[id]/page.tsx` — Editar producto existente
- `/publicar/page.tsx` — Formulario de publicación (3 pasos)
- `/chat/page.tsx + ChatPage.tsx` — Sistema de mensajería entre usuarios
- `/dashboard/page.tsx` — Panel de usuario con tabs
  - Tabs: Resumen, Mis Productos, Mensajes, Créditos, Favoritos, Verificación, Reputación
- `/admin/page.tsx` — Dashboard admin (aprobación moderación, verificación, gestión usuarios)
- `/admin/aprobacion/page.tsx` — Aprobación de contenido moderado
- `/vendedor/[id]/page.tsx` — Perfil público de vendedor
- `/mi-perfil/page.tsx` — Mi perfil
- `/creditos/page.tsx` — Comprar créditos
- `/(auth)/login/page.tsx` — Login
- `/(auth)/register/page.tsx` — Registro
- `/(auth)/confirmacion/page.tsx` — Confirmación email
- `/confirm/page.tsx` — Confirmación de email (alternativa)
- `/reset-password/page.tsx` — Reset contraseña
- `/como-funciona/page.tsx` — Página explicativa
- `/como-instalar-app/page.tsx` — Instrucciones instalación PWA
- `/contacto/page.tsx` — Contacto
- `/faq/page.tsx` — FAQ
- `/sobre-nosotros/page.tsx` — Sobre nosotros
- `/politica-de-privacidad/page.tsx`
- `/terminos-y-condiciones/page.tsx`
- `/offline/page.tsx` — Página offline PWA

### API Routes (src/app/api/)
- **Publicar:** `/api/publicar/route.ts` — con rate-limit y moderación
- **Chat:** `/api/enviar-mensaje/route.ts` — enviar mensajes
- **Chat leído:** `/api/mensajes-leidos/route.ts` — marcar leídos
- **Chat review-status:** `/api/chat/review-status/route.ts` — verificar si comprador puede reseñar (service_role)
- **Admin:** 
  - `/api/admin/enviar-resena/route.ts` — enviar reseña (evaluador_id + evaluado_id)
  - `/api/admin/marcar-vendido/route.ts` — marcar producto vendido, con comprador
  - `/api/admin/toggle-verificado/route.ts` — toggle verificación usuario
  - `/api/admin/verificar-venta/route.ts` — verificar venta
  - `/api/admin/perfiles-ids/route.ts` — bulk perfiles
  - `/api/admin/verificar/route.ts` — verificar usuario
- **Auth:** `/api/login/route.ts`, `/api/confirm-email/route.ts`, `/api/email-verificacion/route.ts`
- **Emails:** `/api/contacto/route.ts`, `/api/email-creditos/route.ts`, `/api/email-test/route.ts`
- **Push:** `/api/push-subscribe/route.ts`, `/api/push/send/route.ts`, `/api/notify/route.ts`
- **Créditos:** `/api/comprar-creditos/route.ts`, `/api/datos-pago/route.ts`
- **Otros:** `/api/tasa-bcv/route.ts`, `/api/user-bulk/route.ts`, `/api/moderacion-alerta/route.ts`, `/api/telegram/webhook/route.ts`, `/api/verificacion-alerta/route.ts`, `/api/debug-profiles-diag/route.ts`

### Dashboard Components (src/app/dashboard/)
- **page.tsx:** Tabs con lazy/dynamic load
  - `TabProductos` → lazy() — carga al clic del tab
  - `TabReputacion` → dynamic() — carga al clic
  - `TabResumen`, `TabMensajes`, `TabCreditos`, `TabFavoritos` → import directo (ligeros)
  - `SolicitarVerificacion` → dynamic(ssr: false)
  - `TabProductos` dentro de `<Suspense>` con fallback
- **hooks/useDashboard.ts** — hook central para datos del dashboard
- **components/DashboardHeader.tsx** — header del dashboard

### Componentes (src/components/)
- `AuthProvider.tsx` — Contexto de autenticación Supabase
- `Avatar.tsx` — Avatar con colores por nombre
- `BadgeVerificado.tsx` — Badge de verificación
- `BotonDescargarApp.tsx` — Botón descarga PWA
- `BottomTabNav.tsx` — Navegación inferior mobile (siempre visible)
- `FloatingChat.tsx` — Chat flotante (no usado en layout)
- `Footer.tsx`
- `Header.tsx` — Header con search, notificaciones, avatar
- `ImageGallery.tsx` → **dynamic()** en producto page
- `ProductCard.tsx` — Con `sizes` + `loading="lazy"` + `placeholder`
- `PushNotificationBanner.tsx` → **dynamic()** en layout
- `PWAInstallBanner.tsx` → **dynamic()** en layout
- `ReportarButton.tsx`
- `ResultadosUbicacion.tsx`
- `ScrollAnimate.tsx`
- `SellerReputation.tsx` → **dynamic()** en producto page
- `Skeleton.tsx`
- `SolicitarVerificacion.tsx` -> **dynamic(ssr:false)**
- `UbicacionSelector.tsx`

### Librerías (src/lib/)
- `categorias.ts` — Datos de categorías/subcategorías/marcas/campos
  - `categoriasData`: Vehículos, Tecnología, Moda, Hogar, Herramientas, Repuestos, Materiales, Otros
  - Cada subcategoría tiene: `marcas[]`, `campos[]` (con type: text/number/select)
  - `campoAnio`: `{ label: 'Año', type: 'select' }` — con ñ (IMPORTANTE)
  - Helper: `getSubByCategory()`, `getSubConfig()`, `getMarcaOptions()`
- `moderacion.ts` — Moderación automática de contenido (prohibido/sospechoso/aprobado)
- `supabase.ts` — Cliente Supabase (cliente-side)
- `tasaBCV.ts` — Tasa de cambio BCV (Venezuela)
- `ubicaciones.ts` — Estados y municipios de Venezuela (`ESTADOS`, `getMunicipiosNombres`)
- `push.ts` — Push notifications Web Push
- `rate-limit.ts` — Rate limiting para API
- `email.ts`, `server-email.ts` — Emails via Resend/mjml
- `categorias.ts` — Categorías con marcas y campos

### Páginas de Producto (src/app/producto/)
- `[slug]/page.tsx` + `ProductoPageClient.tsx` — Con ImageGallery/SellerReputation lazy-loaded
- `editar/[id]/page.tsx` — Editar producto
- Reseñas eliminadas de página de producto (solo tras compra/venta)

### Chat (src/app/chat/)
- `page.tsx + ChatPage.tsx` — Sistema de mensajería:
  - Polling 5s (redundante con realtime)
  - Realtime subscription para mensajes nuevos
  - sessionStorage cache para carga instantánea
  - Sidebar skeleton mientras carga
  - **Reseña comprador:** 
    - Usa `/api/chat/review-status` (server-side, service_role)
    - `puedeResenar` solo si producto NO activo (vendido) y comprador no reseñó
    - `productoOwnerId` del endpoint, no de estado local
    - Endpoint devuelve: `productoOwnerId`, `yaDejoResena`, `productoVendido`, `puedeResenar`, `productoId`
    - Botón muestra: solo si `puedeResenar === true`
    - Envía a `/api/admin/enviar-resena` con `evaluador_id` (comprador) + `evaluado_id` (vendedor)

### Publicar (src/app/publicar/)
- 3 pasos:
  1. Categoría → Subcategoría → Marca (select con "Otra" opción)
  2. Detalles: título, descripción, precio, ubicacion, estado, specs
  3. Review + publicar
- **Marca:** `<select>` con todas las marcas de `categoriasData` + "Otra (no está en la lista)"
  - "Otra" usa prefix `otra:` que se limpia al guardar
  - Specs select con marca también tienen "Otra" opción
- **Año:** fix de bug — `camposEspeciales` busca `c.label === 'Año'` (con ñ) — match con `campoAnio`
- Imágenes en paralelo con `Promise.all`
- Moderación automática antes de publicar
- Rate limiting via `/api/publicar`
- "Pack Emprendedor" — 10+ publicaciones = 5 créditos gratis

## Base de Datos (Supabase)

### Tablas principales (conocidas)
- `perfiles` — perfiles de usuario: id, nombre, telefono, ciudad, estado, verificado, foto_perfil_url, email_visible, whatsapp_disponible, nivel_confianza, badges_automaticos, ultima_actividad, creado_en, emprendedor_dado, credito_balance
- `productos` — id, user_id, titulo, descripcion, categoria_id, subcategoria, marca, estado, precio_usd, ubicacion_estado, ubicacion_ciudad, imagen_url, imagenes (array), metodos_contacto (JSON), activo, vendido, vendido_en, comprador_id, estado_moderacion, motivo_moderacion, destacado, boosteado_en, visitas, creado_en
- `conversaciones` — id, user1_id, user2_id, producto_id, ultimo_mensaje, ultimo_mensaje_en, creado_en
- `mensajes` — id, conversacion_id, remitente_id, destinatario_id, contenido, leido, creado_en
- `resenas` — id, producto_id, vendedor_id, comprador_id, puntuacion (1-5), comentario, creado_en
- `favoritos` — id, user_id, producto_id, creado_en
- `historial_precios` — id, producto_id, precio_anterior, precio_nuevo, creado_en
- `categorias` — id, nombre
- `notificaciones_push` — target_user_id, tipo, titulo, cuerpo, click_url
- `creditos_transacciones` — transacciones de créditos

### Migraciones
- `migrations/add-vendido-columns.sql` — añade `vendido` (BOOLEAN), `vendido_en` (TEXT), `comprador_id` (UUID) a `productos`

## Service Worker (public/sw.js)
- **HTML pages:** Network-first, fallback cache, luego offline
- **Supabase Storage images:** Stale-while-revalidate con TTL 7 días (custom header `sw-fetched-time`)
- **Static assets (images/styles/scripts/fonts):** Stale-while-revalidate
- **API calls:** Network-first, fallback JSON error 503
- Push notifications + notificationclick handler
- Auto-update con skipWaiting

## PWA (public/manifest.json)
- `name:` Venezuela Inmuebles
- `short_name:` Venezuela
- `scope:` `/`
- `orientation:` `any`
- `display:` standalone
- `icons:` 192x192 (PNG), 512x512 (PNG + WebP)
- `screenshots:` pwa-tagline.png (1280x720)
- Service Worker registrado via `sw-register.js`

## Configuración
- `next.config.js` — images: webp/avif, remotePatterns: supabase.co + unsplash.com, Sentry
- `tailwind.config.js` — content: `./src/**/*.{js,ts,jsx,tsx,mdx}`
- Colores brand (paleta Marino): primary `#16294B`, dark `#0B1730`, accent `#B08542`, gray `#F4F1E9`, darkNav `#0B1730`
- Font: Inter (Google, display:swap, variable CSS)

## Optimizaciones Implementadas
1. **og-image.webp** — 48KB vs 910KB PNG (-862KB)
2. **PWAInstallBanner + PushNotificationBanner → dynamic()** — no bloquean TTI
3. **ProductCard:** `sizes="(max-width: 768px) 50vw, 25vw"`, `loading="lazy"`
4. **Chat sidebar skeleton** — no pantalla vacía mientras carga
5. **Chat polling 5s** (antes 1.5s) — realtime Supabase cubre mensajes
6. **sessionStorage cache** en ChatPage — carga instantánea de conversaciones
7. **Dashboard tabs lazy:** `TabProductos` (lazy), `TabReputacion` (dynamic), `SolicitarVerificacion` (dynamic ssr:false)
8. **Producto page lazy:** `ImageGallery`, `SellerReputation` → dynamic()
9. **SW mejora:** stale-while-revalidate con TTL 7 días para imágenes Supabase
10. **Manifest:** `scope`, `orientation`, `screenshots`, icon-512.webp (46→12KB)

## RLS Policy Status
- Supabase RLS activo. Queries admin usan `service_role` para bypass.
- Endpoints server-side con `SUPABASE_SERVICE_ROLE_KEY`:
  - `/api/admin/*` — todos usan service_role
  - `/api/chat/review-status` — usa service_role
  - `/api/user-bulk` — bypass RLS
  - `/api/mensajes-leidos` — bypass RLS

## Flujo de Reseñas (Buyer/Seller)
1. Vendedor marca producto vendido → admin envía mensaje "compra exitosa" al chat
2. Vendedor puede dejar reseña desde dashboard/admin → endpoint `/api/admin/enviar-resena` con `evaluador_id` (vendedor) + `evaluado_id` (comprador)
3. Comprador ve mensaje "compra exitosa" → botón "⭐ Deja tu reseña al vendedor" aparece si:
   - Producto NO activo (=vendido)
   - Comprador no ha reseñado este producto específico
   - Endpoint `/api/chat/review-status` devuelve `puedeResenar=true`
4. Comprador deja reseña → mismo endpoint con `evaluador_id` (comprador) + `evaluado_id` (vendedor)

## Bugs Conocidos Resueltos
- ~~`useRef` import perdido~~ → añadido
- ~~`enviarResenaComprador` duplicada~~ → eliminada
- ~~Condiciones de botón de reseña rotas (`user1_id !== user.id && user2_id !== user.id`)~~ → fix
- ~~Bug Año/Ano (campoAnio.label='Año' pero código buscaba 'Ano')~~ → fix
- ~~Marca como input+datalist (no funciona en PWA/Safari)~~ → select con opción "Otra"
- ~~Producto activo mostrando botón de reseña~~ → solo si `!prod.activo`
- ~~Review check sin filtro por producto_id~~ → ahora filtra por producto

## Variables de Entorno
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (sólo servidor)
- `NEXT_PUBLIC_URL` y `NEXT_PUBLIC_BASE_URL` (dominio canónico y enlaces)
- `R2_*` (almacenamiento de imágenes)
- `TELEGRAM_*` (alertas y webhook)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (correo transaccional; Resend previsto)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` (notificaciones push)
- `SENTRY_AUTH_TOKEN` (Source Maps, opcional)

## Búsqueda por mapa (OpenStreetMap)

- Ruta pública: `/[locale]/mapa` (enlazada desde la cabecera, el pie, la portada y el catálogo).
- Librería: **Leaflet 1.9** + **leaflet.markercluster**, sin clave de API ni coste.
- Teselas: `tile.openstreetmap.org` con atribución visible (© OpenStreetMap contributors) y
  `referrerPolicy: 'strict-origin-when-cross-origin'` en la capa: la política de uso exige una Referer válida y sin ella el
  servidor devuelve la imagen *«Access blocked»* (también cuando la página se sirve con `Referrer-Policy: no-referrer` o
  dentro de un iframe). El proveedor se puede sustituir con `NEXT_PUBLIC_MAP_TILE_URL` sin tocar el código. Para tráfico
  alto hay que respetar la [política de uso de teselas](https://operations.osmfoundation.org/policies/tiles/) o contratar
  un proveedor (MapTiler, Thunderforest, Protomaps…) manteniendo los datos OSM.
- Si el proveedor no responde, el mapa muestra un aviso discreto («Fondo del mapa no disponible») y deja los pines y la
  lista operativos.
- Marcadores con precio; los destacados en latón, los de ubicación aproximada con borde discontinuo. Selección
  sincronizada entre mapa y lista, agrupación de marcadores y botón «Buscar en esta zona».
- Coordenadas: `inmuebles.latitud` / `inmuebles.longitud`. Si faltan, `src/lib/geo/venezuela.ts` resuelve el centro de la
  ciudad/estado (con desplazamiento determinista) y la ficha se marca como *ubicación aproximada*.
- Alta de inmuebles: el formulario de publicación incluye un selector de pin opcional que guarda `latitud`/`longitud`.
- La demo pública usa `src/lib/demo/demo-listings.ts` cuando la base de datos no devuelve inmuebles y lo indica con la
  etiqueta «Datos de ejemplo».

## Datos de demostración (50 fichas)

El catálogo arranca con 50 inmuebles reales de mercado (no datos de ejemplo) en **Valencia**, **San Diego
(Carabobo)** y **Caracas**, con venta y alquiler, precios dentro de los rangos de mercado 2026 y fotos reales
de portales inmobiliarios venezolanos.

- Generador: `scripts/seed_propiedades_demo.py`. Vuelve a producir las 50 portadas en
  `public/propiedades/prop-01..50.jpg` y el SQL `supabase/seeds/2026-10-30_propiedades_demo.sql`
  (`begin` → `insert into public.inmuebles` → portada en `public.inmueble_imagenes` → `commit`).
  El script valida que haya 50 fichas y que ninguna portada se repita.
- Cuenta dueña de todas las fichas: agencia **TuInmueble** (`tipo_cuenta = 'agencia'`,
  `empresa_nombre = 'TuInmueble'`, perfil verificado, plan **agencia** = publicaciones ilimitadas y 20 créditos/mes).
  El alta es reproducible con `supabase/seeds/2026-10-30_cuenta_agencia_tuinmueble.sql`, que crea el usuario
  en `auth.users` + `auth.identities` (contraseña por variable `:'pw'`, nunca en el repositorio), la fila en
  `public.agencias`, la membresía `admin` y la suscripción, y reasigna las 50 fichas
  (`usuario_id`, `agencia_id`, `agente_asignado_id`).
- Las fichas nacen con `activo = true`, `vendido = false` y `estado_moderacion = 'aprobado'`, así que aparecen
  de inmediato en `vw_propiedades_publicas`, en el catálogo, en el mapa y en la portada. `slug`, `creado_en` y
  `publicado_en` los genera la base de datos.
- Cada ficha tiene una sola foto (portada); las galerías múltiples quedan pendientes hasta ampliar el banco de
  imágenes con interiores propios.
- Las portadas provienen de anuncios públicos de portales venezolanos y se usan como material de demostración:
  hay que sustituirlas por fotos propias o con licencia antes de un lanzamiento comercial.

## Notas de Diseño
- BottomTabNav: siempre visible, no remover
- Colores: brand-primary `#16294B`, accent `#B08542` (azul noche + latón)
- Tipografía: Inter variable
- Formato de precios: `$X.XXX` (USD) + Bs. con tasa BCV
- PWA: standalone, theme-color `#16294B`, black-translucent status bar

## Reglas de Trabajo (desde 2026-05-05)
- **NO push a `main` sin aprobación explícita de Ruben**
- **Todo se prueba localmente primero** — build + verificación visual antes de cualquier push
- **Branch separado para features** — crear rama para staging si se necesita
- **Siempre commitear antes de push** — no dejar working tree dirty
- **Respectar la estructura actual** — no refactorizar sin consultar
