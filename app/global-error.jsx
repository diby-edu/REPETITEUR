'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Error Boundary racine : capture les erreurs survenant dans le layout racine
// lui-même (là où app/error.jsx ne s'applique pas).
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Une erreur est survenue</h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Un problème inattendu s'est produit.</p>
          <button
            onClick={() => reset()}
            style={{ background: '#E87722', color: '#fff', border: 0, padding: '0.6rem 1.2rem', borderRadius: '0.75rem', cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
