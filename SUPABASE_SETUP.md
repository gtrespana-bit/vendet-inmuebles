# Supabase, Vercel y dominio canónico

## Proyectos y estado inicial

- **Supabase:** `VendeT Inmuebles`, ref `quxbqmqwiacfwbpqioev`, región `us-east-1`, PostgreSQL 17.
- **Vercel:** proyecto `vendet-inmuebles`, equipo `VendeT`.
- **Dominio canónico:** `https://venezuela-inmuebles.online`.
- La base nueva se configura desde cero: el esquema y los catálogos están instalados, pero no se importaron usuarios ni publicaciones de prueba de la base anterior.

## Dominio y URLs

El dominio propio está asignado y verificado en Vercel; la comprobación de DNS no muestra errores. `www.venezuela-inmuebles.online` redirige al dominio raíz con HTTP 308 y el alias `vendet-inmuebles.vercel.app` redirige al dominio canónico con HTTP 307. El sitio abre directamente por el dominio propio; la protección SSO corresponde a los alias automáticos de Vercel, no al dominio personalizado.

En Vercel, `NEXT_PUBLIC_URL` y `NEXT_PUBLIC_BASE_URL` están configuradas con `https://venezuela-inmuebles.online` para **Production, Preview y Development**. Los valores de entorno quedan disponibles para deployments nuevos; el deployment existente no cambia hasta reconstruirse.

Supabase Auth usa `https://venezuela-inmuebles.online` como `Site URL`. La lista de redirecciones permitidas conserva localhost y los patrones de previews de Vercel, y admite también el dominio raíz y `www`.

El código fuente y los metadatos SEO se alinearon en la rama de trabajo actual; el PR #4 está abierto. La versión de producción con esos cambios de canonicals, sitemap, robots, datos estructurados y enlaces debe generarse después de integrar el PR en `main`.

## Variables de entorno de Supabase

El proyecto Vercel tiene configuradas para los tres entornos:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (**sensible, sólo servidor**)
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_URL`

En `.env.local.example` están las claves y URLs que necesita el desarrollo local. Nunca publiques `SUPABASE_SERVICE_ROLE_KEY` ni la incluyas en una variable `NEXT_PUBLIC_*`.

## Migraciones SQL aplicadas

Migraciones aplicadas al proyecto nuevo el 2026-10-29, en este orden:

1. `schema_inicial` (versión remota `20261029224823`), equivalente a `supabase/migrations/001_schema_inicial.sql`.
2. `crear_vista_propiedades` (versión remota `20261029224838`), equivalente a `supabase/migrations/002_crear_vista_propiedades.sql`.

La primera crea 25 tablas con RLS, funciones, catálogos y tres buckets de Storage; la segunda crea las vistas públicas de propiedades y perfiles. Verificación remota: 24 estados, 316 ciudades, 2 operaciones, 10 tipos de inmueble, 9 categorías y 10 características; 52 políticas en `public`, 11 en `storage.objects`. Las vistas tienen lectura concedida a `anon`, `authenticated` y `service_role`. Los buckets `cedulas` y `comprobantes` deben mantenerse privados; `foto_perfil` es público.

## Integraciones: estado actual

Los secretos se deben guardar directamente como variables de entorno en Vercel, no en el repositorio ni en el chat.

- **Resend SMTP (por configurar por el usuario):** `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS` (API key de Resend, sensible) y, si hace falta, `SMTP_FROM`. La dirección remitente debe pertenecer a un dominio verificado en Resend. Se conserva el remitente existente `noreply@vendet.online` como fallback; cámbialo en `SMTP_FROM` sólo por una dirección que Resend haya verificado.
- **Cloudflare R2:** se pueden reutilizar `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` y `R2_BUCKET` anteriores si siguen activos. `R2_BUCKET` debe indicarse explícitamente; el código ya no elige un bucket por defecto, para evitar apuntar accidentalmente al anterior. No tenemos acceso automatizado a Cloudflare desde esta sesión para comprobar las claves ni el contenido. Para mantener el proyecto limpio, conviene usar un bucket nuevo/vacío; si se reutiliza el anterior, revisar primero que no exponga fotos de publicaciones de prueba. No se moverán ni importarán datos de la base anterior.
- **Telegram y Zoho:** quedan pospuestos, como se acordó; no son necesarios ahora.
- **Push/VAPID:** ya se generó un par nuevo para esta instalación. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` está configurada en Vercel como variable pública y `VAPID_PRIVATE_KEY` como sensible, para Production, Preview y Development. Se aplicará en el siguiente deployment.

Las variables de R2 y Resend se pueden añadir desde la configuración de Vercel. Los conectores de Cloudflare, Telegram y Resend no están disponibles en esta sesión. Las pruebas de aceptación del flujo actual se realizarán al terminar la configuración de R2 y Resend; Telegram y Zoho se probarán cuando se retomen.
