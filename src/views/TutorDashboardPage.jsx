'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useChatBubble } from '../context/ChatBubbleContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/common/Avatar'
import Confetti from '../components/common/Confetti'
import { VerifiedBadge, PremiumBadge, StatusBadge } from '../components/common/Badge'
import {
  Eye, Calendar, Star, MessageCircle, Clock,
  ShieldCheck, CreditCard, AlertCircle, CheckCircle, ChevronRight,
  Users, Send, MapPin, GraduationCap, FileText, Wallet,
  Check, X,
} from 'lucide-react'
import { formatFCFA, formatDateShort, getSubscriptionDaysLeft, getStatusLabel } from '../utils/helpers'
import DashboardLayout, { useHeaderSlot } from '../components/layout/DashboardLayout'
import StarRating from '../components/common/StarRating'

// ── Date helpers ─────────────────────────────────────────────
const MONTHS_FR      = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
const MONTHS_FR_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS_FR        = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

function toDate(str) { return new Date(str + 'T00:00:00') }
function isDatePast(str) { return toDate(str) < new Date(new Date().toDateString()) }
function shortDate(str) { const d = toDate(str); return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}` }
function dayFr(str) { return DAYS_FR[toDate(str).getDay()] }
function daysUntil(str) { return Math.ceil((toDate(str) - new Date(new Date().toDateString())) / 86400000) }
function sessionPill(dateStr) {
  const n = daysUntil(dateStr)
  if (n === 0) return { label: "Aujourd'hui", cls: 'bg-green-50 text-green-700' }
  if (n === 1) return { label: 'Demain',       cls: 'bg-blue-50 text-blue-600' }
  if (n <= 7)  return { label: `Dans ${n} jours`, cls: 'bg-blue-50 text-blue-600' }
  return { label: 'Planifié', cls: 'bg-gray-100 text-gray-500' }
}
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
    loadUserConversations, loadUserNotifications, subscribeToNotifications, subscribeToEngagements, subscribeToReviews,
    loadTutorReviews, getTutorReviews,
    getOrCreateConversation,
    loadUserEngagements, getUserEngagements,
    loadAllUserSessions, getAllUserSessions,
    respondToEngagement, confirmPayment, endEngagement,
    expressInterest, loadTutorInterests,
    runMaintenanceTasks, showToast, levelPackages,
  } = useApp()
  const { openChat } = useChatBubble()
  const { setSlot } = useHeaderSlot()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tutor = currentUser

  const [referral, setReferral] = useState(null)
  const [refCopied, setRefCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  useEffect(() => {
    if (!tutor?.id) return
    supabase.rpc('my_referral_stats').then(({ data }) => setReferral(data?.[0] || null))
  }, [tutor?.id])

  const [showConfetti, setShowConfetti] = useState(false)
  useEffect(() => {
    if (searchParams.get('welcome') === '1') {
      setShowConfetti(true)
      router.replace('/tableau-de-bord/repetiteur')
    }
  }, [searchParams, router])

  const [matchingParents, setMatchingParents]       = useState([])
  const [interestedIds, setInterestedIds]           = useState(new Set())
  const [interestBusy, setInterestBusy]             = useState(null)
  const [conversationPartners, setConversationPartners] = useState({})
  const [parentProfiles, setParentProfiles]         = useState({})
  const [pendingPayments, setPendingPayments]       = useState([])
  const [confirmedPayments, setConfirmedPayments]   = useState([])
  const [endModal, setEndModal]                     = useState(null)   // contrat à résilier
  const [endLoading, setEndLoading]                 = useState(false)
  const [contactingId, setContactingId]             = useState(null)
  const [respondingId, setRespondingId]             = useState(null)

  // Payment confirmation modal
  const [confirmingPay, setConfirmingPay]   = useState(null)
  const [subGateId, setSubGateId]           = useState(null)   // demande à accepter en attente d'abonnement
  const [tutorContinue, setTutorContinue]   = useState(true)
  const [payConfirm, setPayConfirm]         = useState(false)
  const [payLoading, setPayLoading]         = useState(false)

  const fetchedPartnerIds = useRef(new Set())

  useEffect(() => {
    if (!tutor?.id) return
    setSlot(
      <Link href={`/repetiteur/${tutor.id}`} className="btn-outline text-sm flex items-center gap-2">
        <Eye size={16} /> Voir mon profil public
      </Link>
    )
    return () => setSlot(null)
  }, [tutor?.id])

  // ── Load on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!tutor?.id) return
    loadUserConversations(tutor.id)
    loadUserEngagements(tutor.id, 'tutor')
    loadAllUserSessions(tutor.id, 'tutor')
    loadUserNotifications(tutor.id)
    loadTutorReviews(tutor.id)
    runMaintenanceTasks()
    const unsubNotif = subscribeToNotifications(tutor.id)
    const unsubEng = subscribeToEngagements(tutor.id, 'tutor')
    const unsubRev = subscribeToReviews(tutor.id)
    return () => { unsubNotif?.(); unsubEng?.(); unsubRev?.() }
  }, [tutor?.id])

  // Parents cherchant un répétiteur dans la même ville
  useEffect(() => {
    if (!tutor?.city) return
    supabase
      .from('public_profiles')
      .select('id, first_name, last_name, city, avatar_color, subjects_needed, child_levels, join_date, open_to_contact')
      .eq('role', 'parent')
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
          avatarColor: p.avatar_color, childLevels: p.child_levels || [],
          subjectsNeeded: p.subjects_needed || [], joinDate: p.join_date,
          openToContact: p.open_to_contact !== false,
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
      .in('status', ['parent_declared', 'confirmed'])
      .then(({ data }) => {
        if (!data) return
        setPendingPayments(data.filter(p => p.status === 'parent_declared'))
        setConfirmedPayments(data.filter(p => p.status === 'confirmed'))
      })
  }, [tutor?.id])

  // Profils des parents pour les engagements
  const engagements = getUserEngagements(tutor?.id, 'tutor')
  useEffect(() => {
    const unknownIds = [...new Set(engagements.map(e => e.parentId).filter(id => id && !parentProfiles[id]))]
    if (unknownIds.length === 0) return
    supabase
      .from('public_profiles')
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
      .from('public_profiles')
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

  // Additif D : le répétiteur signale son intérêt (pas de contact à froid).
  const handleExpressInterest = async (parentId) => {
    if (interestBusy) return
    const par = matchingParents.find(p => p.id === parentId)
    if (par && par.openToContact === false) { showToast('Ce parent ne souhaite pas être sollicité.', 'error'); return }
    setInterestBusy(parentId)
    const ok = await expressInterest(parentId)
    setInterestBusy(null)
    if (ok) setInterestedIds(s => new Set(s).add(parentId))
  }

  useEffect(() => {
    if (tutor?.id) loadTutorInterests(tutor.id).then(ids => setInterestedIds(new Set(ids)))
  }, [tutor?.id, loadTutorInterests])

  const handleRespondEngagement = async (engagementId, accept) => {
    // Payer-pour-accepter : accepter une demande exige un abonnement payant actif.
    const hasPaidSub = tutor.subscription?.status === 'active' && tutor.subscription?.plan !== 'gratuit'
    if (accept && !hasPaidSub) { setSubGateId(engagementId); return }
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

  const allSessions         = getAllUserSessions(tutor?.id, 'tutor')
  const pendingEngagements  = engagements.filter(e => e.status === 'pending')
  const activeEngagements   = engagements.filter(e => e.status === 'active')
  const upcomingSessions    = allSessions
    .filter(s => !isDatePast(s.scheduledDate))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
    .slice(0, 5)
  const currentMonth      = new Date().toISOString().slice(0, 7)
  // Séances = validées par le parent (compteur), plus de séances datées.
  const monthSessionsDone  = activeEngagements.reduce((s, e) => s + (e.sessionsDone || 0), 0)
  const monthSessionsTotal = activeEngagements.reduce((s, e) => {
    const pkg = levelPackages.find(p => p.levelKey === e.levelKey)
    return s + (pkg ? pkg.sessionsPerWeek * 4 : 0)
  }, 0)
  const unreadMessages    = conversations.reduce((sum, c) => sum + (c.unreadCount?.[tutor?.id] || 0), 0)
  const daysLeft          = getSubscriptionDaysLeft(tutor.subscription?.endDate)
  const isSubscriptionActive = tutor.subscription?.status === 'active'
  const isVerified        = tutor.verificationStatus === 'verified'
  const myReviews         = getTutorReviews(tutor.id)
  const isPremium         = tutor.subscription?.plan === 'premium'
  const hasId             = tutor.documents?.cniRecto || tutor.documents?.passport || tutor.documents?.cni

  // Revenu = paiements CONFIRMÉS ce mois (postpayé). L'attendu = contrats actifs.
  const expectedRevenue   = activeEngagements.reduce((sum, e) => sum + (e.monthlyRate || 0), 0)
  const pendingRevenue    = pendingPayments.reduce((sum, p) => sum + (p.amount || p.engagement?.monthly_rate || 0), 0)
  const confirmedRevenue  = confirmedPayments
    .filter(p => (p.tutor_confirmed_at || '').slice(0, 7) === currentMonth)
    .reduce((sum, p) => sum + (p.amount || p.engagement?.monthly_rate || 0), 0)

  // Profil completion score (5 champs = 20% each)
  const profileChecks = [
    { label: 'Bio renseignée',      done: tutor.bio?.trim().length > 10,    href: '/parametres' },
    { label: 'Matières ajoutées',   done: tutor.subjects?.length > 0,       href: '/parametres' },
    { label: 'Niveaux renseignés',  done: tutor.levels?.length > 0,         href: '/parametres' },
    { label: 'Tarif mensuel',       done: tutor.monthlyRate > 0,            href: '/parametres' },
    { label: 'Documents soumis',    done: !!hasId,                          href: '/parametres?tab=Documents' },
  ]
  const profileScore = profileChecks.filter(c => c.done).length
  const profilePct   = Math.round((profileScore / profileChecks.length) * 100)

  const stats = [
    {
      label: 'Séances validées (mois)', value: monthSessionsTotal > 0 ? `${monthSessionsDone}/${monthSessionsTotal}` : '0', emoji: '📅',
      bg: 'bg-secondary-50', bar: 'bg-secondary',
      delta: monthSessionsTotal > 0 ? 'validées par les parents' : '→ stable',
      deltaClass: 'text-gray-400',
    },
    {
      label: 'Revenus FCFA (mois)', value: confirmedRevenue > 0 ? confirmedRevenue.toLocaleString('fr-FR') : '0',
      emoji: '💰', bg: 'bg-accent-50', bar: 'bg-accent', bigVal: confirmedRevenue >= 100000,
      delta: pendingRevenue > 0 ? `⏳ À confirmer : ${formatFCFA(pendingRevenue)}` : expectedRevenue > 0 ? `Attendu ce mois : ${formatFCFA(expectedRevenue)}` : '→ stable',
      deltaClass: pendingRevenue > 0 ? 'text-orange-500' : 'text-gray-400',
    },
    {
      label: 'Familles actives', value: activeEngagements.length, emoji: '👨‍👩‍👧',
      bg: 'bg-primary-50', bar: 'bg-primary',
      delta: pendingEngagements.length > 0 ? `${pendingEngagements.length} demande${pendingEngagements.length > 1 ? 's' : ''} en attente` : '→ stable',
      deltaClass: pendingEngagements.length > 0 ? 'text-blue-500' : 'text-gray-400',
    },
    {
      label: 'Note moyenne', value: tutor.rating > 0 ? tutor.rating.toFixed(1) : '—', emoji: '⭐',
      bg: 'bg-yellow-50', bar: 'bg-accent',
      delta: tutor.reviewCount > 0 ? `${tutor.reviewCount} avis` : '→ stable',
      deltaClass: tutor.reviewCount > 0 ? 'text-green-600' : 'text-gray-400',
    },
  ]

  const PAY_LABELS = { cash: 'Cash', orange_money: 'Orange Money', wave: 'Wave', mtn_money: 'MTN Money' }

  // ── Render ───────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
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

        {/* Alerts */}
        <div className="space-y-3 mb-6">
          {!isSubscriptionActive && !tutor.subscription?.status && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800">Votre profil est invisible</p>
                <p className="text-sm text-orange-700">Abonnez-vous pour apparaître dans les recherches, recevoir des demandes de contrat et discuter avec les parents.</p>
              </div>
              <Link href="/abonnement" className="text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Choisir un plan</Link>
            </div>
          )}

          {isSubscriptionActive && daysLeft <= 7 && daysLeft > 0 && (
            <div className={`flex items-start gap-3 border rounded-xl p-4 ${daysLeft <= 3 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <AlertCircle size={20} className={`flex-shrink-0 mt-0.5 ${daysLeft <= 3 ? 'text-red-600' : 'text-yellow-600'}`} />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${daysLeft <= 3 ? 'text-red-800' : 'text-yellow-800'}`}>
                  Abonnement bientôt expiré — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
                </p>
                <p className={`text-sm ${daysLeft <= 3 ? 'text-red-700' : 'text-yellow-700'}`}>
                  Sans renouvellement : profil masqué des recherches, avis &amp; note cachés, contrats actifs résiliés.
                </p>
              </div>
              <Link href="/abonnement" className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${daysLeft <= 3 ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'}`}>Renouveler</Link>
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
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Dossier rejeté</p>
                <p className="text-sm text-red-700">{tutor.rejectionReason || "Vos documents n'ont pas pu être validés."}</p>
              </div>
              <Link href="/parametres?tab=Documents" className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Corriger mes documents</Link>
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

        {/* Barre de complétion du profil — masquée si 100% */}
        {profilePct < 100 && (
          <div className="card mb-5 border-primary/20 bg-primary-50/30">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-gray-900">Votre profil — <span className="text-primary">{profilePct}% complet</span></p>
                <p className="text-xs text-gray-500 mt-0.5">Un profil complet est mieux référencé dans les recherches</p>
              </div>
              <span className="text-2xl font-black text-primary">{profilePct}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-700"
                style={{ width: `${profilePct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {profileChecks.filter(c => !c.done).map(c => (
                <Link
                  key={c.label}
                  href={c.href}
                  className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary bg-white hover:bg-primary-50 font-medium transition-colors flex items-center gap-1"
                >
                  <span className="text-gray-300">+</span> {c.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <div key={i} className="card relative overflow-hidden flex items-center gap-4 py-4 px-4">
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${s.bar}`} />
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${s.bg}`}>{s.emoji}</div>
              <div className="min-w-0">
                <p className={`font-black text-gray-900 tabular-nums leading-none ${s.bigVal ? 'text-[17px]' : 'text-[22px]'}`}>{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-1.5 font-semibold leading-tight">{s.label}</p>
                {s.subValue && <p className={`text-[10px] font-bold mt-0.5 ${s.subClass}`}>{s.subValue}</p>}
                {s.delta && <p className={`text-[10px] font-bold mt-0.5 ${s.deltaClass}`}>{s.delta}</p>}
              </div>
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
                  <div key={e.id} className="p-3 bg-white rounded-xl border border-blue-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: par?.avatarColor || '#16A085' }}>
                        {par?.firstName?.[0] || '?'}{par?.lastName?.[0] || ''}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{par ? `${par.firstName} ${par.lastName}` : 'Parent'}</p>
                        <p className="text-xs text-primary font-medium">{levelPackages.find(p => p.levelKey === e.levelKey)?.label || 'Contrat'} · {formatFCFA(e.monthlyRate)}/mois</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1 mb-3 pl-1">
                      {e.subject && <p><span className="text-gray-400">Matières :</span> {e.subject}</p>}
                      <p><span className="text-gray-400">Jours souhaités :</span> {e.agreedSchedule || 'à convenir'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleRespondEngagement(e.id, true)} disabled={respondingId === e.id} className="flex-1 min-w-[110px] flex items-center justify-center gap-1.5 py-2 bg-secondary text-white text-sm font-semibold rounded-full hover:bg-secondary-600 disabled:opacity-50 transition-colors">
                        {respondingId === e.id ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={15} />} Accepter
                      </button>
                      <button onClick={() => handleRespondEngagement(e.id, false)} disabled={respondingId === e.id} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors">
                        <X size={15} /> Refuser
                      </button>
                      <button onClick={() => handleContactParent(e.parentId)} className="flex items-center justify-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors">
                        <Send size={14} /> Discuter
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Parents qui cherchent — remonté avant l'agenda pour visibilité */}
        <div className="mt-6 mb-5">
          <div className="mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <Users size={17} className="text-secondary" />
              Parents qui cherchent un répétiteur à {tutor.city}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {matchingParents.length > 0
                ? `${matchingParents.length} parent${matchingParents.length > 1 ? 's' : ''} correspond${matchingParents.length > 1 ? 'ent' : ''} à votre profil`
                : "Aucun parent correspondant pour l'instant"}
            </p>
          </div>

          {!isVerified ? (
            <div className="card text-center py-8">
              <Users size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Disponible après vérification de votre profil</p>
              <p className="text-xs text-gray-400 mt-1">Les coordonnées des parents sont réservées aux répétiteurs vérifiés.</p>
            </div>
          ) : !tutor.isActive ? (
            <div className="card text-center py-8">
              <Users size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Réservé aux abonnés</p>
              <p className="text-xs text-gray-400 mt-1 mb-3">Passez à un plan payant pour accéder aux demandes des parents et les contacter.</p>
              <Link href="/abonnement" className="btn-primary text-xs py-2 inline-block">Voir les abonnements</Link>
            </div>
          ) : matchingParents.length === 0 ? (
            <div className="card text-center py-8">
              <Users size={36} className="text-gray-200 mx-auto mb-3" />
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
                    {par.childLevels?.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <GraduationCap size={13} className="text-secondary flex-shrink-0" />
                        <span>Niveau : <strong>{par.childLevels.join(', ')}</strong></span>
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
                  {(() => {
                    if (par.openToContact === false) return (
                      <div className="mt-auto text-center bg-gray-50 border border-gray-200 rounded-xl py-2 px-2">
                        <p className="text-xs text-gray-500 font-medium">🔕 Ne souhaite pas être sollicité</p>
                      </div>
                    )
                    if (activeEngagements.some(e => e.parentId === par.id)) return (
                      <div className="mt-auto text-center bg-green-50 border border-green-200 rounded-xl py-2 px-2">
                        <p className="text-xs text-green-700 font-semibold">✓ Contrat en cours</p>
                      </div>
                    )
                    if (interestedIds.has(par.id)) return (
                      <div className="mt-auto text-center bg-secondary-50 border border-secondary-100 rounded-xl py-2 px-2">
                        <p className="text-xs text-secondary font-semibold">✓ Intérêt envoyé</p>
                      </div>
                    )
                    return (
                      <button
                        onClick={() => handleExpressInterest(par.id)}
                        disabled={interestBusy === par.id}
                        className="mt-auto btn-primary text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {interestBusy === par.id
                          ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Send size={13} />}
                        Intéressé
                      </button>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Agenda semaine — grille 7 jours */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">📅 Ce mois-ci</h2>
              <Link href="/reservations" className="text-xs text-primary font-medium hover:underline">Voir tout</Link>
            </div>
            {activeEngagements.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">Aucun contrat actif</p>
            ) : (
              <div className="space-y-2">
                {activeEngagements.slice(0, 4).map(e => {
                  const par = parentProfiles[e.parentId]
                  const pkg = levelPackages.find(p => p.levelKey === e.levelKey)
                  const total = pkg ? pkg.sessionsPerWeek * 4 : 0
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: par?.avatarColor || '#16A085' }}>
                        {par?.firstName?.[0] || '?'}{par?.lastName?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{par ? `${par.firstName} ${par.lastName?.[0]}.` : '…'} · {pkg?.label || 'Contrat'}</p>
                        <p className="text-xs text-gray-500">{e.sessionsDone}/{total} séances validées · jusqu'au {shortDate(e.endDate)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Contrats actifs */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">📋 Contrats actifs</h2>
              <span className="text-xs text-gray-400">{activeEngagements.length} contrat{activeEngagements.length !== 1 ? 's' : ''}</span>
            </div>
            {activeEngagements.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucun contrat actif</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeEngagements.slice(0, 4).map((e, idx) => {
                  const par = parentProfiles[e.parentId]
                  const bars = ['bg-secondary', 'bg-primary', 'bg-accent', 'bg-green-500']
                  return (
                    <div key={e.id} className="p-3 border border-gray-100 rounded-xl">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {par ? `${par.firstName} ${par.lastName?.[0]}.` : '…'}
                          {e.childLabel && <span className="text-gray-400 font-normal"> · {e.childLabel}</span>}
                        </p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">Actif</span>
                      </div>
                      <p className="text-xs text-primary font-medium mt-0.5">{levelPackages.find(p => p.levelKey === e.levelKey)?.label || 'Contrat'}{e.subject ? ` · ${e.subject}` : ''}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
                        <Clock size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{e.agreedSchedule || 'Horaires à convenir avec le parent'}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <p className="text-xs text-gray-400">{shortDate(e.startDate)} → {shortDate(e.endDate)} · <strong className="text-gray-700">{formatFCFA(e.monthlyRate)}</strong>/mois</p>
                        <button onClick={() => setEndModal(e)} className="text-xs text-red-500 hover:text-red-600 font-medium">Mettre fin</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Modale de résiliation */}
          {endModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
                <h3 className="font-semibold text-gray-900 mb-2">Mettre fin au contrat ?</h3>
                <p className="text-sm text-gray-500 mb-5">Ce contrat sera résilié et le parent en sera informé. Cette action est définitive.</p>
                <div className="flex gap-3">
                  <button onClick={() => setEndModal(null)} disabled={endLoading} className="btn-outline flex-1">Annuler</button>
                  <button
                    onClick={async () => { setEndLoading(true); const ok = await endEngagement(endModal.id, 'tutor'); setEndLoading(false); if (ok) setEndModal(null) }}
                    disabled={endLoading}
                    className="flex-1 bg-red-500 text-white font-semibold px-4 py-3 rounded-full hover:bg-red-600 disabled:opacity-60"
                  >
                    {endLoading ? 'Résiliation…' : 'Mettre fin'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
              {(() => {
                // Statut de validation par pièce (approuvé / en attente / rejeté).
                const badge = (submitted, review) => {
                  if (!submitted) return { t: '✗ Non soumis', c: 'text-red-500' }
                  const s = review?.status
                  // Profil vérifié ⇒ pièces acceptées (pas d'incohérence Vérifié + En attente)
                  if (s === 'approved' || isVerified) return { t: '✅ Approuvé', c: 'text-green-600' }
                  if (s === 'rejected') return { t: '❌ Rejeté', c: 'text-red-500' }
                  return { t: '⏳ En attente', c: 'text-amber-600' }
                }
                const docs = tutor.documents || {}
                const isPassport = docs.idType === 'passport'
                const idSubmitted = isPassport ? !!docs.passport : !!(docs.cniRecto && docs.cniVerso)
                const idB = badge(idSubmitted, docs.idReview)
                const selfieB = badge(!!docs.selfiePath, docs.selfieReview)
                const diplomas = docs.diplomes || []
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{isPassport ? 'Passeport' : 'CNI'}</span>
                      <span className={`text-sm font-medium ${idB.c}`}>{idB.t}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Selfie avec pièce</span>
                      <span className={`text-sm font-medium ${selfieB.c}`}>{selfieB.t}</span>
                    </div>
                    <div className="pt-1">
                      <span className="text-sm text-gray-500">Diplômes ({diplomas.length})</span>
                      {diplomas.length === 0 && <p className="text-xs text-red-500 mt-1">Aucun diplôme soumis</p>}
                      <div className="mt-1 space-y-1">
                        {diplomas.map((d, i) => {
                          const b = badge(!!d.path, d.review)
                          return (
                            <div key={i} className="flex justify-between items-center gap-2">
                              <span className="text-xs text-gray-600 truncate">{d.name || `Diplôme ${i + 1}`}</span>
                              <span className={`text-xs font-medium whitespace-nowrap ${b.c}`}>{b.t}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {tutor.verificationStatus === 'rejected' && (
                      <>
                        {tutor.rejectionReason && (
                          <div className="bg-red-50 rounded-xl p-3">
                            <p className="text-xs text-red-700"><strong>Motif du rejet :</strong> {tutor.rejectionReason}</p>
                          </div>
                        )}
                        <Link href="/parametres?tab=Documents" className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                          Corriger et renvoyer mes documents
                        </Link>
                      </>
                    )}
                  </>
                )
              })()}
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

        {/* ── Parrainage ──────────────────────────────────────────── */}
        {referral && (
          <div className="card mt-6 border-accent-200 bg-gradient-to-br from-accent-50/60 to-primary-50/40">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-lg">🎁</span> Parrainez & gagnez des mois gratuits
              </h2>
              {referral.is_founder && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent text-white">★ Fondateur</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Invitez d'autres répétiteurs. Dès que <strong>{referral.threshold}</strong> filleuls sont abonnés,
              vous gagnez <strong>1 mois offert</strong> (répétable).
              {!referral.has_paid && <span className="text-gray-500"> Vos mois gagnés s'appliqueront à votre 1er paiement.</span>}
            </p>

            {/* Code de parrainage (partage à l'oral / SMS) */}
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Votre code</p>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-white border-2 border-dashed border-accent rounded-xl flex items-center justify-center py-2.5">
                <span className="font-display font-extrabold text-2xl tracking-[0.25em] text-accent-700">{referral.code}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(referral.code)
                  setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000)
                }}
                className="btn-primary text-sm px-4 whitespace-nowrap"
              >
                {codeCopied ? 'Copié !' : 'Copier'}
              </button>
            </div>

            {/* Lien de parrainage */}
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Ou partagez le lien</p>
            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}/inscription/repetiteur?ref=${referral.code}` : ''}
                onFocus={e => e.target.select()}
                className="input-field text-sm flex-1 bg-white/70"
              />
              <button
                type="button"
                onClick={() => {
                  const link = `${window.location.origin}/inscription/repetiteur?ref=${referral.code}`
                  navigator.clipboard?.writeText(link)
                  setRefCopied(true); setTimeout(() => setRefCopied(false), 2000)
                }}
                className="btn-primary text-sm px-4 whitespace-nowrap"
              >
                {refCopied ? 'Copié !' : 'Copier'}
              </button>
            </div>

            {/* Progression vers la prochaine récompense */}
            <div className="flex items-center gap-1.5 mb-1.5">
              {Array.from({ length: referral.threshold }).map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full ${i < (referral.qualified_count % referral.threshold) ? 'bg-secondary' : 'bg-gray-200'}`} />
              ))}
            </div>
            <p className="text-xs text-gray-500">
              <strong className="text-gray-800">{referral.qualified_count}</strong> filleul{referral.qualified_count > 1 ? 's' : ''} abonné{referral.qualified_count > 1 ? 's' : ''}
              {referral.pending_count > 0 && <> · {referral.pending_count} en attente de paiement</>}
              {referral.rewards_granted > 0 && <> · <strong className="text-secondary">{referral.rewards_granted} mois gagné{referral.rewards_granted > 1 ? 's' : ''}</strong></>}
              {referral.banked_days > 0 && <> · {Math.round(referral.banked_days / 30)} mois en réserve</>}
            </p>
          </div>
        )}

        {/* ── Vos avis ────────────────────────────────────────────── */}
        <div className="card mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Star size={18} className="text-accent" />
              Vos avis
              {myReviews.length > 0 && <span className="text-sm font-normal text-gray-400">({myReviews.length})</span>}
            </h2>
            {tutor.rating > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <Star size={15} className="text-accent" fill="#F4A61D" />
                <span className="font-bold text-gray-900">{tutor.rating.toFixed(1)}</span>
                <span className="text-gray-400">/ 5</span>
              </div>
            )}
          </div>
          {myReviews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Aucun avis pour le moment. Les avis laissés par vos familles apparaîtront ici.
            </p>
          ) : (
            <div className="space-y-4">
              {myReviews.map(r => (
                <div key={r.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {r.anonymous ? 'Parent vérifié' : r.parentName}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StarRating rating={r.rating} showNumber={false} size={13} />
                      <span className="text-xs text-gray-400">{formatDateShort(r.date)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                  {r.tutorResponse && (
                    <div className="mt-2 ml-1 pl-3 border-l-2 border-primary-100">
                      <p className="text-xs text-gray-500"><strong>Votre réponse :</strong> {r.tutorResponse}</p>
                    </div>
                  )}
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

      {/* ── Payer-pour-accepter : abonnement requis pour accepter ── */}
      {subGateId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={e => { if (e.target === e.currentTarget) setSubGateId(null) }}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={20} className="text-primary" />
              </div>
              <h3 className="font-display font-bold text-lg text-gray-900">Une famille souhaite vous recruter 🎓</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Pour <strong>accepter cette famille</strong> et <strong>échanger avec elle</strong> via la messagerie intégrée, activez votre abonnement.
            </p>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-green-800 font-semibold">✅ Ce n'est pas un paiement par demande.</p>
              <p className="text-xs text-green-700 mt-0.5">Une fois abonné, vous acceptez autant de familles que vous voulez, tant que votre abonnement est actif.</p>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-700">Standard</span><span className="font-bold text-gray-900">3 000 FCFA/mois</span>
              </div>
              <div className="flex items-center justify-between bg-accent-50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-700">Premium <span className="text-[10px] text-accent-600">· profil mis en avant</span></span><span className="font-bold text-gray-900">5 000 FCFA/mois</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSubGateId(null)} className="btn-outline flex-1">Plus tard</button>
              <button onClick={() => { setSubGateId(null); router.push('/abonnement') }} className="btn-primary flex-1">Activer mon abonnement</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
