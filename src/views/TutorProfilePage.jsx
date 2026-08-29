'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import MarketplaceShell from '../components/layout/MarketplaceShell'
import StarRating from '../components/common/StarRating'
import { Star, MapPin, Clock, CheckCircle, Heart, ChevronLeft, Send, Home, Building2, Users, Wifi, GraduationCap, ChevronDown } from 'lucide-react'
import { formatFCFA, formatDate, MODALITIES, isFastResponder } from '../utils/helpers'

// Regroupement des offres par cycle pour l'accordéon (replié par défaut).
const CYCLE_ORDER = ['primaire', 'college', 'lycee']
const CYCLE_LABEL = { primaire: 'Primaire', college: 'Collège', lycee: 'Lycée' }

export default function TutorProfilePage() {
  const { id } = useParams()
  const { getTutor, getTutorReviews, addReview, addTutorResponse, toggleFavorite, isFavorite, loadTutorReviews, loadUserFavorites, tutors, levelPackages, getResponseStats, showToast } = useApp()
  const { currentUser, isAuthenticated } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('tarifs')
  const [openCycles, setOpenCycles] = useState({})
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '', anonymous: false })
  const [respondingTo, setRespondingTo] = useState(null)
  const [response, setResponse] = useState('')

  const tutor = getTutor(id)
  const reviews = getTutorReviews(id)

  useEffect(() => {
    if (id) loadTutorReviews(id)
    if (currentUser?.id) loadUserFavorites(currentUser.id)
  }, [id, currentUser?.id])

  // ── États de chargement / introuvable ──────────────────────
  if (!tutor) {
    return (
      <MarketplaceShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          {tutors.length === 0 ? (
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Chargement du profil...</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 text-lg">Répétiteur introuvable</p>
              <Link href="/recherche" className="btn-primary mt-4 inline-block">Retour à la recherche</Link>
            </div>
          )}
        </div>
      </MarketplaceShell>
    )
  }

  const isVerified = tutor.verificationStatus === 'verified'
  const isPremium = tutor.subscription?.plan === 'premium'
  const priceLabel = (tutor.priceMin && tutor.priceMax && tutor.priceMin !== tutor.priceMax)
    ? `${formatFCFA(tutor.priceMin)} – ${formatFCFA(tutor.priceMax)}`
    : formatFCFA(tutor.priceMin || tutor.monthlyRate || 0)

  // Offres regroupées par cycle
  const offersByCycle = {}
  ;(tutor.offers || []).forEach(o => {
    const pkg = levelPackages.find(p => p.levelKey === o.levelKey)
    const cat = pkg?.category || 'autre'
    ;(offersByCycle[cat] = offersByCycle[cat] || []).push({ ...o, pkg })
  })
  const cyclesWithOffers = CYCLE_ORDER.filter(c => offersByCycle[c]?.length > 0)
  const toggleCycle = (c) => setOpenCycles(s => ({ ...s, [c]: !s[c] }))

  // Recrutable = vérifié & non suspendu (visibilité gratuite ; l'abonnement se
  // paie au moment où le répétiteur accepte la demande).
  const recruitable = tutor.verificationStatus === 'verified' && !tutor.suspended
  const canRecruit = recruitable && (!isAuthenticated || currentUser?.role === 'parent')
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase()

  const goRecruit = () => {
    if (!isAuthenticated) { router.push('/connexion'); return }
    if (currentUser?.role !== 'parent') { showToast('Seuls les parents peuvent recruter un répétiteur.', 'error'); return }
    if (!tutor.offers?.length) { showToast('Ce répétiteur n\'a pas encore défini de tarif.', 'error'); return }
    router.push(`/recruter/${tutor.id}`)
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
  }

  const handleTutorResponse = (reviewId) => {
    if (!response.trim()) return
    addTutorResponse(reviewId, response)
    setRespondingTo(null)
    setResponse('')
  }

  const tabs = [
    { key: 'tarifs', label: 'Tarifs & services' },
    { key: 'infos', label: 'Informations' },
  ]

  return (
    <MarketplaceShell>
      <div className="bg-surface min-h-full">
        {/* Barre retour */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
            <Link href="/recherche" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <ChevronLeft size={18} /> Retour aux résultats
            </Link>
          </div>
        </div>

        {/* ===== HERO ===== */}
        <div className="bg-gradient-to-br from-[#B85416] via-primary to-accent text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Photo XL */}
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
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                  {isVerified && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1">
                      <CheckCircle size={13} /> Profil vérifié
                    </span>
                  )}
                  {isFastResponder(getResponseStats(tutor.id)) && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1">⚡ Répond vite</span>
                  )}
                  {tutor.rating > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1">
                      <Star size={13} className="fill-white" /> {tutor.rating.toFixed(1)} ({tutor.reviewCount} avis)
                    </span>
                  )}
                  {recruitable
                    ? <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 rounded-full px-3 py-1"><span className="w-2 h-2 rounded-full bg-green-300" /> Disponible</span>
                    : <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-black/20 rounded-full px-3 py-1">Indisponible</span>}
                  {isPremium && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-accent/90 text-white rounded-full px-3 py-1">★ Premium</span>
                  )}
                </div>
              </div>

              {/* Prix */}
              <div className="text-center sm:text-right flex-shrink-0">
                <p className="font-display text-2xl font-extrabold leading-none">{priceLabel}</p>
                <p className="text-xs text-white/80">FCFA / mois</p>
              </div>
            </div>

            {/* CTA centré + mis en valeur */}
            <div className="mt-6 flex flex-col items-center gap-2">
              {canRecruit ? (
                <button onClick={goRecruit}
                        className="w-full sm:w-auto bg-white text-primary-600 font-display font-extrabold text-base rounded-2xl px-10 py-4 shadow-xl hover:bg-white/95 hover:scale-[1.02] active:scale-100 transition-all flex items-center justify-center gap-2">
                  🎯 Je recrute ce répétiteur
                </button>
              ) : !recruitable ? (
                <span className="text-sm text-white/80 bg-black/20 rounded-xl px-4 py-2">Ce répétiteur n'est pas disponible actuellement.</span>
              ) : null}
              {isAuthenticated && currentUser?.role === 'parent' && (
                <button onClick={() => toggleFavorite(currentUser.id, tutor.id)}
                        className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white transition-colors mt-1">
                  <Heart size={15} className={isFavorite(currentUser.id, tutor.id) ? 'fill-white' : ''} />
                  {isFavorite(currentUser.id, tutor.id) ? 'Dans vos favoris' : 'Ajouter aux favoris'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===== Corps pleine largeur ===== */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {/* Onglets */}
          <div className="flex border-b border-gray-200 mb-5 bg-white rounded-t-xl overflow-hidden">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        activeTab === t.key ? 'text-primary border-b-2 border-primary bg-primary-50' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                {t.key === 'tarifs' ? <GraduationCap size={16} /> : <Users size={16} />}
                {t.label}
              </button>
            ))}
          </div>

          {/* ─── Onglet Tarifs & services ─── */}
          {activeTab === 'tarifs' && (
            <div className="space-y-5">
              {cyclesWithOffers.length > 0 ? (
                <div>
                  <div className="text-center mb-4">
                    <h2 className="font-display font-bold text-gray-900 text-lg">Tarifs par classe</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Niveaux enseignés et tarifs mensuels proposés par {tutor.firstName}.</p>
                  </div>
                  <div className="space-y-2.5">
                    {cyclesWithOffers.map(cycle => {
                      const open = !!openCycles[cycle]
                      const offers = offersByCycle[cycle]
                      return (
                        <div key={cycle} className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                          <button onClick={() => toggleCycle(cycle)}
                                  className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-secondary to-[#245a42] text-white">
                            <span className="font-display font-semibold flex items-center gap-2">
                              <GraduationCap size={18} /> {CYCLE_LABEL[cycle]}
                              <span className="text-xs font-normal text-white/80">· {offers.length} classe{offers.length > 1 ? 's' : ''}</span>
                            </span>
                            <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          {open && (
                            <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
              ) : (
                <div className="card text-center py-10">
                  <p className="text-sm text-gray-400">Ce répétiteur n'a pas encore défini de tarif.</p>
                </div>
              )}

              {tutor.modalities?.length > 0 && (
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-3">Modalités de cours</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
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
            </div>
          )}

          {/* ─── Onglet Informations ─── */}
          {activeTab === 'infos' && (
            <div className="space-y-5">
              {tutor.bio && (
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-3">À propos</h2>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{tutor.bio}</p>
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

              <div className="card bg-secondary-50 border-secondary-100">
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-secondary-700">Profil vérifié</p>
                    <p className="text-xs text-secondary-600 mt-1">CNI et diplômes contrôlés par notre équipe.</p>
                  </div>
                </div>
              </div>

              {/* ── Avis (affichés en bas des infos, plus d'onglet dédié) ── */}
              <div>
                <h2 className="font-display font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
                  <Star size={18} className="text-accent fill-accent" /> Avis ({reviews.length})
                </h2>

                {reviews.length > 0 && (
                  <div className="card mb-4">
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

                <div className="space-y-3">
                  {reviews.map(review => (
                    <div key={review.id} className="card">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-800 text-sm">{review.anonymous ? 'Parent vérifié' : review.parentName}</p>
                        <p className="text-xs text-gray-400">{formatDate(review.date)}</p>
                      </div>
                      <StarRating rating={review.rating} showNumber={false} />
                      <p className="text-gray-600 text-sm mt-2 leading-relaxed">{review.comment}</p>
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
                </div>

                {isAuthenticated && currentUser?.role === 'parent' && (
                  <div className="card mt-4">
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
            </div>
          )}
        </div>
      </div>
    </MarketplaceShell>
  )
}
