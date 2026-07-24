const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request-config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = withNextIntl({
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
    
    // Habilitar optimizaciones de compilación
    reactRemoveProperties: process.env.NODE_ENV === 'production' ? { properties: ['data-testid'] } : undefined,
  },

  experimental: {
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
        hostname: 'byqrmrcoinybbcmdnnwn.supabase.co',
        pathname: '/storage/v1/object/public/**',
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
//   org: 'vendet-venezuela',
//   project: 'vendet-venezuela',
//   silent: true,
//   hideSourceMaps: true,
//   widenClientFileUpload: true,
//   sourcemaps: { deleteSourcemapsAfterUpload: true },
//   tunnelRoute: '/monitoring',
//   disableServerWebpackPlugin: true,
//   disableClientWebpackPlugin: true,
// });

module.exports = nextConfig;
