'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Clock, Home, Building2, Wifi, Users, MessageCircle } from 'lucide-react'
import Avatar from './Avatar'
import StarRating from './StarRating'
import { VerifiedBadge, PremiumBadge, InactiveBadge } from './Badge'
import { formatFCFA } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'

export default function TutorCard({ tutor, compact = false }) {
  const isVerified = tutor.verificationStatus === 'verified'
  const isPremium = tutor.subscription?.plan === 'premium'
  const { currentUser, isAuthenticated } = useAuth()
  const { getOrCreateConversation, showToast } = useApp()
  const router = useRouter()

  const handleContact = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) { router.push('/connexion'); return }
    if (!tutor.isActive) { showToast('Ce répétiteur n\'est pas disponible actuellement.', 'error'); return }
    const conv = await getOrCreateConversation(currentUser.id, tutor.id)
    router.push(`/messagerie/${conv.id}`)
  }

  if (compact) {
    return (
      <Link href={`/repetiteur/${tutor.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
        <Avatar user={tutor} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-primary transition-colors">
            {tutor.firstName} {tutor.lastName}
          </p>
          <p className="text-xs text-gray-500 truncate">{tutor.subjects.slice(0, 2).join(', ')}</p>
          <StarRating rating={tutor.rating} size={12} count={tutor.reviewCount} />
        </div>
        <p className="text-sm font-bold text-primary whitespace-nowrap">{formatFCFA(tutor.monthlyRate)}<span className="text-xs font-normal text-gray-400">/mois</span></p>
      </Link>
    )
  }

  return (
    <div className="card hover:shadow-card-hover transition-all duration-200 group flex flex-col">
      <Link href={`/repetiteur/${tutor.id}`} className="flex-1 flex flex-col no-underline">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <Avatar user={tutor} size="lg" />
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary rounded-full flex items-center justify-center border-2 border-white">
                <svg viewBox="0 0 12 12" className="w-3 h-3 text-white fill-white">
                  <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base leading-tight group-hover:text-primary transition-colors">
              {tutor.firstName} {tutor.lastName}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isVerified && <VerifiedBadge />}
              {isPremium && <PremiumBadge />}
              {!tutor.isActive && <InactiveBadge />}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <MapPin size={12} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">{tutor.quartier}, {tutor.city}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-50">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tutor.subjects.slice(0, 3).map(s => (
              <span key={s} className="text-xs bg-primary-50 text-primary-600 font-medium px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
            {tutor.subjects.length > 3 && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                +{tutor.subjects.length - 3}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {tutor.levels.map(l => (
              <span key={l} className="text-xs bg-secondary-50 text-secondary-600 font-medium px-2 py-0.5 rounded-full">
                {l}
              </span>
            ))}
          </div>

          {tutor.modalities?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tutor.modalities.map(m => {
                const icons = {
                  domicile_parent: <Home size={10} />,
                  domicile_repetiteur: <Building2 size={10} />,
                  lieu_neutre: <Users size={10} />,
                  en_ligne: <Wifi size={10} />,
                }
                const labels = {
                  domicile_parent: 'Dom. parent',
                  domicile_repetiteur: 'Dom. répétiteur',
                  lieu_neutre: 'Lieu neutre',
                  en_ligne: 'En ligne',
                }
                return (
                  <span key={m} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {icons[m]}{labels[m]}
                  </span>
                )
              })}
            </div>
          )}

          {tutor.rating > 0 && (
            <div className="flex items-center justify-between mb-3">
              <StarRating rating={tutor.rating} count={tutor.reviewCount} />
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={12} />
                <span>{tutor.sessionCount} séances</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-primary-50 rounded-xl px-3 py-2">
            <span className="text-xs text-gray-500 font-medium">Tarif mensuel</span>
            <span className="text-base font-bold text-primary">
              {formatFCFA(tutor.monthlyRate)}<span className="text-xs font-normal text-gray-400 ml-1">/ mois</span>
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex gap-2">
        <Link
          href={`/repetiteur/${tutor.id}`}
          className="flex-1 text-center text-sm font-semibold text-primary border border-primary rounded-full py-2 hover:bg-primary hover:text-white transition-all duration-200"
        >
          Voir le profil
        </Link>
        {tutor.isActive && (
          <button
            onClick={handleContact}
            className="flex items-center justify-center gap-1.5 px-4 text-sm font-semibold bg-secondary text-white rounded-full py-2 hover:bg-secondary-600 transition-all duration-200"
          >
            <MessageCircle size={15} />
            Contacter
          </button>
        )}
      </div>
    </div>
  )
}
