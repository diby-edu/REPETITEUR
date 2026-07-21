'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import TutorCard from '../components/common/TutorCard'
import { Heart, Search } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'

export default function FavoritesPage() {
  const { getUserFavorites, loadUserFavorites } = useApp()
  const { currentUser } = useAuth()

  useEffect(() => {
    if (currentUser?.id) loadUserFavorites(currentUser.id)
  }, [currentUser?.id])

  const favorites = getUserFavorites(currentUser.id)

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Heart size={22} className="text-red-500 fill-red-500" />
          <h1 className="font-display text-2xl font-bold text-gray-900">Mes favoris</h1>
          <span className="bg-gray-100 text-gray-500 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {favorites.length}
          </span>
        </div>

        {favorites.length === 0 ? (
          <div className="card text-center py-20">
            <Heart size={48} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-700 text-lg mb-2">Aucun favori pour l'instant</h3>
            <p className="text-gray-400 text-sm mb-6">
              Ajoutez des répétiteurs à vos favoris pour les retrouver facilement.
            </p>
            <Link href="/recherche" className="btn-primary inline-flex items-center gap-2">
              <Search size={16} />
              Trouver un répétiteur
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {favorites.map(tutor => (
              <TutorCard key={tutor.id} tutor={tutor} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
