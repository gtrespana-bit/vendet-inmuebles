# Supabase, Vercel y dominio canónico

## Proyectos y estado inicial

- **Supabase:** `Venezuela Inmuebles`, ref `quxbqmqwiacfwbpqioev`, región `us-east-1`, PostgreSQL 17.
- **Vercel:** proyecto `venezuela-inmuebles`; nombre visible del equipo `Venezuela Inmuebles`. Se conserva el slug técnico del equipo para no alterar las URLs de previews ni la identidad OIDC.
- **Dominio canónico:** `https://venezuela-inmuebles.online`.
- La base nueva se configura desde cero: el esquema y los catálogos están instalados, pero no se importaron usuarios ni publicaciones de prueba de la base anterior.

## Dominio y URLs

El dominio propio está asignado y verificado en Vercel; la comprobación de DNS no muestra errores. `www.venezuela-inmuebles.online` redirige al dominio raíz con HTTP 308. El sitio abre directamente por el dominio propio; la protección SSO corresponde a los alias automáticos de Vercel, no al dominio personalizado.

En Vercel, `NEXT_PUBLIC_URL` y `NEXT_PUBLIC_BASE_URL` están configuradas con `https://venezuela-inmuebles.online` para **Production, Preview y Development**. Los valores de entorno quedan disponibles para deployments nuevos; el deployment existente no cambia hasta reconstruirse.

Supabase Auth usa `https://venezuela-inmuebles.online` como `Site URL`. La lista de redirecciones permitidas conserva localhost y los patrones de previews de Vercel, y admite también el dominio raíz y `www`.

El PR #4 se fusionó en `main` y Vercel ya generó un deployment de producción listo para el dominio canónico. El rebranding y los ajustes actuales de correo se aplican desde la rama de trabajo activa cuando se integren sus cambios.

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

La primera crea 25 tablas con RLS, funciones, catálogos y tres buckets de Storage; la segunda crea las vistas públicas de propiedades y perfiles. Verificación remota: 24 estados, 316 ciudades, 2 operaciones, 10 tipos de inmueble, 9 categorías y 10 características; 52 políticas en `public`, 11 en `storage.objects`. Las vistas tienen lectura concedida a `anon`, `authenticated` y `service_role`. Los buckets `cedulas` y `comprobantes` deben mantenerse privados; `foto_perfil` es público. La migración inicial ya aplicada se conserva intacta para respetar el historial; su nombre interno del trigger mantiene el identificador histórico y no aparece en la interfaz. Cualquier cambio en la base debe añadirse como una migración nueva, no reescribiendo esa migración.

## Integraciones: estado actual

Los secretos se deben guardar directamente como variables de entorno en Vercel, no en el repositorio ni en el chat.

- **Resend SMTP:** el usuario configuró Resend como SMTP de Supabase Auth. En Vercel existen variables `SMTP_PASS` sensibles para Production, Preview y Development; el valor permanece oculto y no se consultó. `SMTP_FROM` está configurado como `"Venezuela Inmuebles" <noreply@venezuela-inmuebles.online>` en los tres entornos. El código usa `smtp.resend.com:465` y el usuario `resend` como valores predeterminados. La prueba de envío desde la aplicación queda pendiente.
- **Contactos por correo:** el código ahora muestra y usa alias del nuevo dominio (`soporte@`, `contacto@`, `privacidad@` y `legal@`). Su recepción/ruteo no se verificó en esta sesión; confirmar que existen antes de la prueba final (Zoho sigue pospuesto).
- **Cloudflare R2:** se pueden reutilizar `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` y `R2_BUCKET` anteriores si siguen activos. `R2_BUCKET` debe indicarse explícitamente; el código ya no elige un bucket por defecto, para evitar apuntar accidentalmente al anterior. No tenemos acceso automatizado a Cloudflare desde esta sesión para comprobar las claves ni el contenido. Para mantener el proyecto limpio, conviene usar un bucket nuevo/vacío; si se reutiliza el anterior, revisar primero que no exponga fotos de publicaciones de prueba. No se moverán ni importarán datos de la base anterior.
- **Telegram y Zoho:** quedan pospuestos, como se acordó; no son necesarios ahora.
- **Push/VAPID:** el par nuevo está configurado en Vercel para Production, Preview y Development; se incluyó en el deployment posterior al PR #4.

R2 sigue pendiente de configurar y verificar. Cuando se despliegue el cambio de remitente y se confirme que `SMTP_PASS` contiene la clave de Resend, se pueden probar los correos de la aplicación; las pruebas completas de aceptación esperan también a R2. Telegram y Zoho se probarán cuando se retomen.
