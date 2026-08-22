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
    loadUserConversations, loadUserNotifications, subscribeToNotifications,
    getOrCreateConversation,
    loadUserEngagements, getUserEngagements,
    loadAllUserSessions, getAllUserSessions,
    respondToEngagement, confirmPayment,
    runMaintenanceTasks, showToast,
  } = useApp()
  const { openChat } = useChatBubble()
  const { setSlot } = useHeaderSlot()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tutor = currentUser

  const [showConfetti, setShowConfetti] = useState(false)
  useEffect(() => {
    if (searchParams.get('welcome') === '1') {
      setShowConfetti(true)
      router.replace('/tableau-de-bord/repetiteur')
    }
  }, [searchParams, router])

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
    runMaintenanceTasks()
    return subscribeToNotifications(tutor.id)
  }, [tutor?.id])

  // Parents cherchant un répétiteur dans la même ville
  useEffect(() => {
    if (!tutor?.city) return
    supabase
      .from('public_profiles')
      .select('id, first_name, last_name, city, avatar_color, subjects_needed, child_levels, join_date')
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
          avatarColor: p.avatar_color, childLevels: p.child_levels || [],
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

  const handleContactParent = async (parentId) => {
    if (contactingId) return
    // Fonctionnalité réservée aux abonnements payants actifs.
    if (!tutor.isActive) { showToast('Passez à un plan payant pour contacter les parents.', 'error'); return }
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

  const allSessions         = getAllUserSessions(tutor?.id, 'tutor')
  const pendingEngagements  = engagements.filter(e => e.status === 'pending')
  const activeEngagements   = engagements.filter(e => e.status === 'active')
  const upcomingSessions    = allSessions
    .filter(s => !isDatePast(s.scheduledDate))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
    .slice(0, 5)
  const currentMonth      = new Date().toISOString().slice(0, 7)
  const monthSessionCount = allSessions.filter(s => s.scheduledDate?.startsWith(currentMonth)).length
  const unreadMessages    = conversations.reduce((sum, c) => sum + (c.unreadCount?.[tutor?.id] || 0), 0)
  const daysLeft          = getSubscriptionDaysLeft(tutor.subscription?.endDate)
  const isSubscriptionActive = tutor.subscription?.status === 'active'
  const isVerified        = tutor.verificationStatus === 'verified'
  const isPremium         = tutor.subscription?.plan === 'premium'
  const hasId             = tutor.documents?.cniRecto || tutor.documents?.passport || tutor.documents?.cni

  const monthlyRevenue    = activeEngagements.reduce((sum, e) => sum + (e.monthlyRate || 0), 0)
  const pendingRevenue    = pendingPayments.reduce((sum, p) => sum + (p.amount || p.engagement?.monthly_rate || 0), 0)
  const confirmedRevenue  = monthlyRevenue - pendingRevenue

  // Delta vs mois précédent (calculé à partir de allSessions déjà chargés)
  const prevMonthStr          = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7)
  const prevMonthSessionCount = allSessions.filter(s => s.scheduledDate?.startsWith(prevMonthStr)).length
  const sessionDelta          = monthSessionCount - prevMonthSessionCount

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
      label: 'Séances ce mois', value: monthSessionCount, emoji: '📅',
      bg: 'bg-secondary-50', bar: 'bg-secondary',
      delta: sessionDelta > 0 ? `↑ +${sessionDelta} vs mois dernier` : sessionDelta < 0 ? `↓ ${sessionDelta} vs mois dernier` : '→ stable vs mois dernier',
      deltaClass: sessionDelta > 0 ? 'text-green-600' : sessionDelta < 0 ? 'text-red-500' : 'text-gray-400',
    },
    {
      label: 'Revenus FCFA (mois)', value: monthlyRevenue > 0 ? monthlyRevenue.toLocaleString('fr-FR') : '0',
      emoji: '💰', bg: 'bg-accent-50', bar: 'bg-accent', bigVal: monthlyRevenue >= 100000,
      subValue: pendingRevenue > 0 ? `✓ Confirmés : ${formatFCFA(confirmedRevenue)}` : null,
      subClass: 'text-green-600',
      delta: pendingRevenue > 0 ? `⏳ En attente : ${formatFCFA(pendingRevenue)}` : monthlyRevenue > 0 ? '✓ Tout confirmé' : '→ stable',
      deltaClass: pendingRevenue > 0 ? 'text-orange-500' : monthlyRevenue > 0 ? 'text-green-600' : 'text-gray-400',
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

        {/* Parents qui cherchent — remonté avant l'agenda pour visibilité */}
        <div className="mt-6 mb-5">
          <div className="mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <Users size={17} className="text-secondary" />
              Parents qui cherchent un répétiteur à {tutor.city}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {matchingParents.length > 0
                ? `${matchingParents.length} parent${matchingParents.length > 1 ? 's' : ''} correspondent à votre profil`
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

        <div className="grid md:grid-cols-2 gap-5">
          {/* Agenda semaine — grille 7 jours */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">📅 Semaine en cours</h2>
              <Link href="/reservations" className="text-xs text-primary font-medium hover:underline">Voir tout</Link>
            </div>
            {(() => {
              const SUBJ_COLORS = [
                'bg-primary/10 text-primary border-primary/20',
                'bg-blue-50 text-blue-700 border-blue-100',
                'bg-green-50 text-green-700 border-green-100',
                'bg-purple-50 text-purple-700 border-purple-100',
                'bg-orange-50 text-orange-700 border-orange-100',
              ]
              const subjColorMap = {}
              let colorIdx = 0
              const getSubjColor = (subject) => {
                if (!subjColorMap[subject]) subjColorMap[subject] = SUBJ_COLORS[colorIdx++ % SUBJ_COLORS.length]
                return subjColorMap[subject]
              }
              const today   = new Date()
              const todayStr = today.toISOString().split('T')[0]
              const dow = today.getDay()
              const monday = new Date(today)
              monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
              monday.setHours(0, 0, 0, 0)
              const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
              const weekDates = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(monday)
                d.setDate(monday.getDate() + i)
                return d
              })
              const sessionsThisWeek = allSessions.filter(s => {
                const d = toDate(s.scheduledDate)
                return d >= monday && d <= new Date(monday.getTime() + 6 * 86400000 + 86399999)
              })
              const hasSessions = sessionsThisWeek.length > 0
              return (
                <div>
                  <div className="grid grid-cols-7 gap-1">
                    {weekDates.map((date, i) => {
                      const dateStr = date.toISOString().split('T')[0]
                      const isToday = dateStr === todayStr
                      const isPast  = date < new Date(new Date().toDateString())
                      const daySessions = sessionsThisWeek.filter(s => s.scheduledDate === dateStr)
                      return (
                        <div key={i} className={`flex flex-col items-center gap-1 rounded-xl py-2 px-0.5 transition-colors ${isToday ? 'bg-primary/8 ring-1 ring-primary/20' : ''}`}>
                          <span className={`text-[9px] font-black uppercase tracking-wide ${isToday ? 'text-primary' : isPast ? 'text-gray-300' : 'text-gray-400'}`}>
                            {WEEK_DAYS[i]}
                          </span>
                          <span className={`text-sm font-black leading-none ${isToday ? 'text-primary' : isPast ? 'text-gray-300' : 'text-gray-700'}`}>
                            {date.getDate()}
                          </span>
                          <div className="flex flex-col gap-0.5 w-full mt-0.5">
                            {daySessions.length === 0 && (
                              <div className="h-1 rounded-full bg-gray-100 mx-1" />
                            )}
                            {daySessions.slice(0, 3).map(s => {
                              const eng = engagements.find(e => e.id === s.engagementId)
                              return (
                                <div
                                  key={s.id}
                                  title={`${eng?.subject || '?'} · ${s.scheduledTime?.slice(0,5) || ''}`}
                                  className={`w-full h-1.5 rounded-full border ${getSubjColor(eng?.subject || '?')}`}
                                />
                              )
                            })}
                            {daySessions.length > 3 && (
                              <span className="text-[8px] text-center text-gray-400 font-bold">+{daySessions.length - 3}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {hasSessions ? (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                      {sessionsThisWeek.slice(0, 4).map(s => {
                        const eng = engagements.find(e => e.id === s.engagementId)
                        const par = eng ? parentProfiles[eng.parentId] : null
                        const d   = toDate(s.scheduledDate)
                        return (
                          <div key={s.id} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.scheduledDate === todayStr ? 'bg-primary' : 'bg-gray-300'}`} />
                            <span className="text-[11px] text-gray-500 w-8 flex-shrink-0 tabular-nums">{WEEK_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}</span>
                            <span className="text-[11px] font-semibold text-gray-800 truncate flex-1">{eng?.subject}{par ? ` · ${par.firstName}` : ''}</span>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{s.scheduledTime?.slice(0,5)}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-gray-400 mt-4 pb-2">Aucune séance cette semaine</p>
                  )}
                </div>
              )
            })()}
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
                    <div key={e.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl">
                      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${bars[idx % bars.length]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                          {par ? `${par.firstName} ${par.lastName?.[0]}.` : '…'} · {e.subject}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{shortDate(e.startDate)} → {shortDate(e.endDate)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-gray-900">{formatFCFA(e.monthlyRate)}</p>
                        <p className="text-[10px] font-bold text-green-600 mt-0.5">Actif ✓</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Abonnement mini-résumé */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Abonnement · <span className={`font-semibold ${isPremium ? 'text-accent' : 'text-gray-700'}`}>{getStatusLabel(tutor.subscription?.plan || 'gratuit')}</span></p>
                {isSubscriptionActive && <p className="text-[10px] text-gray-400 mt-0.5">{daysLeft} jours restants</p>}
              </div>
              <Link href="/abonnement" className="text-xs text-primary font-semibold hover:underline">Gérer</Link>
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
              {(() => {
                // Statut de validation par pièce (approuvé / en attente / rejeté).
                const badge = (submitted, review) => {
                  if (!submitted) return { t: '✗ Non soumis', c: 'text-red-500' }
                  const s = review?.status
                  if (s === 'approved') return { t: '✅ Approuvé', c: 'text-green-600' }
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
                    {tutor.verificationStatus === 'rejected' && tutor.rejectionReason && (
                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-xs text-red-700"><strong>Motif du rejet :</strong> {tutor.rejectionReason}</p>
                      </div>
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
    </DashboardLayout>
  )
}
