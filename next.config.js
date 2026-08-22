/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  // Next.js requiert 'unsafe-inline' pour l'hydratation ; un CSP à base de
  // nonce est plus strict mais demande un middleware dédié — hors scope ici.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://app.paydunya.com https://*.sentry.io",
  "frame-src https://app.paydunya.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join('; ')

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Caméra autorisée (selfie de vérification d'identité) ; le reste bloqué.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  disableLogger: true,
  // Pas d'upload de source maps sans token d'auth (évite tout échec de build).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Envoi direct vers Sentry (autorisé dans la CSP connect-src *.sentry.io).
  // Pas de tunnelRoute : la route n'était pas générée (404) et bloquait l'envoi.
})
