'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/common/Avatar'
import StarRating from '../components/common/StarRating'
import { VerifiedBadge, PremiumBadge, StatusBadge } from '../components/common/Badge'
import {
  Eye, TrendingUp, Calendar, Star, MessageCircle, Clock,
  ShieldCheck, CreditCard, AlertCircle, CheckCircle, ChevronRight,
  BarChart3, Users, BookOpen, Send, MapPin, GraduationCap,
} from 'lucide-react'
import { formatFCFA, formatDateShort, getSubscriptionDaysLeft, getStatusLabel } from '../utils/helpers'

export default function TutorDashboardPage() {
  const { currentUser } = useAuth()
  const router = useRouter()
  const {
    getUserConversations, getUserBookings, getUserNotifications, getUnreadNotifCount,
    loadUserConversations, loadUserBookings, loadUserNotifications, subscribeToNotifications,
    getOrCreateConversation,
  } = useApp()

  const tutor = currentUser
  const [matchingParents, setMatchingParents] = useState([])
  const [contactingId, setContactingId] = useState(null)

  useEffect(() => {
    if (tutor?.id) {
      loadUserConversations(tutor.id)
      loadUserBookings(tutor.id, 'tutor')
      loadUserNotifications(tutor.id)
      return subscribeToNotifications(tutor.id)
    }
  }, [tutor?.id])

  useEffect(() => {
    if (!tutor?.city) return
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, city, avatar_color, subjects_needed, child_level, join_date')
        .eq('role', 'parent')
        .eq('open_to_contact', true)
        .eq('city', tutor.city)
        .order('join_date', { ascending: false })
        .limit(12)
      if (!data) return
      const filtered = tutor.subjects?.length
        ? data.filter(p => !p.subjects_needed?.length || p.subjects_needed.some(s => tutor.subjects.includes(s)))
        : data
      setMatchingParents(filtered.map(p => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        city: p.city,
        avatarColor: p.avatar_color,
        childLevel: p.child_level,
        subjectsNeeded: p.subjects_needed || [],
        joinDate: p.join_date,
      })))
    }
    load()
  }, [tutor?.city, tutor?.subjects])

  const handleContactParent = async (parentId) => {
    if (contactingId) return
    setContactingId(parentId)
    const conv = await getOrCreateConversation(tutor.id, parentId)
    setContactingId(null)
    if (conv) router.push(`/messagerie/${conv.id}`)
  }

  const conversations = getUserConversations(tutor.id)
  const bookings = getUserBookings(tutor.id, 'tutor')
  const notifications = getUserNotifications(tutor.id)
  const unread = getUnreadNotifCount(tutor.id)

  const upcomingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').slice(0, 3)
  const daysLeft = getSubscriptionDaysLeft(tutor.subscription?.endDate)
  const isSubscriptionActive = tutor.subscription?.status === 'active'
  const isVerified = tutor.verificationStatus === 'verified'
  const isPremium = tutor.subscription?.plan === 'premium'

  const unreadMessages = conversations.reduce((sum, c) => sum + (c.unreadCount[tutor.id] || 0), 0)

  const stats = [
    { label: 'Vues ce mois', value: tutor.profileViews || 0, icon: <Eye size={20} />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Demandes reçues', value: tutor.monthlyRequests || 0, icon: <TrendingUp size={20} />, color: 'bg-purple-50 text-purple-600' },
    { label: 'Séances complétées', value: tutor.sessionCount || 0, icon: <CheckCircle size={20} />, color: 'bg-green-50 text-green-600' },
    { label: 'Note moyenne', value: tutor.rating > 0 ? `${tutor.rating.toFixed(1)}★` : '—', icon: <Star size={20} />, color: 'bg-yellow-50 text-yellow-600' },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Avatar user={tutor} size="lg" />
            <div>
              <h1 className="font-display text-2xl font-bold text-gray-900">
                Bonjour, {tutor.firstName} !
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {isVerified && <VerifiedBadge />}
                {isPremium && <PremiumBadge />}
                {!isVerified && tutor.verificationStatus === 'pending' && (
                  <span className="badge-pending"><Clock size={12} />En attente de vérification</span>
                )}
                {tutor.verificationStatus === 'rejected' && (
                  <span className="badge-rejected">Dossier rejeté</span>
                )}
              </div>
            </div>
          </div>
          <Link href={`/repetiteur/${tutor.id}`} className="btn-outline text-sm flex items-center gap-2">
            <Eye size={16} />
            Voir mon profil public
          </Link>
        </div>

        {/* Alerts */}
        <div className="space-y-3 mb-6">
          {/* No subscription at all */}
          {!isSubscriptionActive && !tutor.subscription?.status && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800">Votre profil est invisible</p>
                <p className="text-sm text-orange-700">
                  Aucun parent ne peut vous trouver.
                  {tutor.reviewCount > 0 && ` Vos ${tutor.reviewCount} avis et votre note ★${tutor.rating.toFixed(1)} sont masqués.`}
                  {' '}Choisissez un abonnement pour apparaître dans les recherches.
                </p>
              </div>
              <Link href="/abonnement" className="text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                Choisir un plan
              </Link>
            </div>
          )}

          {/* Subscription expiring soon */}
          {isSubscriptionActive && daysLeft <= 7 && daysLeft > 0 && (
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800">Abonnement bientôt expiré — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</p>
                <p className="text-sm text-yellow-700">
                  Si vous ne renouvelez pas, votre profil disparaît et les parents qui vous ont en favoris verront « ce répétiteur n'est plus disponible ».
                </p>
              </div>
              <Link href="/abonnement" className="text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Renouveler</Link>
            </div>
          )}

          {/* Subscription expired */}
          {!isSubscriptionActive && tutor.subscription?.status === 'expired' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Abonnement expiré — Profil masqué</p>
                <p className="text-sm text-red-700">
                  Votre profil est invisible, vos avis et votre note sont masqués. Les parents qui vous ont en favoris voient « ce répétiteur n'est plus disponible ».
                </p>
              </div>
              <Link href="/abonnement" className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Renouveler</Link>
            </div>
          )}

          {/* Pending verification */}
          {tutor.verificationStatus === 'pending' && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Clock size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Dossier en cours de vérification</p>
                <p className="text-sm text-blue-700">Notre équipe examine vos documents. Vous serez notifié sous 24-48h.</p>
              </div>
            </div>
          )}

          {/* Rejected */}
          {tutor.verificationStatus === 'rejected' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Dossier rejeté</p>
                <p className="text-sm text-red-700">{tutor.rejectionReason || 'Vos documents n\'ont pas pu être validés.'}</p>
                <p className="text-sm text-red-600 font-medium mt-1">Vous pouvez resoumettre vos documents dans les paramètres.</p>
              </div>
            </div>
          )}

          {/* Unread messages */}
          {unreadMessages > 0 && (
            <div className="flex items-start gap-3 bg-primary-50 border border-primary-100 rounded-xl p-4">
              <MessageCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-700">
                  {unreadMessages} message{unreadMessages > 1 ? 's' : ''} non lu{unreadMessages > 1 ? 's' : ''}
                </p>
              </div>
              <Link href="/messagerie" className="text-xs font-semibold text-primary bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg border border-primary/20">
                Voir
              </Link>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="card">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Subscription status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard size={18} className="text-primary" />
                Abonnement
              </h2>
              <Link href="/abonnement" className="text-xs text-primary font-medium hover:underline">Gérer</Link>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Plan actuel</span>
                <span className={`text-sm font-semibold ${isPremium ? 'text-accent' : 'text-gray-700'}`}>
                  {getStatusLabel(tutor.subscription?.plan || 'gratuit')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Statut</span>
                <StatusBadge status={tutor.subscription?.status || 'inactive'} />
              </div>
              {isSubscriptionActive && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Expire le</span>
                    <span className="text-sm font-medium text-gray-700">{formatDateShort(tutor.subscription?.endDate)}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Jours restants</span>
                      <span className={daysLeft <= 5 ? 'text-red-500 font-semibold' : 'text-gray-600'}>{daysLeft} jours</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${daysLeft <= 5 ? 'bg-red-400' : daysLeft <= 10 ? 'bg-yellow-400' : 'bg-secondary'}`}
                        style={{ width: `${Math.min(100, (daysLeft / 30) * 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Verification status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-secondary" />
                Vérification
              </h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Statut</span>
                <StatusBadge status={tutor.verificationStatus} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {tutor.documents?.idType === 'passport' ? 'Passeport' : 'CNI'}
                </span>
                <span className={`text-sm font-medium ${
                  (tutor.documents?.cniRecto || tutor.documents?.passport || tutor.documents?.cni)
                    ? 'text-green-600' : 'text-red-500'
                }`}>
                  {(tutor.documents?.cniRecto || tutor.documents?.passport || tutor.documents?.cni)
                    ? '✓ Soumise' : '✗ Manquante'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Diplôme(s)</span>
                <span className={`text-sm font-medium ${tutor.documents?.diplomes?.length ? 'text-green-600' : 'text-red-500'}`}>
                  {tutor.documents?.diplomes?.length ? `✓ ${tutor.documents.diplomes.length} soumis` : '✗ Manquant'}
                </span>
              </div>
              {tutor.documents?.selfiePath && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Selfie</span>
                  <span className="text-sm font-medium text-green-600">✓ Soumis</span>
                </div>
              )}
              {tutor.verificationStatus === 'verified' && (
                <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <p className="text-xs text-green-700 font-medium">Profil vérifié — Badge affiché sur votre profil</p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming sessions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                Prochaines séances
              </h2>
              <Link href="/reservations" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Voir tout <ChevronRight size={12} />
              </Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucune séance prévue</p>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map(booking => (
                  <div key={booking.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 bg-primary-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-xs text-primary font-bold leading-none">{booking.date.split('-')[2]}</span>
                      <span className="text-xs text-primary-400 leading-none">
                        {['', 'jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'][parseInt(booking.date.split('-')[1])]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{booking.subject}</p>
                      <p className="text-xs text-gray-500">{booking.time} — {booking.duration} min</p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent messages */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" />
                Messages récents
              </h2>
              <Link href="/messagerie" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Voir tout <ChevronRight size={12} />
              </Link>
            </div>
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucun message</p>
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 3).map(conv => {
                  const otherUserId = conv.participants.find(p => p !== tutor.id)
                  const unreadInConv = conv.unreadCount[tutor.id] || 0
                  const parent = matchingParents.find(p => p.id === otherUserId)
                  const initials = parent
                    ? `${parent.firstName?.[0] || ''}${parent.lastName?.[0] || ''}`
                    : '?'
                  const name = parent ? `${parent.firstName} ${parent.lastName?.[0]}.` : 'Utilisateur'
                  return (
                    <Link
                      key={conv.id}
                      href={`/messagerie/${conv.id}`}
                      className={`flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors ${unreadInConv ? 'bg-primary-50' : ''}`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: parent?.avatarColor || '#16A085' }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium text-gray-800`}>{name}</p>
                        <p className={`text-xs truncate ${unreadInConv ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                          {conv.lastMessage?.content || 'Nouvelle conversation'}
                        </p>
                      </div>
                      {unreadInConv > 0 && (
                        <span className="w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {unreadInConv}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Parents qui cherchent un répétiteur */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-secondary" />
                Parents qui cherchent un répétiteur à {tutor.city}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {matchingParents.length > 0
                  ? `${matchingParents.length} parent${matchingParents.length > 1 ? 's' : ''} correspondent à votre profil`
                  : 'Aucun parent correspondant pour l\'instant'}
              </p>
            </div>
          </div>

          {matchingParents.length === 0 ? (
            <div className="card text-center py-10">
              <Users size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucun parent dans votre ville n'a encore activé le contact répétiteur.</p>
              <p className="text-xs text-gray-300 mt-1">Revenez bientôt — la communauté grandit !</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchingParents.map(parent => (
                <div key={parent.id} className="card flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: parent.avatarColor || '#16A085' }}
                    >
                      {parent.firstName?.[0]}{parent.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{parent.firstName} {parent.lastName?.[0]}.</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin size={11} /> {parent.city}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {parent.childLevel && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <GraduationCap size={13} className="text-secondary flex-shrink-0" />
                        <span>Niveau : <strong>{parent.childLevel}</strong></span>
                      </div>
                    )}
                    {parent.subjectsNeeded?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parent.subjectsNeeded.slice(0, 3).map(s => (
                          <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${tutor.subjects?.includes(s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                            {s}
                          </span>
                        ))}
                        {parent.subjectsNeeded.length > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            +{parent.subjectsNeeded.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleContactParent(parent.id)}
                    disabled={contactingId === parent.id}
                    className="mt-auto btn-primary text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {contactingId === parent.id
                      ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send size={13} />}
                    Contacter
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
