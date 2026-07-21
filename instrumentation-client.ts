import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Only 10% of transactions get traced (was 50%)
  tracesSampleRate: 0.1,
  // Disable performance-heavy integrations
  integrations: (integrations) =>
    integrations.filter(
      (i) => i.name !== 'BrowserTracing' && i.name !== 'Replay'
    ),
  // Don't send PII
  sendDefaultPii: false,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
