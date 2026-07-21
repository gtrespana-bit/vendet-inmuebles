# 🇻🇪 Todo Anuncios — Marketplace para Venezuela

El marketplace venezolano. Compra y vende de todo: carros, tecnología, moda, hogar y más. Publica gratis, contacta directo.

## 🚀 Quick Start

### 1. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com) (gratis)
2. Ve al SQL Editor y ejecuta el archivo `supabase/migrations/001_schema_inicial.sql`
3. Copia tu **Project URL** y **anon/key** desde Settings → API

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon
```

### 3. Instalar y correr

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 🛠️ Stack

| Capa | herramienta |
|---|---|
| Frontend | Next.js 14 + React 18 |
| Estilos | Tailwind CSS |
| Backend | Supabase (DB + Auth + Storage + Realtime) |
| Hosting | Vercel |

## 📁 Estructura

```
src/
├── app/
│   ├── page.tsx                    # Home
│   ├── catalogo/page.tsx           # Catálogo con filtros
│   ├── producto/[slug]/page.tsx    # Detalle producto
│   ├── publicar/page.tsx           # Publicar producto (4 pasos)
│   ├── buscar/page.tsx             # Buscador
│   ├── chat/page.tsx               # Chat interno
│   ├── creditos/page.tsx           # Compra de créditos
│   ├── dashboard/page.tsx          # Panel del vendedor
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── mi-perfil/page.tsx
│   ├── como-funciona/page.tsx
│   ├── faq/page.tsx
│   ├── contacto/page.tsx
│   └── sobre-nosotros/page.tsx
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── AuthProvider.tsx
├── lib/
│   └── supabase.ts
supabase/
└── migrations/
    └── 001_schema_inicial.sql
```

## 🎨 Diseño

- **Primario:** Amarillo bandera `#C9A84C`
- **Secundario:** Azul bandera `#7B2D3B`
- **Acento:** Rojo bandera `#CF142B`

## 🚀 Deploy a Vercel

```bash
vercel
```

O desde GitHub → conecta tu repo en vercel.com → auto-deploy en cada push.

## 📋 Features

- ✅ Registro/Login con Supabase Auth
- ✅ Publicar productos gratis (formulario guiado 4 pasos)
- ✅ Catálogo con filtros (categoría, marca, modelo, estado, ubicación, precio)
- ✅ Detalle de producto con galería
- ✅ Chat interno (Supabase Realtime)
- ✅ Sistema de créditos para destacar publicaciones
- ✅ Perfiles con opciones de contacto (chat, WhatsApp, teléfono, email)
- ✅ SEO optimizado (meta tags, Open Graph, URLs amigables)
- ✅ Responsive (mobile-first)
- ✅ Optimizado para conexiones lentas
- ✅ Precios en USD con equivalente en Bs.

## 📝 Licencia

MIT
