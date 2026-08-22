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
    // Ignore le bruit des extensions de navigateur (ex. erreur "M_ID") et
    // quelques erreurs non actionnables : ce n'est pas du code de l'appli.
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
    ignoreErrors: [
      "Cannot read properties of undefined (reading 'M_ID')",
      /M_ID/,
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
    beforeSend(event) {
      // Filet supplémentaire : rejette tout événement dont une frame provient
      // d'une extension de navigateur.
      const frames = event?.exception?.values?.[0]?.stacktrace?.frames || []
      if (frames.some(f => typeof f.filename === 'string' && f.filename.includes('-extension://'))) {
        return null
      }
      return event
    },
  })
}

// Suivi des transitions de route (App Router)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
