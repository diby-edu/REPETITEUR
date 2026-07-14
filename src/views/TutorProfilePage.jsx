'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/common/Avatar'
import StarRating from '../components/common/StarRating'
import { VerifiedBadge, PremiumBadge, InactiveBadge, StatusBadge } from '../components/common/Badge'
import { Star, MapPin, Clock, MessageCircle, Calendar, CheckCircle, Heart, ChevronLeft, Send, Home, Building2, Users, Wifi } from 'lucide-react'
import { formatFCFA, formatDate, getDayLabel, MODALITIES } from '../utils/helpers'

const DAY_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export default function TutorProfilePage() {
  const { id } = useParams()
  const { getTutor, getTutorReviews, getOrCreateConversation, createBooking, addReview, addTutorResponse, showToast, toggleFavorite, isFavorite, loadTutorReviews, loadUserFavorites, tutors } = useApp()
  const { currentUser, isAuthenticated } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profil')
  const [bookingForm, setBookingForm] = useState({ date: '', time: '', duration: '60', subject: '', location: 'domicile_parent', notes: '' })
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' })
  const [respondingTo, setRespondingTo] = useState(null)
  const [response, setResponse] = useState('')

  const tutor = getTutor(id)
  const reviews = getTutorReviews(id)

  useEffect(() => {
    if (id) loadTutorReviews(id)
    if (currentUser?.id) loadUserFavorites(currentUser.id)
  }, [id, currentUser?.id])

  if (!tutor) {
    // Encore en chargement
    if (tutors.length === 0) {
      return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Chargement du profil...</p>
          </div>
        </div>
      )
    }
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Répétiteur introuvable</p>
          <Link href="/recherche" className="btn-primary mt-4 inline-block">Retour à la recherche</Link>
        </div>
      </div>
    )
  }

  const isVerified = tutor.verificationStatus === 'verified'
  const isPremium = tutor.subscription?.plan === 'premium'

  const handleContact = async () => {
    if (!isAuthenticated) { router.push('/connexion'); return }
    if (!tutor.isActive) { showToast('Ce répétiteur n\'est pas disponible actuellement.', 'error'); return }
    const conv = await getOrCreateConversation(currentUser.id, tutor.id)
    if (conv?.id) router.push(`/messagerie/${conv.id}`)
  }

  const handleBooking = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) { router.push('/connexion'); return }
    const booking = await createBooking({
      parentId: currentUser.id,
      tutorId: tutor.id,
      ...bookingForm,
      duration: Number.parseInt(bookingForm.duration),
    })
    if (booking) {
      setBookingForm({ date: '', time: '', duration: '60', subject: '', location: 'domicile_parent', notes: '' })
      router.push('/reservations')
    }
  }

  const handleReview = (e) => {
    e.preventDefault()
    if (!isAuthenticated) { router.push('/connexion'); return }
    addReview({
      tutorId: tutor.id,
      parentId: currentUser.id,
      parentName: `${currentUser.firstName.charAt(0)}. ${currentUser.lastName}`,
      ...reviewForm,
    })
    setReviewForm({ rating: 0, comment: '' })
    setActiveTab('avis')
  }

  const handleTutorResponse = (reviewId) => {
    if (!response.trim()) return
    addTutorResponse(reviewId, response)
    setRespondingTo(null)
    setResponse('')
  }

  const tabs = ['profil', 'disponibilités', 'avis']

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/recherche" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <span className="text-sm text-gray-500">Retour aux résultats</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Profile header card */}
            <div className="card mb-5">
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="flex-shrink-0">
                  <Avatar user={tutor} size="2xl" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <h1 className="font-display text-2xl font-bold text-gray-900">
                      {tutor.firstName} {tutor.lastName}
                    </h1>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isVerified && <VerifiedBadge />}
                      {isPremium && <PremiumBadge />}
                      {!tutor.isActive && <InactiveBadge />}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><MapPin size={14} />{tutor.quartier}, {tutor.city}</span>
                    <span className="flex items-center gap-1"><Clock size={14} />{tutor.sessionCount} séances</span>
                    {tutor.rating > 0 && <StarRating rating={tutor.rating} count={tutor.reviewCount} />}
                  </div>

                  {/* Subjects */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {tutor.subjects.map(s => (
                      <span key={s} className="text-sm bg-primary-50 text-primary-600 font-medium px-3 py-1 rounded-full">{s}</span>
                    ))}
                  </div>

                  {/* Levels */}
                  <div className="flex flex-wrap gap-1.5">
                    {tutor.levels.map(l => (
                      <span key={l} className="text-sm bg-secondary-50 text-secondary-600 font-medium px-3 py-1 rounded-full">{l}</span>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{formatFCFA(tutor.monthlyRate)}</p>
                  <p className="text-sm text-gray-400">par mois</p>
                  {isAuthenticated && currentUser?.role === 'parent' && (
                    <button
                      onClick={() => toggleFavorite(currentUser.id, tutor.id)}
                      className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
                    >
                      {isFavorite(currentUser.id, tutor.id)
                        ? <Heart size={16} className="fill-red-500 text-red-500" />
                        : <Heart size={16} />}
                      {isFavorite(currentUser.id, tutor.id) ? 'Favori' : 'Ajouter aux favoris'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-5 bg-white rounded-t-xl overflow-hidden">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-primary border-b-2 border-primary bg-primary-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'avis' ? `Avis (${reviews.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab: Profil */}
            {activeTab === 'profil' && (
              <div className="space-y-5">
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-3">À propos</h2>
                  <p className="text-gray-600 text-sm leading-relaxed">{tutor.bio}</p>
                </div>

                {tutor.modalities?.length > 0 && (
                  <div className="card">
                    <h2 className="font-semibold text-gray-900 mb-3">Modalités de cours</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {MODALITIES.map(m => {
                        const active = tutor.modalities.includes(m.id)
                        const iconMap = {
                          domicile_parent: <Home size={18} />,
                          domicile_repetiteur: <Building2 size={18} />,
                          lieu_neutre: <Users size={18} />,
                          en_ligne: <Wifi size={18} />,
                        }
                        return (
                          <div key={m.id} className={`flex items-start gap-3 p-3 rounded-xl border ${active ? 'border-primary-100 bg-primary-50' : 'border-gray-100 bg-gray-50 opacity-40'}`}>
                            <span className={`mt-0.5 ${active ? 'text-primary' : 'text-gray-400'}`}>{iconMap[m.id]}</span>
                            <div>
                              <p className={`text-sm font-semibold ${active ? 'text-gray-900' : 'text-gray-400'}`}>{m.label}</p>
                              <p className="text-xs text-gray-400">{m.desc}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {tutor.documents?.diplomes?.length > 0 && (
                  <div className="card">
                    <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={16} className="text-secondary" />
                      Diplômes vérifiés
                    </h2>
                    <ul className="space-y-2">
                      {tutor.documents.diplomes.map((d, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="w-1.5 h-1.5 bg-secondary rounded-full" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="card">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">{tutor.sessionCount}</p>
                      <p className="text-xs text-gray-500">Séances</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-secondary">{tutor.rating > 0 ? tutor.rating.toFixed(1) : '—'}</p>
                      <p className="text-xs text-gray-500">Note moy.</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent">{tutor.reviewCount}</p>
                      <p className="text-xs text-gray-500">Avis</p>
                    </div>
                  </div>
                </div>

                {reviews.length > 0 && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Star size={16} className="text-accent fill-accent" />
                        Derniers avis ({reviews.length})
                      </h2>
                      <button
                        onClick={() => setActiveTab('avis')}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Voir tout
                      </button>
                    </div>
                    <div className="space-y-3">
                      {reviews.slice(0, 3).map(review => (
                        <div key={review.id} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-gray-800">{review.parentName}</p>
                            <StarRating rating={review.rating} showNumber={false} size={13} />
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{review.comment}</p>
                          {review.tutorResponse && (
                            <p className="text-xs text-secondary mt-1 italic">
                              Répétiteur : {review.tutorResponse.substring(0, 80)}{review.tutorResponse.length > 80 ? '…' : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Disponibilités */}
            {activeTab === 'disponibilités' && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Planning hebdomadaire</h2>
                <div className="space-y-3">
                  {DAY_ORDER.map(day => {
                    const slots = tutor.availability[day] || []
                    return (
                      <div key={day} className="flex items-start gap-4">
                        <span className="text-sm font-medium text-gray-700 w-20 flex-shrink-0 pt-1">
                          {getDayLabel(day)}
                        </span>
                        {slots.length === 0 ? (
                          <span className="text-sm text-gray-400 italic">Non disponible</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {slots.sort().map(h => (
                              <span key={h} className="text-xs bg-primary-50 text-primary font-medium px-2.5 py-1 rounded-full">
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tab: Avis */}
            {activeTab === 'avis' && (
              <div className="space-y-4">
                {/* Rating summary */}
                {reviews.length > 0 && (
                  <div className="card">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-5xl font-bold text-gray-900">{tutor.rating.toFixed(1)}</p>
                        <StarRating rating={tutor.rating} showNumber={false} size={18} />
                        <p className="text-sm text-gray-400 mt-1">{reviews.length} avis</p>
                      </div>
                      <div className="flex-1">
                        {[5, 4, 3, 2, 1].map(n => {
                          const count = reviews.filter(r => r.rating === n).length
                          const pct = reviews.length ? (count / reviews.length) * 100 : 0
                          return (
                            <div key={n} className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500 w-4">{n}</span>
                              <Star size={12} className="text-accent fill-accent" />
                              <div className="flex-1 bg-gray-100 rounded-full h-2">
                                <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-400 w-4">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {reviews.map(review => (
                  <div key={review.id} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-800 text-sm">{review.parentName}</p>
                          <p className="text-xs text-gray-400">{formatDate(review.date)}</p>
                        </div>
                        <StarRating rating={review.rating} showNumber={false} />
                        <p className="text-gray-600 text-sm mt-2 leading-relaxed">{review.comment}</p>
                      </div>
                    </div>

                    {review.tutorResponse && (
                      <div className="mt-3 pt-3 border-t border-gray-50 bg-secondary-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-secondary mb-1">Réponse du répétiteur :</p>
                        <p className="text-sm text-gray-600">{review.tutorResponse}</p>
                      </div>
                    )}

                    {/* Tutor can respond */}
                    {currentUser?.id === tutor.id && !review.tutorResponse && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        {respondingTo === review.id ? (
                          <div className="flex gap-2">
                            <input
                              className="input-field flex-1 text-sm py-2"
                              placeholder="Votre réponse..."
                              value={response}
                              onChange={e => setResponse(e.target.value)}
                            />
                            <button onClick={() => handleTutorResponse(review.id)} className="btn-secondary py-2 px-3 text-sm">
                              <Send size={16} />
                            </button>
                            <button onClick={() => setRespondingTo(null)} className="text-gray-400 px-2">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setRespondingTo(review.id)} className="text-xs text-secondary hover:underline font-medium">
                            Répondre à cet avis
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {reviews.length === 0 && (
                  <div className="card text-center py-10">
                    <Star size={36} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">Aucun avis pour l'instant</p>
                  </div>
                )}

                {/* Leave a review */}
                {isAuthenticated && currentUser?.role === 'parent' && (
                  <div className="card">
                    <h3 className="font-semibold text-gray-900 mb-4">Laisser un avis</h3>
                    <form onSubmit={handleReview} className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} type="button" onClick={() => setReviewForm(p => ({ ...p, rating: n }))}>
                              <Star size={28} className={n <= reviewForm.rating ? 'text-accent fill-accent' : 'text-gray-200'} fill={n <= reviewForm.rating ? '#F4A61D' : 'none'} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Commentaire</label>
                        <textarea
                          className="input-field resize-none h-24"
                          placeholder="Partagez votre expérience avec ce répétiteur..."
                          value={reviewForm.comment}
                          onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                        />
                      </div>
                      <button type="submit" disabled={!reviewForm.rating || !reviewForm.comment} className="btn-primary text-sm disabled:opacity-50">
                        Publier l'avis
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            {/* Contact / Book */}
            <div className="card">
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-primary">{formatFCFA(tutor.monthlyRate)}</p>
                <p className="text-sm text-gray-400">/ mois</p>
              </div>

              {tutor.isActive ? (
                <>
                  <button onClick={handleContact} className="btn-primary w-full flex items-center justify-center gap-2 mb-2">
                    <MessageCircle size={18} />
                    Contacter
                  </button>
                  <button onClick={() => setActiveTab('réservation')} className="btn-outline w-full flex items-center justify-center gap-2">
                    <Calendar size={18} />
                    Demander une séance
                  </button>
                </>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <InactiveBadge />
                  <p className="text-sm text-gray-500 mt-2">Ce répétiteur n'est pas disponible actuellement.</p>
                </div>
              )}
            </div>

            {/* Quick booking form */}
            {tutor.isActive && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  Réserver une séance
                </h3>
                <form onSubmit={handleBooking} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Matière</label>
                    <select className="input-field text-sm py-2" value={bookingForm.subject} onChange={e => setBookingForm(p => ({ ...p, subject: e.target.value }))} required>
                      <option value="">Choisir</option>
                      {tutor.subjects.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input type="date" className="input-field text-sm py-2" value={bookingForm.date} onChange={e => setBookingForm(p => ({ ...p, date: e.target.value }))} required min={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Heure</label>
                    <input type="time" className="input-field text-sm py-2" value={bookingForm.time} onChange={e => setBookingForm(p => ({ ...p, time: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Durée</label>
                    <select className="input-field text-sm py-2" value={bookingForm.duration} onChange={e => setBookingForm(p => ({ ...p, duration: e.target.value }))}>
                      <option value="60">1 heure</option>
                      <option value="90">1h30</option>
                      <option value="120">2 heures</option>
                      <option value="180">3 heures</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Lieu</label>
                    <select className="input-field text-sm py-2" value={bookingForm.location} onChange={e => setBookingForm(p => ({ ...p, location: e.target.value }))}>
                      {(tutor.modalities || MODALITIES.map(m => m.id)).map(m => {
                        const found = MODALITIES.find(mo => mo.id === m)
                        return <option key={m} value={m}>{found?.label || m}</option>
                      })}
                    </select>
                  </div>
                  {isAuthenticated ? (
                    <button type="submit" className="btn-primary w-full text-sm">
                      Envoyer la demande
                    </button>
                  ) : (
                    <Link href="/connexion" className="btn-primary w-full text-sm text-center block">
                      Se connecter pour réserver
                    </Link>
                  )}
                </form>
              </div>
            )}

            {/* Info card */}
            <div className="card bg-secondary-50 border-secondary-100">
              <div className="flex items-start gap-3">
                <CheckCircle size={18} className="text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-secondary-700">Profil vérifié</p>
                  <p className="text-xs text-secondary-600 mt-1">CNI et diplômes contrôlés par notre équipe.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
