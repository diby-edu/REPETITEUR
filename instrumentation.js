import * as Sentry from '@sentry/nextjs'

// Monitoring serveur (Node + Edge). Inerte tant qu'aucun DSN n'est fourni.
export async function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    })
  }
}

// Capture des erreurs des composants serveur / route handlers
export const onRequestError = Sentry.captureRequestError
