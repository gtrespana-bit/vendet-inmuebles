# Venezuela Inmuebles

Portal inmobiliario para publicar y descubrir inmuebles en Venezuela. La aplicación está construida con Next.js 14, React 18, Supabase y Cloudflare R2 (opcional para imágenes de publicaciones).

## Configuración de Supabase

El proyecto de Supabase asociado a este repositorio es `quxbqmqwiacfwbpqioev`. El esquema se mantiene en estas migraciones y debe aplicarse en orden:

1. `supabase/migrations/001_schema_inicial.sql` — tablas, catálogos y datos de ubicación, funciones, RLS, permisos y buckets de Storage.
2. `supabase/migrations/002_crear_vista_propiedades.sql` — vistas de lectura pública de propiedades y perfiles.

El proyecto nuevo parte vacío. No ejecutes archivos SQL heredados del proyecto anterior ni marques como públicos los buckets privados `cedulas` y `comprobantes`. Consulta `SUPABASE_SETUP.md` para las comprobaciones y ajustes de Auth.

## Variables de entorno

```bash
cp .env.local.example .env.local
```

En `.env.local`, configura como mínimo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://quxbqmqwiacfwbpqioev.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_o_publishable
SUPABASE_SERVICE_ROLE_KEY=tu_clave_de_servidor
```

`SUPABASE_SERVICE_ROLE_KEY` es sólo para el servidor. Nunca la uses en código de navegador, no le agregues el prefijo `NEXT_PUBLIC_` y no la subas al repositorio. Las integraciones opcionales de R2, Telegram, correo y notificaciones push también están documentadas en `.env.local.example`.

## Desarrollo local

```bash
npm install
npm run dev
```

La aplicación se abrirá en `http://localhost:3000`.

Antes de desplegar, ejecuta:

```bash
npx tsc --noEmit
npm run build
```

## Arquitectura

- **Frontend:** Next.js 14, React 18, Tailwind CSS y `next-intl`.
- **Backend y datos:** Supabase Auth, PostgreSQL, RLS, Realtime y Storage.
- **Imágenes de publicaciones:** Cloudflare R2 opcional; cédulas y comprobantes permanecen en buckets privados de Supabase.
- **Hosting previsto:** Vercel.

## Estructura relevante

```text
src/app/[locale]/       páginas localizadas de la aplicación
src/app/api/            rutas de servidor
src/lib/                clientes, autenticación y lógica compartida
supabase/migrations/    esquema versionado de Supabase
```
