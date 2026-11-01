import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

import {
  DEFAULT_GA4_MEASUREMENT_ID,
  GA4_MEASUREMENT_ID,
  GA4_SCRIPT_PATH,
  GA4_TRANSPORT_PATH,
  isValidGaMeasurementId,
  shouldTrackGaPath,
  sanitizeGaPagePath,
  buildGa4BootstrapScript,
} from '../src/lib/ga4.ts'

test('GA4: Measurement ID por defecto G-BSE60G6TX4, rutas first-party y validación de formato', () => {
  assert.equal(DEFAULT_GA4_MEASUREMENT_ID, 'G-BSE60G6TX4')
  assert.equal(GA4_MEASUREMENT_ID, 'G-BSE60G6TX4')
  assert.equal(GA4_SCRIPT_PATH, '/api/ga/js')
  assert.equal(GA4_TRANSPORT_PATH, '/api/ga')
  assert.equal(isValidGaMeasurementId('G-BSE60G6TX4'), true)
  assert.equal(isValidGaMeasurementId(''), false)
  assert.equal(isValidGaMeasurementId('UA-123456-1'), false)
  assert.equal(isValidGaMeasurementId('G-"><script>alert(1)</script>'), false)
})

test('GA4: exclusión de rutas internas (/admin, /api, /diagnostico) y redacción de tokens privados', () => {
  assert.equal(shouldTrackGaPath('/'), true)
  assert.equal(shouldTrackGaPath('/catalogo'), true)
  assert.equal(shouldTrackGaPath('/en/inmueble/apartamento-caracas'), true)
  assert.equal(shouldTrackGaPath('/admin'), false)
  assert.equal(shouldTrackGaPath('/en/admin/usuarios'), false)
  assert.equal(shouldTrackGaPath('/api/inmuebles'), false)
  assert.equal(shouldTrackGaPath('/diagnostico'), false)
  assert.equal(shouldTrackGaPath('/test-sentry'), false)

  assert.equal(
    sanitizeGaPagePath(
      '/invitacion/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
      '?utm_source=whatsapp&token=secreto123&email=privado@example.com'
    ),
    '/invitacion/[token]?utm_source=whatsapp'
  )
  assert.equal(
    sanitizeGaPagePath('/en/invitacion/secret_token_999', ''),
    '/en/invitacion/[token]'
  )
  assert.equal(
    sanitizeGaPagePath('/confirm', '?token_hash=pkce_secret&type=signup'),
    '/confirm?type=signup'
  )
})

test('GA4: script bootstrap implementa Google Consent Mode v2, transport_url first-party y protege URLs', () => {
  const script = buildGa4BootstrapScript('G-BSE60G6TX4')
  assert.match(script, /gtag\('consent','default'/)
  assert.match(script, /G-BSE60G6TX4/)

  const callsDenied = []
  const ctxDenied = {
    URLSearchParams,
    window: {
      dataLayer: [],
      localStorage: { getItem: () => null },
      location: {
        origin: 'https://venezuela-inmuebles.online',
        pathname: '/invitacion/999secret888token',
        search: '?token=abc&utm_source=email',
      },
    },
  }
  ctxDenied.dataLayer = ctxDenied.window.dataLayer
  vm.runInNewContext(script, ctxDenied)
  for (const entry of ctxDenied.window.dataLayer) {
    callsDenied.push(Array.from(entry))
  }

  assert.equal(callsDenied[0][0], 'consent')
  assert.equal(callsDenied[0][1], 'default')
  assert.equal(callsDenied[0][2].analytics_storage, 'denied')
  assert.equal(callsDenied[0][2].ad_storage, 'denied')

  const configCall = callsDenied.find((c) => c[0] === 'config')
  assert.ok(configCall, 'Debe ejecutar gtag("config", "G-BSE60G6TX4", ...)')
  assert.equal(configCall[1], 'G-BSE60G6TX4')
  assert.equal(configCall[2].transport_url, 'https://venezuela-inmuebles.online/api/ga')
  assert.equal(configCall[2].first_party_collection, true)
  assert.equal(configCall[2].page_path, '/invitacion/[token]?utm_source=email')
  assert.equal(
    configCall[2].page_location,
    'https://venezuela-inmuebles.online/invitacion/[token]?utm_source=email'
  )
  assert.equal(configCall[2].send_page_view, true)

  const ctxAdmin = {
    URLSearchParams,
    window: {
      dataLayer: [],
      localStorage: { getItem: (k) => (k === 'cookie-consent' ? 'accepted' : null) },
      location: {
        origin: 'https://venezuela-inmuebles.online',
        pathname: '/admin',
        search: '',
      },
    },
  }
  ctxAdmin.dataLayer = ctxAdmin.window.dataLayer
  vm.runInNewContext(script, ctxAdmin)
  const adminCalls = ctxAdmin.window.dataLayer.map((entry) => Array.from(entry))
  assert.equal(adminCalls[0][2].analytics_storage, 'granted')
  const adminConfig = adminCalls.find((c) => c[0] === 'config')
  assert.equal(adminConfig[2].send_page_view, false)
})

test('GA4 first-party proxy + higiene Realtime sin WebSockets globales innecesarios', () => {
  const nextConfig = readFileSync('next.config.js', 'utf8')
  assert.match(nextConfig, /script-src[^\n]*https:\/\/www\.googletagmanager\.com/)
  assert.match(nextConfig, /connect-src[^\n]*https:\/\/www\.google-analytics\.com/)

  const rootLayout = readFileSync('src/app/layout.tsx', 'utf8')
  assert.match(rootLayout, /\$\{GA4_SCRIPT_PATH\}\?id=\$\{GA4_MEASUREMENT_ID\}/)

  const localeLayout = readFileSync('src/app/[locale]/layout.tsx', 'utf8')
  assert.match(localeLayout, /<GoogleAnalyticsTracker\s*\/>/)

  // Higiene Realtime: ni Header/useUnreadMessages ni useDashboard abren WebSockets globales
  const unreadSrc = readFileSync('src/hooks/useUnreadMessages.ts', 'utf8')
  assert.doesNotMatch(unreadSrc, /\.channel\(/)

  const dashboardSrc = readFileSync('src/app/[locale]/dashboard/hooks/useDashboard.ts', 'utf8')
  assert.doesNotMatch(dashboardSrc, /\.channel\(/)

  const chatSrc = readFileSync('src/app/[locale]/chat/ChatPage.tsx', 'utf8')
  assert.match(chatSrc, /chat-sync-\$\{uid\}/)
  assert.match(chatSrc, /CHANNEL_ERROR/)
  assert.match(chatSrc, /TIMED_OUT/)
})
