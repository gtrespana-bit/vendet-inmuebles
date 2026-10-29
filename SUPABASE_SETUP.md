# Supabase y Vercel: estado de configuración

## Proyecto actual

- **Supabase:** `VendeT Inmuebles`, ref `quxbqmqwiacfwbpqioev`, región `us-east-1`, PostgreSQL 17.
- **Estado comprobado:** servicios saludables; la base `public` estaba vacía al iniciar la configuración.
- **Vercel:** proyecto `vendet-inmuebles` del equipo `VendeT`.
- **URL Vercel actual:** `https://vendet-inmuebles-vende-t.vercel.app`.

## Error de compilación de Vercel

El error `supabaseUrl is required` no lo produce el cambio de cuenta en sí: el proyecto nuevo de Vercel no tenía variables de entorno. La compilación fallaba al importar el cliente Supabase en `/api/datos-pago`.

Ya se añadieron al proyecto Vercel, para **Production, Preview y Development**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (**sensible, sólo servidor**)
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_URL`

Además, `/api/datos-pago` se marcó como dinámico y ya no crea el cliente global al importar el módulo. Estos cambios de entorno sólo entran en vigor en un **nuevo deployment**.

En `.env.local.example` están las mismas variables para desarrollo local. Nunca publiques la clave `SUPABASE_SERVICE_ROLE_KEY` ni la incluyas en variables `NEXT_PUBLIC_*`.

## Auth y redirecciones

Auth está configurado con el alias estable de Vercel como `Site URL`, además de localhost y el patrón de previews de este proyecto. En la cuenta Vercel consultada todavía no hay dominios personalizados asignados. Cuando se confirme y conecte el dominio definitivo, hay que cambiar `NEXT_PUBLIC_URL`, `NEXT_PUBLIC_BASE_URL` y el `Site URL` de Supabase, y agregar ese dominio a la lista de redirecciones permitidas.

## Migraciones SQL

Aplicar en este orden al proyecto vacío:

1. `supabase/migrations/001_schema_inicial.sql`
2. `supabase/migrations/002_crear_vista_propiedades.sql`

La primera crea tablas, políticas RLS, funciones, catálogos y buckets de Storage. La segunda crea las vistas de propiedades y perfiles públicos. La sintaxis local se validó con `pglast`; `npx tsc --noEmit` y `npm run build` también pasan localmente con variables de Supabase configuradas. **Las migraciones aún no se han aplicado a Supabase.** No marques los buckets privados `cedulas` y `comprobantes` como públicos.

## Integraciones que requieren configuración adicional

Los siguientes valores no están configurados en el proyecto Vercel actual. No son necesarios para compilar, pero sí para habilitar las funciones asociadas:

- **Cloudflare R2:** `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL`. Sin ellos, las subidas de fotos de publicaciones a R2 no funcionarán.
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` y `TELEGRAM_WEBHOOK_SECRET`. El secreto debe coincidir con el configurado al registrar el webhook de Telegram.
- **Correo Zoho SMTP:** variables `ZOHO_SMTP_*`.
- **Notificaciones push:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`.

Añade esos valores directamente a Vercel como variables sensibles cuando estén disponibles; no los compartas en el repositorio ni en el chat.
