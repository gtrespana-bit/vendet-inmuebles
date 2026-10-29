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

El código fuente y los metadatos SEO se están alineando en la rama de trabajo actual. La versión de producción con esos cambios de canonicals, sitemap, robots, datos estructurados y enlaces debe generarse después de integrar los cambios en `main`.

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

## Integraciones externas pendientes

R2, Telegram y Zoho SMTP están preparados en el código, pero siguen pendientes de las credenciales de sus cuentas. Push/VAPID ya está configurado. Los valores sensibles se deben añadir en Vercel, no al repositorio ni al chat:

- **Cloudflare R2:** `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL` (y confirmar `R2_BUCKET`; el valor predeterminado del código es `vendetinmuebles`). Se requieren el endpoint del bucket, claves de API y una URL pública de lectura.
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` y `TELEGRAM_WEBHOOK_SECRET`. El secreto debe ser el mismo al registrar el webhook con Telegram. El código del webhook valida el token del encabezado y el chat.
- **Zoho SMTP:** `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_USER` y `ZOHO_SMTP_PASS`. El valor predeterminado es `smtp.zoho.com:587` con STARTTLS (el puerto 465 usa TLS implícito); el usuario y la contraseña de aplicación son necesarios para enviar correos. Se conservan las direcciones existentes `@vendet.online`.
- **Push/VAPID:** ya se generó un par nuevo para esta instalación. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` está configurada en Vercel como variable pública y `VAPID_PRIVATE_KEY` como sensible, ambas para Production, Preview y Development. Los valores se aplicarán en el siguiente deployment.

Los conectores de Cloudflare y Telegram no están disponibles en esta sesión y todavía hacen falta las credenciales de R2, Telegram y Zoho SMTP. Añádelas directamente en Vercel con la visibilidad adecuada; no las guardes en el repositorio ni las compartas por chat. Las pruebas de aceptación quedan para el final, una vez cerradas las integraciones y desplegados los cambios de dominio.
