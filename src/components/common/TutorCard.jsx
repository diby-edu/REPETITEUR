'use client'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import Avatar from './Avatar'
import StarRating from './StarRating'
import { formatFCFA, getInitials } from '../../utils/helpers'

// Petit rond de vérification réutilisable
function VerifCheck({ className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-secondary text-white border-2 border-white shadow-sm ${className}`} title="Profil vérifié">
      <svg viewBox="0 0 12 12" className="w-3.5 h-3.5"><path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
    </span>
  )
}

function DispoPill() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-white/95 text-green-600 px-2.5 py-1 rounded-full shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Disponible
    </span>
  )
}

export default function TutorCard({ tutor, compact = false, list = false }) {
  const isVerified = tutor.verificationStatus === 'verified'
  const isPremium = tutor.subscription?.plan === 'premium'
  const priceLabel = (tutor.priceMin && tutor.priceMax && tutor.priceMin !== tutor.priceMax)
    ? `${formatFCFA(tutor.priceMin)} – ${formatFCFA(tutor.priceMax)}`
    : formatFCFA(tutor.priceMin || tutor.monthlyRate || 0)
  const initials = getInitials(tutor.firstName, tutor.lastName)
  const gradient = `linear-gradient(150deg, ${tutor.avatarColor || '#2D6A4F'}, rgba(0,0,0,.3))`
  const href = `/repetiteur/${tutor.id}`

  const Photo = ({ className, rounded = 'rounded-none' }) => (
    <div className={`relative overflow-hidden ${className}`}>
      {tutor.avatarUrl ? (
        <img src={tutor.avatarUrl} alt={`${tutor.firstName} ${tutor.lastName}`} className={`w-full h-full object-cover ${rounded}`} />
      ) : (
        <div className={`w-full h-full flex items-center justify-center font-display font-extrabold text-white ${rounded}`} style={{ background: gradient }}>
          {initials}
        </div>
      )}
    </div>
  )

  // ── Variante compacte (listes serrées : sidebars) ──
  if (compact) {
    return (
      <Link href={href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
        <Avatar user={tutor} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-primary transition-colors">{tutor.firstName} {tutor.lastName}</p>
          <p className="text-xs text-gray-500 truncate">{tutor.subjects.slice(0, 2).join(', ')}</p>
          <StarRating rating={tutor.rating} size={12} count={tutor.reviewCount} />
        </div>
        <p className="text-sm font-bold text-primary whitespace-nowrap">{priceLabel}<span className="text-xs font-normal text-gray-400">/mois</span></p>
      </Link>
    )
  }

  // ── Variante liste (recherche : carte horizontale) ──
  if (list) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-card-hover transition-all p-3 flex flex-wrap sm:flex-nowrap items-center gap-4 group">
        <Link href={href} className="flex items-center gap-4 flex-1 min-w-0 no-underline">
          <div className="relative w-24 h-24 flex-shrink-0">
            <Photo className="w-24 h-24 rounded-xl" rounded="rounded-xl" />
            {isVerified && <VerifCheck className="absolute -bottom-1.5 -right-1.5 w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-gray-900 text-base group-hover:text-primary transition-colors truncate">{tutor.firstName} {tutor.lastName}</h3>
              {tutor.isActive && <DispoPill />}
              {isPremium && <span className="text-[10px] font-bold bg-accent text-white px-2 py-0.5 rounded-full">★ Premium</span>}
            </div>
            <p className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1"><MapPin size={12} />{tutor.quartier}, {tutor.city}</span>
              {tutor.rating > 0 && <><span>·</span><StarRating rating={tutor.rating} count={tutor.reviewCount} size={12} /></>}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {tutor.subjects.slice(0, 3).map(s => <span key={s} className="text-[11px] bg-primary-50 text-primary-600 font-medium px-2 py-0.5 rounded-full">{s}</span>)}
              {tutor.levels?.map(l => <span key={l} className="text-[11px] bg-secondary-50 text-secondary-600 font-medium px-2 py-0.5 rounded-full">{l}</span>)}
            </div>
          </div>
        </Link>
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 w-full sm:w-auto flex-shrink-0">
          <p className="font-display font-extrabold text-primary text-base whitespace-nowrap">{priceLabel}<span className="text-[10px] font-normal text-gray-400 ml-0.5">/mois</span></p>
          <Link href={href} className="text-sm font-bold text-white bg-primary rounded-xl px-5 py-2.5 hover:bg-primary-600 transition-colors whitespace-nowrap">Voir le profil</Link>
        </div>
      </div>
    )
  }

  // ── Carte « photo pleine » (landing, recherche grille, dashboard parent) ──
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-card-hover transition-all duration-200 flex flex-col group">
      <Link href={href} className="flex-1 flex flex-col no-underline">
        <div className="relative aspect-square">
          <Photo className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
            {tutor.isActive ? <DispoPill /> : <span />}
            {isVerified && <VerifCheck className="w-6 h-6" />}
          </div>
          {isPremium && <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold bg-accent text-white px-2 py-0.5 rounded-full shadow-sm">★ Premium</span>}
        </div>

        <div className="p-3 flex flex-col gap-2">
          <div>
            <h3 className="font-display font-bold text-gray-900 text-[15px] leading-tight group-hover:text-primary transition-colors truncate">{tutor.firstName} {tutor.lastName}</h3>
            <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><MapPin size={12} className="flex-shrink-0" /><span className="truncate">{tutor.quartier}, {tutor.city}</span></p>
          </div>
          {tutor.levels?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tutor.levels.map(l => <span key={l} className="text-[11px] bg-secondary-50 text-secondary-600 font-medium px-2 py-0.5 rounded-full">{l}</span>)}
            </div>
          )}
          {tutor.rating > 0
            ? <StarRating rating={tutor.rating} count={tutor.reviewCount} size={13} />
            : <span className="text-[11px] text-gray-400">Nouveau profil</span>}
          <p className="font-display font-extrabold text-primary text-[15px]">{priceLabel}<span className="text-[10px] font-normal text-gray-400 ml-0.5">/mois</span></p>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <Link href={href} className="block text-center text-sm font-bold text-white bg-primary rounded-xl py-2.5 hover:bg-primary-600 transition-colors">Voir le profil</Link>
      </div>
    </div>
  )
}
