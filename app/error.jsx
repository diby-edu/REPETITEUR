'use client'
import { useEffect } from 'react'
import Link from 'next/link'

// Error Boundary global (App Router). Évite l'écran blanc « Application error »
// et offre un point d'accroche pour un monitoring (Sentry, etc.).
export default function Error({ error, reset }) {
  useEffect(() => {
    // TODO monitoring : remonter l'erreur (Sentry.captureException(error))
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Une erreur est survenue</h1>
        <p className="text-gray-500 text-sm mb-6">
          Un problème inattendu s'est produit. Vous pouvez réessayer ou revenir à l'accueil.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => reset()} className="btn-primary">Réessayer</button>
          <Link href="/" className="btn-secondary">Accueil</Link>
        </div>
      </div>
    </div>
  )
}
