const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request-config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = withNextIntl({
  // Permite aislar el directorio de compilación (p. ej. `NEXT_DIST_DIR=.next-dev npm run dev`)
  // para que `next build` no sobrescriba los artefactos de un servidor de desarrollo en marcha.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    
    // Habilitar optimizaciones de compilación
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['data-testid'] } : undefined,
  },

  experimental: {
    serverComponentsExternalPackages: ['tesseract.js', 'tesseract.js-core', '@tesseract.js-data/eng'],
    outputFileTracingIncludes: {
      '/api/pagos/*/comprobante': ['./node_modules/tesseract.js/**', './node_modules/tesseract.js-core/**', './node_modules/@tesseract.js-data/eng/**'],
    },
    optimizePackageImports: [
      'lucide-react',
      '@supabase/supabase-js',
      '@supabase/ssr',
      'date-fns',
    ],
    scrollRestoration: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'quxbqmqwiacfwbpqioev.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-d212837165c545e3956251da001fa37a.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-cafe0dcf4c8f4ee18f3a6c0761c55493.r2.dev',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 384, 440, 512, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 640, 750],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  compress: true,

  poweredByHeader: false,

  reactStrictMode: true,

  // ---------------------------------------------------------------------------
  // Seguridad: cabeceras HTTP en todas las respuestas
  // ---------------------------------------------------------------------------
  async headers() {
    const supabaseHost = 'https://quxbqmqwiacfwbpqioev.supabase.co'
    // CSP: 'unsafe-inline' en script-src es necesario por los JSON-LD inline de
    // Next; se compensa con object-src 'none', base-uri 'self' y frame-ancestors 'none'.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.sentry.io",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.r2.dev https://images.unsplash.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' " + supabaseHost + " wss://quxbqmqwiacfwbpqioev.supabase.co https://*.r2.dev https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://*.sentry.io https://api.telegram.org",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; ')

    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ]

    return [
      {
        // Cabeceras de seguridad en todas las rutas
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Cache agresivo e inmutable para los assets estáticos compilados
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Imágenes públicas (favicon, iconos, OG, fotos demo): cache de 1 día
        source: '/:path*.(png|jpg|jpeg|webp|avif|svg|ico|gif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ]
  },

  // Configuración de salida optimizada
  output: 'standalone',

  // Optimizaciones de webpack
  webpack: (config, { isServer, dev }) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Minificación adicional en producción
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 30,
          minSize: 20000,
          cacheGroups: {
            // React DOM only (needed for rendering)
            reactDom: {
              test: /[\\/]node_modules[\\/](react-dom)[\\/]/,
              name: 'react-dom',
              priority: 50,
              chunks: 'all',
              enforce: true,
            },
            // React core (needed for hooks, JSX)
            react: {
              test: /[\\/]node_modules[\\/](react|scheduler)[\\/]/,
              name: 'react',
              priority: 45,
              chunks: 'all',
              enforce: true,
            },
            // Next.js internals (routing, hydration)
            nextjs: {
              test: /[\\/]node_modules[\\/]next[\\/]dist[\\/]/,
              name: 'nextjs',
              priority: 40,
              chunks: 'all',
              enforce: true,
            },
            // Supabase - defer load (only needed for auth)
            supabase: {
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              name: 'supabase',
              priority: 30,
              chunks: 'all',
              enforce: true,
            },
            // Internationalization
            intl: {
              test: /[\\/]node_modules[\\/](next-intl|intl-messageformat|@formatjs)[\\/]/,
              name: 'intl',
              priority: 25,
              chunks: 'all',
              enforce: true,
            },
            // Lucide icons (can be loaded later)
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'lucide',
              priority: 20,
              chunks: 'all',
              enforce: true,
            },
            // Remaining vendors
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },
});

// Configuración de Sentry - DESHABILITADO completamente para evitar problemas de Lighthouse
// module.exports = withSentryConfig(nextConfig, {
//   org: process.env.SENTRY_ORG,
//   project: process.env.SENTRY_PROJECT,
//   silent: true,
//   hideSourceMaps: true,
//   widenClientFileUpload: true,
//   sourcemaps: { deleteSourcemapsAfterUpload: true },
//   tunnelRoute: '/monitoring',
//   disableServerWebpackPlugin: true,
//   disableClientWebpackPlugin: true,
// });

module.exports = nextConfig;
