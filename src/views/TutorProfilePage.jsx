'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import StarRating from '../components/common/StarRating'
import { VerifiedBadge, PremiumBadge, InactiveBadge } from '../components/common/Badge'
import { Star, MapPin, Clock, CheckCircle, Heart, ChevronLeft, Send, Home, Building2, Users, Wifi, GraduationCap, ChevronDown } from 'lucide-react'
import { formatFCFA, formatDate, MODALITIES } from '../utils/helpers'

// Regroupement des offres par cycle pour l'accordéon (replié par défaut).
const CYCLE_ORDER = ['primaire', 'college', 'lycee']
const CYCLE_LABEL = { primaire: 'Primaire', college: 'Collège', lycee: 'Lycée' }

export default function TutorProfilePage() {
  const { id } = useParams()
  const { getTutor, getTutorReviews, createEngagement, addReview, addTutorResponse, showToast, toggleFavorite, isFavorite, loadTutorReviews, loadUserFavorites, tutors, levelPackages } = useApp()
  const { currentUser, isAuthenticated } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profil')
  const [subForm, setSubForm] = useState({ levelKey: '', schedule: '' })
  const [subscribing, setSubscribing] = useState(false)
  const [openCycles, setOpenCycles] = useState({})   // accordéon tarifs : replié par défaut
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
  const priceLabel = (tutor.priceMin && tutor.priceMax && tutor.priceMin !== tutor.priceMax)
    ? `${formatFCFA(tutor.priceMin)} – ${formatFCFA(tutor.priceMax)}`
    : formatFCFA(tutor.priceMin || tutor.monthlyRate || 0)
  const selectedOffer = tutor.offers?.find(o => o.levelKey === subForm.levelKey)
  const selectedPkg = levelPackages.find(p => p.levelKey === subForm.levelKey)

  // Offres regroupées par cycle
  const offersByCycle = {}
  ;(tutor.offers || []).forEach(o => {
    const pkg = levelPackages.find(p => p.levelKey === o.levelKey)
    const cat = pkg?.category || 'autre'
    ;(offersByCycle[cat] = offersByCycle[cat] || []).push({ ...o, pkg })
  })
  const cyclesWithOffers = CYCLE_ORDER.filter(c => offersByCycle[c]?.length > 0)
  const toggleCycle = (c) => setOpenCycles(s => ({ ...s, [c]: !s[c] }))

  const scrollToRecruit = () => {
    const el = document.getElementById('recruter')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else router.push('/connexion')
  }

  const handleSubscribe = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) { router.push('/connexion'); return }
    if (!selectedOffer) { showToast('Choisissez une classe.', 'error'); return }
    setSubscribing(true)
    const eng = await createEngagement({
      parentId: currentUser.id,
      tutorId: tutor.id,
      levelKey: selectedOffer.levelKey,
      subjects: selectedOffer.subjects,
      monthlyRate: selectedOffer.monthlyPrice,
      agreedSchedule: subForm.schedule,
    })
    setSubscribing(false)
    if (eng) router.push('/reservations')
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
    setReviewForm({ rating: 0, comment: '', anonymous: false })
    setActiveTab('avis')
  }

  const handleTutorResponse = (reviewId) => {
    if (!response.trim()) return
    addTutorResponse(reviewId, response)
    setRespondingTo(null)
    setResponse('')
  }

  const tabs = ['profil', 'avis']
  const canRecruit = tutor.isActive && (!isAuthenticated || currentUser?.role === 'parent')
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase()

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      {/* Barre retour */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/recherche" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <span className="text-sm text-gray-500">Retour aux résultats</span>
        </div>
      </div>

      {/* ===== HERO Option A ===== */}
      <div className="bg-gradient-to-br from-[#B85416] via-primary to-accent text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Photo XL (carré arrondi) */}
            <div className="w-32 h-32 rounded-2xl overflow-hidden flex-shrink-0 border-[3px] border-white/60 shadow-lg">
              {tutor.avatarUrl ? (
                <img src={tutor.avatarUrl} alt={`${tutor.firstName} ${tutor.lastName}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display font-extrabold text-4xl"
                     style={{ background: `linear-gradient(140deg, ${tutor.avatarColor || '#2D6A4F'}, rgba(0,0,0,.25))` }}>
                  {initials}
                </div>
              )}
            </div>

            {/* Identité */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight">
                {tutor.firstName} {tutor.lastName}
              </h1>
              <p className="text-white/90 text-sm font-medium mt-0.5">
                Répétiteur{tutor.subjects?.length > 0 ? ` · ${tutor.subjects.slice(0, 3).join(', ')}` : ''}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-sm text-white/95 mt-3">
                <span className="flex items-center gap-1"><MapPin size={14} />{tutor.quartier}, {tutor.city}</span>
                <span className="flex items-center gap-1"><Clock size={14} />{tutor.sessionCount} séances</span>
              </div>

              {/* Badges de confiance dans le hero */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                {isVerified && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1">
                    <CheckCircle size={13} /> Profil vérifié
                  </span>
                )}
                {tutor.rating > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1">
                    <Star size={13} className="fill-white" /> {tutor.rating.toFixed(1)} ({tutor.reviewCount} avis)
                  </span>
                )}
                {tutor.isActive
                  ? <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1"><span className="w-2 h-2 rounded-full bg-green-300" /> Disponible</span>
                  : <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-black/20 rounded-full px-3 py-1">Indisponible</span>}
                {isPremium && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-accent/90 text-white rounded-full px-3 py-1">★ Premium</span>
                )}
              </div>
            </div>

            {/* Prix + CTA */}
            <div className="flex flex-col items-center sm:items-end gap-3 flex-shrink-0">
              <div className="text-center sm:text-right">
                <p className="font-display text-2xl font-extrabold leading-none">{priceLabel}</p>
                <p className="text-xs text-white/80">FCFA / mois</p>
              </div>
              {canRecruit && (
                <button onClick={scrollToRecruit}
                        className="bg-white text-primary-600 font-bold text-sm rounded-xl px-5 py-3 hover:bg-white/90 transition-colors shadow">
                  🎯 Je recrute ce répétiteur
                </button>
              )}
              {isAuthenticated && currentUser?.role === 'parent' && (
                <button onClick={() => toggleFavorite(currentUser.id, tutor.id)}
                        className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white transition-colors">
                  <Heart size={15} className={isFavorite(currentUser.id, tutor.id) ? 'fill-white' : ''} />
                  {isFavorite(currentUser.id, tutor.id) ? 'Favori' : 'Ajouter aux favoris'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Corps ===== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Colonne principale */}
          <div className="flex-1 min-w-0">
            {/* Tarifs par classe — accordéon cycle → classe (replié par défaut) */}
            {cyclesWithOffers.length > 0 && (
              <div className="mb-5">
                <h2 className="font-display font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
                  <GraduationCap size={18} className="text-primary" /> Tarifs par classe
                </h2>
                <div className="space-y-2.5">
                  {cyclesWithOffers.map(cycle => {
                    const open = !!openCycles[cycle]
                    const offers = offersByCycle[cycle]
                    return (
                      <div key={cycle} className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                        <button onClick={() => toggleCycle(cycle)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-secondary to-[#245a42] text-white">
                          <span className="font-display font-semibold flex items-center gap-2">
                            {CYCLE_LABEL[cycle]}
                            <span className="text-xs font-normal text-white/80">· {offers.length} classe{offers.length > 1 ? 's' : ''}</span>
                          </span>
                          <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <div className="p-3 grid sm:grid-cols-2 gap-2.5">
                            {offers.map(o => (
                              <div key={o.levelKey} className="border border-gray-100 rounded-xl p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-display font-semibold text-gray-800 text-sm">{o.pkg?.label || o.levelKey}</p>
                                  <p className="text-primary font-bold whitespace-nowrap text-sm">
                                    {formatFCFA(o.monthlyPrice)}<span className="text-[10px] font-normal text-gray-400">/mois</span>
                                  </p>
                                </div>
                                {o.pkg && (
                                  <p className="text-[11px] text-gray-400 mt-0.5">
                                    {o.pkg.sessionsPerWeek} séance{o.pkg.sessionsPerWeek > 1 ? 's' : ''}/sem · {o.pkg.hoursPerMonth}h/mois
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {o.pkg?.hasSubjects === false
                                    ? <span className="text-[11px] bg-accent-50 text-accent-600 px-2 py-0.5 rounded-full">Toutes les matières</span>
                                    : (o.subjects || []).map(s => (
                                        <span key={s} className="text-[11px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">{s}</span>
                                      ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Onglets */}
            <div className="flex border-b border-gray-200 mb-5 bg-white rounded-t-xl overflow-hidden">
              {tabs.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                          activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary-50' : 'text-gray-500 hover:text-gray-700'
                        }`}>
                  {tab === 'avis' ? `Avis (${reviews.length})` : 'Profil'}
                </button>
              ))}
            </div>

            {/* Onglet Profil */}
            {activeTab === 'profil' && (
              <div className="space-y-5">
                {tutor.bio && (
                  <div className="card">
                    <h2 className="font-semibold text-gray-900 mb-3">À propos</h2>
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{tutor.bio}</p>
                  </div>
                )}

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

                {tutor.diplomaNames?.length > 0 && (
                  <div className="card">
                    <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={16} className="text-secondary" /> Diplômes vérifiés
                    </h2>
                    <ul className="space-y-2">
                      {tutor.diplomaNames.map((name, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="w-1.5 h-1.5 bg-secondary rounded-full" />{name}
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
                        <Star size={16} className="text-accent fill-accent" /> Derniers avis ({reviews.length})
                      </h2>
                      <button onClick={() => setActiveTab('avis')} className="text-xs text-primary font-medium hover:underline">Voir tout</button>
                    </div>
                    <div className="space-y-3">
                      {reviews.slice(0, 3).map(review => (
                        <div key={review.id} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-gray-800">{review.anonymous ? 'Parent vérifié' : review.parentName}</p>
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

            {/* Onglet Avis */}
            {activeTab === 'avis' && (
              <div className="space-y-4">
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
                          <p className="font-semibold text-gray-800 text-sm">{review.anonymous ? 'Parent vérifié' : review.parentName}</p>
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
                    {currentUser?.id === tutor.id && !review.tutorResponse && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        {respondingTo === review.id ? (
                          <div className="flex gap-2">
                            <input className="input-field flex-1 text-sm py-2" placeholder="Votre réponse..."
                                   value={response} onChange={e => setResponse(e.target.value)} />
                            <button onClick={() => handleTutorResponse(review.id)} className="btn-secondary py-2 px-3 text-sm"><Send size={16} /></button>
                            <button onClick={() => setRespondingTo(null)} className="text-gray-400 px-2">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setRespondingTo(review.id)} className="text-xs text-secondary hover:underline font-medium">Répondre à cet avis</button>
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
                        <textarea className="input-field resize-none h-24" placeholder="Partagez votre expérience avec ce répétiteur..."
                                  value={reviewForm.comment} onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={!!reviewForm.anonymous}
                               onChange={e => setReviewForm(p => ({ ...p, anonymous: e.target.checked }))}
                               className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className="text-sm text-gray-600">Publier en anonyme (affiché « Parent vérifié »)</span>
                      </label>
                      <button type="submit" disabled={!reviewForm.rating || !reviewForm.comment} className="btn-primary text-sm disabled:opacity-50">Publier l'avis</button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar : recrutement */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            {canRecruit && tutor.offers?.length > 0 && (
              <div id="recruter" className="card scroll-mt-20">
                <div className="text-center mb-4">
                  <p className="text-2xl font-bold text-primary">{priceLabel}</p>
                  <p className="text-sm text-gray-400">FCFA / mois</p>
                </div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <GraduationCap size={16} className="text-primary" /> Je recrute ce répétiteur
                </h3>
                <form onSubmit={handleSubscribe} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Classe de l'enfant</label>
                    <select className="input-field text-sm py-2" value={subForm.levelKey}
                            onChange={e => setSubForm(p => ({ ...p, levelKey: e.target.value }))} required>
                      <option value="">Choisir une classe</option>
                      {tutor.offers.map(o => {
                        const pkg = levelPackages.find(p => p.levelKey === o.levelKey)
                        return <option key={o.levelKey} value={o.levelKey}>{(pkg?.label || o.levelKey)} — {formatFCFA(o.monthlyPrice)}/mois</option>
                      })}
                    </select>
                  </div>

                  {selectedOffer && (
                    <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1">
                      {selectedPkg && <p>Forfait : <strong>{selectedPkg.sessionsPerWeek} séance{selectedPkg.sessionsPerWeek > 1 ? 's' : ''}/sem · {selectedPkg.hoursPerMonth}h/mois</strong></p>}
                      {selectedOffer.subjects?.length > 0 && <p>Matières : {selectedOffer.subjects.join(', ')}</p>}
                      <p>Tarif : <strong className="text-primary">{formatFCFA(selectedOffer.monthlyPrice)}/mois</strong></p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Jours souhaités (à convenir)</label>
                    <textarea className="input-field text-sm py-2 h-20 resize-none"
                              placeholder={selectedPkg ? `Proposez ${selectedPkg.sessionsPerWeek} créneau${selectedPkg.sessionsPerWeek > 1 ? 'x' : ''}/sem — ex. Lundi 17h-19h${selectedPkg.sessionsPerWeek > 1 ? ' · Mercredi 17h-19h' : ''}` : "Choisissez d'abord une classe"}
                              value={subForm.schedule} onChange={e => setSubForm(p => ({ ...p, schedule: e.target.value }))} />
                  </div>

                  {isAuthenticated ? (
                    <button type="submit" disabled={subscribing} className="btn-primary w-full text-sm disabled:opacity-60">
                      {subscribing ? 'Envoi…' : '🎯 Envoyer ma demande'}
                    </button>
                  ) : (
                    <Link href="/connexion" className="btn-primary w-full text-sm text-center block">Se connecter pour recruter</Link>
                  )}
                  <p className="text-[11px] text-gray-400 text-center">Le répétiteur doit accepter votre demande. Vous réglez à la fin de chaque mois, une fois les séances assurées.</p>
                </form>
              </div>
            )}
            {!tutor.isActive && (
              <div className="card bg-gray-50 text-center py-6">
                <InactiveBadge />
                <p className="text-sm text-gray-500 mt-2">Ce répétiteur n'est pas disponible actuellement.</p>
              </div>
            )}
            {tutor.isActive && (!tutor.offers || tutor.offers.length === 0) && (
              <div className="card text-center py-6">
                <p className="text-sm text-gray-400">Ce répétiteur n'a pas encore défini de tarif.</p>
              </div>
            )}

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
