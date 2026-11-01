import * as Sentry from '@sentry/nextjs'
import { scrubSentryEvent } from '@/lib/sentry-scrubber'

export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event)
    },
  })
}

export const onRequestError = Sentry.captureRequestError
