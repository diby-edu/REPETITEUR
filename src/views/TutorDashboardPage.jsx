'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useChatBubble } from '../context/ChatBubbleContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/common/Avatar'
import { VerifiedBadge, PremiumBadge, StatusBadge } from '../components/common/Badge'
import {
  Eye, Calendar, Star, MessageCircle, Clock,
  ShieldCheck, CreditCard, AlertCircle, CheckCircle, ChevronRight,
  Users, Send, MapPin, GraduationCap, FileText, Wallet,
  Check, X,
} from 'lucide-react'
import { formatFCFA, formatDateShort, getSubscriptionDaysLeft, getStatusLabel } from '../utils/helpers'

// ── Date helpers ─────────────────────────────────────────────
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
const DAYS_FR   = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

function toDate(str) { return new Date(str + 'T00:00:00') }
function isDatePast(str) { return toDate(str) < new Date(new Date().toDateString()) }
function shortDate(str) { const d = toDate(str); return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}` }
function dayFr(str) { return DAYS_FR[toDate(str).getDay()] }
function isThisWeek(str) {
  const today = new Date(); const dow = today.getDay()
  const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1)); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
  const d = toDate(str); return d >= mon && d <= sun
}

// ── Component ────────────────────────────────────────────────
export default function TutorDashboardPage() {
  const { currentUser } = useAuth()
  const {
    getUserConversations, getUserNotifications, getUnreadNotifCount,
    loadUserConversations, loadUserNotifications, subscribeToNotifications,
    getOrCreateConversation,
    loadUserEngagements, getUserEngagements,
    loadAllUserSessions, getAllUserSessions,
    respondToEngagement, confirmPayment,
    runMaintenanceTasks,
  } = useApp()
  const { openChat } = useChatBubble()
  const tutor = currentUser

  const [matchingParents, setMatchingParents]       = useState([])
  const [conversationPartners, setConversationPartners] = useState({})
  const [parentProfiles, setParentProfiles]         = useState({})
  const [pendingPayments, setPendingPayments]       = useState([])
  const [contactingId, setContactingId]             = useState(null)
  const [respondingId, setRespondingId]             = useState(null)

  // Payment confirmation modal
  const [confirmingPay, setConfirmingPay]   = useState(null)
  const [tutorContinue, setTutorContinue]   = useState(true)
  const [payConfirm, setPayConfirm]         = useState(false)
  const [payLoading, setPayLoading]         = useState(false)

  const fetchedPartnerIds = useRef(new Set())

  // ── Load on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!tutor?.id) return
    loadUserConversations(tutor.id)
    loadUserEngagements(tutor.id, 'tutor')
    loadAllUserSessions(tutor.id, 'tutor')
    loadUserNotifications(tutor.id)
    runMaintenanceTasks()
    return subscribeToNotifications(tutor.id)
  }, [tutor?.id])

  // Parents cherchant un répétiteur dans la même ville
  useEffect(() => {
    if (!tutor?.city) return
    supabase
      .from('profiles')
      .select('id, first_name, last_name, city, avatar_color, subjects_needed, child_level, join_date')
      .eq('role', 'parent')
      .eq('open_to_contact', true)
      .eq('city', tutor.city)
      .order('join_date', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (!data) return
        const filtered = tutor.subjects?.length
          ? data.filter(p => !p.subjects_needed?.length || p.subjects_needed.some(s => tutor.subjects.includes(s)))
          : data
        setMatchingParents(filtered.map(p => ({
          id: p.id, firstName: p.first_name, lastName: p.last_name, city: p.city,
          avatarColor: p.avatar_color, childLevel: p.child_level,
          subjectsNeeded: p.subjects_needed || [], joinDate: p.join_date,
        })))
      })
  }, [tutor?.city, tutor?.subjects])

  // Paiements en attente de confirmation du répétiteur
  useEffect(() => {
    if (!tutor?.id) return
    supabase
      .from('payments')
      .select('*, engagement:engagements!inner(id, subject, parent_id, monthly_rate, start_date, end_date, tutor_id)')
      .eq('engagement.tutor_id', tutor.id)
      .eq('status', 'parent_declared')
      .then(({ data }) => { if (data) setPendingPayments(data) })
  }, [tutor?.id])

  // Profils des parents pour les engagements
  const engagements = getUserEngagements(tutor?.id, 'tutor')
  useEffect(() => {
    const unknownIds = [...new Set(engagements.map(e => e.parentId).filter(id => id && !parentProfiles[id]))]
    if (unknownIds.length === 0) return
    supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_color')
      .in('id', unknownIds)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(p => { map[p.id] = { id: p.id, firstName: p.first_name, lastName: p.last_name, avatarColor: p.avatar_color } })
        setParentProfiles(prev => ({ ...prev, ...map }))
      })
  }, [engagements.length])

  // Profils des partenaires de conversation non résolus
  const conversations = getUserConversations(tutor?.id)
  useEffect(() => {
    const unknownIds = conversations
      .map(c => c.participants.find(p => p !== tutor?.id))
      .filter(id => id && !matchingParents.find(p => p.id === id) && !parentProfiles[id] && !fetchedPartnerIds.current.has(id))
    if (unknownIds.length === 0) return
    unknownIds.forEach(id => fetchedPartnerIds.current.add(id))
    supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_color')
      .in('id', [...new Set(unknownIds)])
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(p => { map[p.id] = { id: p.id, firstName: p.first_name, lastName: p.last_name, avatarColor: p.avatar_color } })
        setConversationPartners(prev => ({ ...prev, ...map }))
      })
  }, [conversations.length, matchingParents.length])

  // ── Handlers ────────────────────────────────────────────────

  const handleContactParent = async (parentId) => {
    if (contactingId) return
    setContactingId(parentId)
    const conv = await getOrCreateConversation(tutor.id, parentId)
    setContactingId(null)
    if (conv) openChat(conv.id)
  }

  const handleRespondEngagement = async (engagementId, accept) => {
    setRespondingId(engagementId)
    await respondToEngagement(engagementId, accept)
    setRespondingId(null)
  }

  const handleConfirmPayment = async () => {
    if (!confirmingPay) return
    setPayLoading(true)
    await confirmPayment(confirmingPay.id, confirmingPay.engagement?.id || confirmingPay.engagement_id, tutorContinue)
    setPendingPayments(prev => prev.filter(p => p.id !== confirmingPay.id))
    setPayLoading(false)
    setConfirmingPay(null)
    setPayConfirm(false)
  }

  // ── Derived data ─────────────────────────────────────────────

  const allSessions       = getAllUserSessions(tutor?.id, 'tutor')
  const pendingEngagements  = engagements.filter(e => e.status === 'pending')
  const activeEngagements   = engagements.filter(e => e.status === 'active')
  const thisWeekSessions    = allSessions
    .filter(s => isThisWeek(s.scheduledDate))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime))
  const currentMonth      = new Date().toISOString().slice(0, 7)
  const monthSessionCount = allSessions.filter(s => s.scheduledDate?.startsWith(currentMonth)).length
  const unreadMessages    = conversations.reduce((sum, c) => sum + (c.unreadCount?.[tutor?.id] || 0), 0)
  const daysLeft          = getSubscriptionDaysLeft(tutor.subscription?.endDate)
  const isSubscriptionActive = tutor.subscription?.status === 'active'
  const isVerified        = tutor.verificationStatus === 'verified'
  const isPremium         = tutor.subscription?.plan === 'premium'
  const hasId             = tutor.documents?.cniRecto || tutor.documents?.passport || tutor.documents?.cni

  const stats = [
    { label: 'Vues ce mois',      value: tutor.profileViews || 0,      icon: <Eye size={20} />,         color: 'bg-blue-50 text-blue-600' },
    { label: 'Contrats actifs',   value: activeEngagements.length,      icon: <FileText size={20} />,    color: 'bg-secondary-50 text-secondary' },
    { label: 'Séances ce mois',   value: monthSessionCount,             icon: <CheckCircle size={20} />, color: 'bg-green-50 text-green-600' },
    { label: 'Note moyenne',      value: tutor.rating > 0 ? `${tutor.rating.toFixed(1)}★` : '—', icon: <Star size={20} />, color: 'bg-yellow-50 text-yellow-600' },
  ]

  const PAY_LABELS = { cash: 'Cash', orange_money: 'Orange Money', wave: 'Wave', mtn_money: 'MTN Money' }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Avatar user={tutor} size="lg" />
            <div>
              <h1 className="font-display text-2xl font-bold text-gray-900">Bonjour, {tutor.firstName} !</h1>
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
            <Eye size={16} /> Voir mon profil public
          </Link>
        </div>

        {/* Alerts */}
        <div className="space-y-3 mb-6">
          {!isSubscriptionActive && !tutor.subscription?.status && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800">Votre profil est invisible</p>
                <p className="text-sm text-orange-700">Choisissez un abonnement pour apparaître dans les recherches.</p>
              </div>
              <Link href="/abonnement" className="text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Choisir un plan</Link>
            </div>
          )}

          {isSubscriptionActive && daysLeft <= 7 && daysLeft > 0 && (
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800">Abonnement bientôt expiré — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</p>
                <p className="text-sm text-yellow-700">Renouvelez pour maintenir votre visibilité.</p>
              </div>
              <Link href="/abonnement" className="text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Renouveler</Link>
            </div>
          )}

          {!isSubscriptionActive && tutor.subscription?.status === 'expired' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Abonnement expiré — Profil masqué</p>
                <p className="text-sm text-red-700">Renouvelez pour réapparaître dans les recherches.</p>
              </div>
              <Link href="/abonnement" className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Renouveler</Link>
            </div>
          )}

          {!hasId && !isVerified && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800">Dossier incomplet</p>
                <p className="text-sm text-orange-700">Soumettez votre pièce d'identité pour être vérifié par l'admin.</p>
              </div>
              <Link href="/parametres?tab=Documents" className="text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Soumettre</Link>
            </div>
          )}

          {tutor.verificationStatus === 'pending' && hasId && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Clock size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Dossier en cours de vérification</p>
                <p className="text-sm text-blue-700">Notre équipe examine vos documents. Vous serez notifié sous 24-48h.</p>
              </div>
            </div>
          )}

          {tutor.verificationStatus === 'rejected' && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Dossier rejeté</p>
                <p className="text-sm text-red-700">{tutor.rejectionReason || "Vos documents n'ont pas pu être validés."}</p>
              </div>
            </div>
          )}

          {/* Paiements à confirmer */}
          {pendingPayments.map(p => {
            const par = parentProfiles[p.engagement?.parent_id]
            return (
              <div key={p.id} className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                <Wallet size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">Paiement à confirmer — action requise</p>
                  <p className="text-sm text-green-700">
                    {par ? `${par.firstName} ${par.lastName}` : '…'} a déclaré vous avoir payé {formatFCFA(p.amount)} via {PAY_LABELS[p.payment_method] || 'hors ligne'}.
                    {' '}{p.parent_wants_continue ? 'Souhaite continuer.' : 'Ne souhaite pas renouveler.'}
                  </p>
                </div>
                <button
                  onClick={() => { setConfirmingPay(p); setTutorContinue(true); setPayConfirm(false) }}
                  className="text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg whitespace-nowrap"
                >
                  Confirmer
                </button>
              </div>
            )
          })}

          {unreadMessages > 0 && (
            <div className="flex items-start gap-3 bg-primary-50 border border-primary-100 rounded-xl p-4">
              <MessageCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-primary-700 flex-1">
                {unreadMessages} message{unreadMessages > 1 ? 's' : ''} non lu{unreadMessages > 1 ? 's' : ''}
              </p>
              <button onClick={() => openChat()} className="text-xs font-semibold text-primary bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg border border-primary/20">Voir</button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <div key={i} className="card">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Demandes de contrat en attente — prioritaire */}
        {pendingEngagements.length > 0 && (
          <div className="card mb-5 border-blue-200 bg-blue-50/30">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">Demandes de contrat</h2>
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">{pendingEngagements.length}</span>
            </div>
            <div className="space-y-3">
              {pendingEngagements.map(e => {
                const par = parentProfiles[e.parentId]
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-blue-100">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: par?.avatarColor || '#16A085' }}
                    >
                      {par?.firstName?.[0] || '?'}{par?.lastName?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        <span className="text-primary font-semibold">{e.subject}</span>
                        {par && ` — ${par.firstName} ${par.lastName}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFCFA(e.monthlyRate)}/mois · Débute le {shortDate(e.startDate)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRespondEngagement(e.id, false)}
                        disabled={respondingId === e.id}
                        title="Refuser"
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={() => handleRespondEngagement(e.id, true)}
                        disabled={respondingId === e.id}
                        title="Accepter"
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-colors"
                      >
                        {respondingId === e.id
                          ? <span className="w-4 h-4 border-2 border-green-400/30 border-t-green-600 rounded-full animate-spin" />
                          : <Check size={16} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {/* Planning de la semaine */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                Planning de la semaine
              </h2>
            </div>
            {thisWeekSessions.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {activeEngagements.length === 0 ? 'Aucun contrat actif' : 'Aucune séance cette semaine'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {thisWeekSessions.map(s => {
                  const eng = engagements.find(e => e.id === s.engagementId)
                  const par = eng ? parentProfiles[eng.parentId] : null
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-primary-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary capitalize leading-none">{dayFr(s.scheduledDate)}</span>
                        <span className="text-xs text-primary/60 leading-none">{s.scheduledDate.split('-')[2]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{eng?.subject}</p>
                        <p className="text-xs text-gray-500">
                          {par ? `${par.firstName} ${par.lastName}` : '…'} · {s.scheduledTime?.slice(0, 5)} ({s.durationMinutes} min)
                        </p>
                      </div>
                      {s.parentReport ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                          s.parentReport === 'on_time' ? 'bg-green-50 text-green-700' :
                          s.parentReport === 'late'    ? 'bg-orange-50 text-orange-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {s.parentReport === 'on_time' ? '✓' : s.parentReport === 'late' ? `⏰ +${s.lateMinutes}min` : '✗ Absent'}
                        </span>
                      ) : isDatePast(s.scheduledDate) ? (
                        <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full whitespace-nowrap">En attente</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Abonnement */}
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

          {/* Vérification */}
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
                <span className="text-sm text-gray-500">{tutor.documents?.idType === 'passport' ? 'Passeport' : 'CNI'}</span>
                <span className={`text-sm font-medium ${hasId ? 'text-green-600' : 'text-red-500'}`}>
                  {hasId ? '✓ Soumise' : '✗ Manquante'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Diplôme(s)</span>
                <span className={`text-sm font-medium ${tutor.documents?.diplomes?.length ? 'text-green-600' : 'text-red-500'}`}>
                  {tutor.documents?.diplomes?.length ? `✓ ${tutor.documents.diplomes.length} soumis` : '✗ Manquant'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Selfie avec pièce</span>
                <span className={`text-sm font-medium ${tutor.documents?.selfiePath ? 'text-green-600' : 'text-red-500'}`}>
                  {tutor.documents?.selfiePath ? '✓ Soumis' : '✗ Manquant'}
                </span>
              </div>
              {isVerified && (
                <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <p className="text-xs text-green-700 font-medium">Profil vérifié — Badge affiché sur votre profil</p>
                </div>
              )}
            </div>
          </div>

          {/* Messages récents */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" />
                Messages récents
              </h2>
              <button onClick={() => openChat()} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Voir tout <ChevronRight size={12} />
              </button>
            </div>
            {conversations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucun message</p>
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 3).map(conv => {
                  const otherId = conv.participants.find(p => p !== tutor.id)
                  const unread  = conv.unreadCount[tutor.id] || 0
                  const par     = matchingParents.find(p => p.id === otherId) || conversationPartners[otherId] || parentProfiles[otherId]
                  return (
                    <button
                      key={conv.id}
                      onClick={() => openChat(conv.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left ${unread ? 'bg-primary-50' : ''}`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: par?.avatarColor || '#16A085' }}
                      >
                        {par?.firstName?.[0] || '?'}{par?.lastName?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {par ? `${par.firstName} ${par.lastName?.[0]}.` : '…'}
                        </p>
                        <p className={`text-xs truncate ${unread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                          {conv.lastMessage?.content || 'Nouvelle conversation'}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">{unread}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Parents qui cherchent */}
        <div className="mt-6">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users size={18} className="text-secondary" />
              Parents qui cherchent un répétiteur à {tutor.city}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {matchingParents.length > 0
                ? `${matchingParents.length} parent${matchingParents.length > 1 ? 's' : ''} correspondent à votre profil`
                : "Aucun parent correspondant pour l'instant"}
            </p>
          </div>

          {matchingParents.length === 0 ? (
            <div className="card text-center py-10">
              <Users size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucun parent dans votre ville n'a encore activé le contact répétiteur.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchingParents.map(par => (
                <div key={par.id} className="card flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: par.avatarColor || '#16A085' }}
                    >
                      {par.firstName?.[0]}{par.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{par.firstName} {par.lastName?.[0]}.</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} /> {par.city}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {par.childLevel && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <GraduationCap size={13} className="text-secondary flex-shrink-0" />
                        <span>Niveau : <strong>{par.childLevel}</strong></span>
                      </div>
                    )}
                    {par.subjectsNeeded?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {par.subjectsNeeded.slice(0, 3).map(s => (
                          <span key={s} className={`text-xs px-2 py-0.5 rounded-full font-medium ${tutor.subjects?.includes(s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>{s}</span>
                        ))}
                        {par.subjectsNeeded.length > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+{par.subjectsNeeded.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleContactParent(par.id)}
                    disabled={contactingId === par.id}
                    className="mt-auto btn-primary text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {contactingId === par.id
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

      {/* ── Modal confirmation de paiement ──────────────────────── */}
      {confirmingPay && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget && !payLoading) setConfirmingPay(null) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            {!payConfirm ? (
              <>
                <h3 className="font-display font-bold text-lg text-gray-900 mb-1">Confirmer la réception</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {confirmingPay.engagement?.subject} — {formatFCFA(confirmingPay.amount)}
                  {' '}via {PAY_LABELS[confirmingPay.payment_method] || 'hors ligne'}
                </p>

                <div className="mb-5 p-3 bg-gray-50 rounded-xl text-sm text-gray-700">
                  Le parent {confirmingPay.parent_wants_continue
                    ? <strong>souhaite continuer le mois prochain.</strong>
                    : <strong>ne souhaite pas renouveler le contrat.</strong>}
                </div>

                <p className="text-sm font-semibold text-gray-700 mb-2">Souhaitez-vous continuer ?</p>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <button
                    onClick={() => setTutorContinue(true)}
                    className={`p-3 rounded-xl text-sm font-medium border transition-colors ${tutorContinue === true ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-700 hover:border-green-400'}`}
                  >
                    Oui, continuer
                  </button>
                  <button
                    onClick={() => setTutorContinue(false)}
                    className={`p-3 rounded-xl text-sm font-medium border transition-colors ${tutorContinue === false ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-700 hover:border-red-400'}`}
                  >
                    Non, arrêter
                  </button>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setConfirmingPay(null)} className="btn-outline flex-1">Annuler</button>
                  <button onClick={() => setPayConfirm(true)} className="btn-primary flex-1">Suivant</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display font-bold text-lg text-gray-900 mb-2">Confirmer ?</h3>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-5 text-sm text-gray-700 space-y-1">
                  <p>Montant reçu : <strong>{formatFCFA(confirmingPay.amount)}</strong></p>
                  <p>Votre décision : <strong>{tutorContinue ? 'Continuer le mois prochain' : 'Arrêter le contrat'}</strong></p>
                  {!confirmingPay.parent_wants_continue && tutorContinue && (
                    <p className="text-orange-600 text-xs mt-1">
                      Le parent ne souhaitant pas continuer, le contrat prendra quand même fin.
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPayConfirm(false)} className="btn-outline flex-1">Modifier</button>
                  <button onClick={handleConfirmPayment} disabled={payLoading} className="btn-primary flex-1 disabled:opacity-50">
                    {payLoading
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      : 'Confirmer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
