import * as Sentry from '@sentry/nextjs'

// Monitoring côté navigateur. Inerte tant qu'aucun DSN public n'est fourni.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Session Replay désactivé par défaut (respect vie privée / poids).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}

// Suivi des transitions de route (App Router)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
