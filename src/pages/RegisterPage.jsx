'use client'
import Link from 'next/link'
import { Users, GraduationCap, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl font-bold text-gray-900">Créer un compte</h1>
          <p className="text-gray-500 mt-2">Choisissez votre profil pour commencer</p>
        </div>

        <div className="grid gap-4">
          {/* Parent card */}
          <Link
            href="/inscription/parent"
            className="card group hover:shadow-card-hover hover:border-primary/20 border-2 border-transparent transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-secondary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary group-hover:scale-105 transition-all duration-200">
                <Users size={28} className="text-secondary group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-bold text-xl text-gray-900 group-hover:text-secondary transition-colors">
                    Je suis parent
                  </h2>
                  <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Gratuit</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Je cherche un répétiteur qualifié pour mon enfant. L'inscription est entièrement gratuite et sans abonnement.
                </p>
                <ul className="mt-2 space-y-1">
                  {['Recherche illimitée', 'Messagerie avec les répétiteurs', 'Réservation de séances'].map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className="w-1 h-1 bg-secondary rounded-full" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <ArrowRight size={20} className="text-gray-300 group-hover:text-secondary transition-colors flex-shrink-0" />
            </div>
          </Link>

          {/* Tutor card */}
          <Link
            href="/inscription/repetiteur"
            className="card group hover:shadow-card-hover hover:border-primary/20 border-2 border-transparent transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:scale-105 transition-all duration-200">
                <GraduationCap size={28} className="text-primary group-hover:text-white transition-colors" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-bold text-xl text-gray-900 group-hover:text-primary transition-colors">
                    Je suis répétiteur
                  </h2>
                  <span className="text-xs bg-primary-50 text-primary font-semibold px-2 py-0.5 rounded-full">dès 3 000 FCFA/mois</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Je veux proposer mes cours et développer mon activité. Je crée mon profil et choisis mon abonnement.
                </p>
                <ul className="mt-2 space-y-1">
                  {['Profil visible dans les recherches', 'Réception de demandes de séances', 'Gestion des réservations'].map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <div className="w-1 h-1 bg-primary rounded-full" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <ArrowRight size={20} className="text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="text-primary font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
