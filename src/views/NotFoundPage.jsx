'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, Search, ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  const router = useRouter()

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-8 relative">
          <div className="w-40 h-40 mx-auto bg-primary-50 rounded-full flex items-center justify-center">
            <span className="font-display font-bold text-7xl text-primary leading-none">4</span>
          </div>
          <div className="absolute top-0 right-1/4 w-12 h-12 bg-accent-50 rounded-full flex items-center justify-center border-4 border-white">
            <span className="font-display font-bold text-xl text-accent">0</span>
          </div>
          <div className="absolute bottom-0 left-1/4 w-12 h-12 bg-secondary-50 rounded-full flex items-center justify-center border-4 border-white">
            <span className="font-display font-bold text-xl text-secondary">4</span>
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold text-gray-900 mb-3">
          Page introuvable
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Oops ! La page que vous cherchez n'existe pas ou a été déplacée.
          Ne vous inquiétez pas, nos répétiteurs sont toujours là pour vous aider !
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="btn-outline flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
          <Link href="/" className="btn-primary flex items-center justify-center gap-2">
            <Home size={16} />
            Accueil
          </Link>
          <Link href="/recherche" className="btn-secondary flex items-center justify-center gap-2">
            <Search size={16} />
            Rechercher
          </Link>
        </div>
      </div>
    </div>
  )
}
