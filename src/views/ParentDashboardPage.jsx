'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useChatBubble } from '../context/ChatBubbleContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/common/Avatar'
import TutorCard from '../components/common/TutorCard'
import {
  Calendar, MessageCircle, Heart, Search, Clock,
  FileText, AlertCircle, ChevronRight, ChevronLeft, BookOpen,
  Users, Send, MapPin, Star,
} from 'lucide-react'
import { formatFCFA } from '../utils/helpers'
import DashboardLayout, { useHeaderSlot } from '../components/layout/DashboardLayout'

// ── Date helpers ─────────────────────────────────────────────
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
const DAYS_FR   = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

function toDate(str) { return new Date(str + 'T00:00:00') }
function shortDate(str) { const d = toDate(str); return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}` }
function isDatePast(str) { return toDate(str) < new Date(new Date().toDateString()) }
function daysUntil(str) { return Math.ceil((toDate(str) - new Date(new Date().toDateString())) / 86400000) }
function isThisWeek(str) {
  const today = new Date(); const dow = today.getDay()
  const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1)); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
  const d = toDate(str); return d >= mon && d <= sun
}

// ── StarPicker ───────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          className={`text-2xl leading-none transition-colors ${n <= value ? 'text-accent' : 'text-gray-200 hover:text-yellow-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────
export default function ParentDashboardPage() {
  const { currentUser } = useAuth()
  const {
    getUserConversations, getUserEngagements, getAllUserSessions,
    loadUserConversations, loadUserEngagements, loadAllUserSessions,
    loadUserFavorites, getUserFavorites, loadUserNotifications,
    subscribeToNotifications, subscribeToEngagements, getTutor, getOrCreateConversation,
    reportSession, declarePayment, endEngagement, setSessionsDone, runMaintenanceTasks, levelPackages,
  } = useApp()
  const { openChat } = useChatBubble()
  const { setSlot } = useHeaderSlot()
  const parent = currentUser

  // ── Session report modal ────────────────────────────────────
  const [reportingSession, setReportingSession] = useState(null)
  const [presence, setPresence]         = useState(null)
  const [lateMinutes, setLateMinutes]   = useState('')
  const [rating, setRating]             = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [reportConfirm, setReportConfirm] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [endModal, setEndModal]           = useState(null)   // contrat à résilier / demande à annuler
  const [endLoading, setEndLoading]       = useState(false)
  const [confirmedPayments, setConfirmedPayments] = useState([])

  // ── Répétiteurs disponibles ─────────────────────────────────
  const [matchingTutors, setMatchingTutors] = useState([])
  const availRef = useRef(null)
  const scrollAvail = (dir) => availRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })
  const [contactingId, setContactingId]     = useState(null)

  // ── Payment declaration modal ───────────────────────────────
  const [declaringEng, setDeclaringEng]   = useState(null)
  const [payMethod, setPayMethod]         = useState('cash')
  const [wantsContinue, setWantsContinue] = useState(null)
  const [payConfirm, setPayConfirm]       = useState(false)
  const [payLoading, setPayLoading]       = useState(false)

  useEffect(() => {
    setSlot(
      <Link href="/recherche" className="btn-primary text-sm flex items-center gap-2">
        <Search size={15} /> Trouver un répétiteur
      </Link>
    )
    return () => setSlot(null)
  }, [])

  useEffect(() => {
    if (!parent?.id) return
    loadUserConversations(parent.id)
    loadUserEngagements(parent.id, 'parent')
    loadAllUserSessions(parent.id, 'parent')
    loadUserFavorites(parent.id)
    loadUserNotifications(parent.id)
    runMaintenanceTasks()
    const unsubNotif = subscribeToNotifications(parent.id)
    const unsubEng = subscribeToEngagements(parent.id, 'parent')
    return () => { unsubNotif?.(); unsubEng?.() }
  }, [parent?.id])

  // Paiements confirmés (dépenses réelles — postpayé)
  useEffect(() => {
    if (!parent?.id) return
    supabase
      .from('payments')
      .select('amount, tutor_confirmed_at, engagement:engagements!inner(parent_id, monthly_rate)')
      .eq('engagement.parent_id', parent.id)
      .eq('status', 'confirmed')
      .then(({ data }) => { if (data) setConfirmedPayments(data) })
  }, [parent?.id])

  // Répétiteurs vérifiés dans la même ville
  useEffect(() => {
    if (!parent?.city) return
    supabase
      .from('public_tutors')
      .select('id, first_name, last_name, city, avatar_color, subjects, levels, monthly_rate, rating, is_active, verification_status')
      .eq('city', parent.city)
      .order('join_date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) return
        let list = data.filter(t => t.is_active && t.verification_status === 'verified')
        if (parent.subjectsNeeded?.length) {
          list = list.filter(t => !t.subjects?.length || t.subjects.some(s => parent.subjectsNeeded.includes(s)))
        }
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
        setMatchingTutors(list.slice(0, 12).map(t => ({
          id: t.id,
          firstName: t.first_name,
          lastName: t.last_name,
          city: t.city,
          avatarColor: t.avatar_color,
          subjects: t.subjects || [],
          levels: t.levels || [],
          monthlyRate: t.monthly_rate,
          rating: t.rating,
        })))
      })
  }, [parent?.city])

  const conversations  = getUserConversations(parent.id)
  const engagements    = getUserEngagements(parent.id, 'parent')
  const allSessions    = getAllUserSessions(parent.id, 'parent')
  const favoriteTutors = getUserFavorites(parent.id)
  const unreadMessages = conversations.reduce((s, c) => s + (c.unreadCount?.[parent.id] || 0), 0)

  const activeEngagements  = engagements.filter(e => e.status === 'active')
  const pendingEngagements = engagements.filter(e => e.status === 'pending')

  // Sessions passées sans rapport du parent
  const sessionsToReport = allSessions
    .filter(s => isDatePast(s.scheduledDate) && !s.parentReport)
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))

  // Séances à venir cette semaine
  const thisWeekSessions = allSessions
    .filter(s => !isDatePast(s.scheduledDate) && isThisWeek(s.scheduledDate))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.scheduledTime.localeCompare(b.scheduledTime))

  // Contrats dont le paiement est dû (≤ 5 jours avant la fin)
  const paymentDueEngagements = activeEngagements.filter(e => {
    const days = daysUntil(e.endDate)
    return days >= 0 && days <= 5
  })

  const upcomingSessions  = allSessions.filter(s => !isDatePast(s.scheduledDate))
  const currentMonth      = new Date().toISOString().slice(0, 7)
  // Séances = validées par le parent (compteur) + total du forfait.
  const sessionsDoneTotal   = activeEngagements.reduce((s, e) => s + (e.sessionsDone || 0), 0)
  const sessionsTargetTotal = activeEngagements.reduce((s, e) => {
    const pkg = levelPackages.find(p => p.levelKey === e.levelKey)
    return s + (pkg ? pkg.sessionsPerWeek * 4 : 0)
  }, 0)
  // Dépenses = paiements CONFIRMÉS ce mois (postpayé), pas le tarif des contrats.
  const confirmedSpend    = confirmedPayments
    .filter(p => (p.tutor_confirmed_at || '').slice(0, 7) === currentMonth)
    .reduce((sum, p) => sum + (p.amount || p.engagement?.monthly_rate || 0), 0)
  const expectedSpend     = activeEngagements.reduce((sum, e) => sum + (e.monthlyRate || 0), 0)
  const favoriteIds       = new Set(favoriteTutors.map(t => t.id))
  // Séances restantes du forfait ce mois = total prévu − validées.
  const sessionsRemaining = Math.max(0, sessionsTargetTotal - sessionsDoneTotal)

  const stats = [
    { label: 'Séances restantes',  value: sessionsRemaining,   emoji: '📅', bg: 'bg-primary-50',   bar: 'bg-primary',   delta: sessionsTargetTotal > 0 ? `sur ${sessionsTargetTotal} ce mois` : '→ stable',       deltaClass: 'text-gray-400' },
    { label: 'Contrats actifs',     value: activeEngagements.length,  emoji: '📋', bg: 'bg-secondary-50', bar: 'bg-secondary', delta: '→ stable',                                                    deltaClass: 'text-gray-400' },
    { label: 'Séances validées',    value: sessionsTargetTotal > 0 ? `${sessionsDoneTotal}/${sessionsTargetTotal}` : '0', emoji: '📚', bg: 'bg-blue-50', bar: 'bg-blue-500', delta: sessionsTargetTotal > 0 ? 'à cocher au fil du mois' : '→ stable', deltaClass: 'text-gray-400' },
    { label: 'Dépenses FCFA (mois)', value: confirmedSpend > 0 ? confirmedSpend.toLocaleString('fr-FR') : '0', emoji: '💸', bg: 'bg-orange-50', bar: 'bg-orange-500', bigVal: confirmedSpend >= 100000, delta: paymentDueEngagements.length > 0 ? `${paymentDueEngagements.length} règlement${paymentDueEngagements.length > 1 ? 's' : ''} à venir` : expectedSpend > 0 ? `À régler ce mois : ${expectedSpend.toLocaleString('fr-FR')} FCFA` : '→ stable', deltaClass: paymentDueEngagements.length > 0 ? 'text-orange-500' : 'text-gray-400' },
  ]

  // ── Handlers ────────────────────────────────────────────────

  const openReportModal = (session) => {
    setReportingSession(session)
    setPresence(null); setLateMinutes(''); setRating(0); setRatingComment(''); setReportConfirm(false)
  }

  const submitReport = async () => {
    if (!presence || !reportingSession) return
    setReportLoading(true)
    await reportSession(
      reportingSession.id,
      reportingSession.engagementId,
      presence,
      presence === 'late' ? (parseInt(lateMinutes) || null) : null,
      rating || null,
      ratingComment || null,
    )
    setReportLoading(false)
    setReportingSession(null)
  }

  const openPayModal = (eng) => {
    setDeclaringEng(eng); setPayMethod('cash'); setWantsContinue(null); setPayConfirm(false)
  }

  const submitPayment = async () => {
    if (!declaringEng || wantsContinue === null) return
    setPayLoading(true)
    await declarePayment(declaringEng.id, { amount: declaringEng.monthlyRate, paymentMethod: payMethod, wantsContinue })
    setPayLoading(false)
    setDeclaringEng(null)
  }

  const handleContactTutor = async (tutorId) => {
    if (contactingId) return
    setContactingId(tutorId)
    const conv = await getOrCreateConversation(parent.id, tutorId)
    setContactingId(null)
    if (conv) openChat(conv.id)
  }

  const PAY_METHODS = { cash: 'Cash', orange_money: 'Orange Money', wave: 'Wave', mtn_money: 'MTN Money' }

  // ── Render ──────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold text-gray-900">Bonjour, {parent.firstName} 👋</h1>
          <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {upcomingSessions.length > 0 && <span>— {upcomingSessions.length} séance{upcomingSessions.length > 1 ? 's' : ''} planifiée{upcomingSessions.length > 1 ? 's' : ''}</span>}
            {sessionsToReport.length > 0 && (
              <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                <Clock size={11} /> {sessionsToReport.length} à confirmer
              </span>
            )}
          </p>
        </div>

        {/* Alerts */}
        <div className="space-y-3 mb-6">
          {unreadMessages > 0 && (
            <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl p-4">
              <MessageCircle size={20} className="text-primary" />
              <p className="text-sm font-medium text-primary-700 flex-1">
                {unreadMessages} nouveau{unreadMessages > 1 ? 'x' : ''} message{unreadMessages > 1 ? 's' : ''}
              </p>
              <button onClick={() => openChat()} className="text-xs text-primary font-semibold bg-white px-3 py-1.5 rounded-lg border border-primary/20">Voir</button>
            </div>
          )}

          {paymentDueEngagements.map(e => {
            const t = getTutor(e.tutorId)
            const days = daysUntil(e.endDate)
            return (
              <div key={e.id} className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
                <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">
                    Règlement à prévoir {days === 0 ? "aujourd'hui" : `dans ${days} jour${days > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-sm text-orange-700">
                    {e.subject} avec {t?.firstName} {t?.lastName} — {formatFCFA(e.monthlyRate)}
                  </p>
                </div>
                <button
                  onClick={() => openPayModal(e)}
                  className="text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg whitespace-nowrap"
                >
                  Déclarer le paiement
                </button>
              </div>
            )
          })}

          {sessionsToReport.length > 0 && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <Clock size={20} className="text-blue-600 flex-shrink-0" />
              <p className="text-sm font-medium text-blue-700 flex-1">
                {sessionsToReport.length} séance{sessionsToReport.length > 1 ? 's' : ''} passée{sessionsToReport.length > 1 ? 's' : ''} — confirmez la présence du répétiteur
              </p>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <div key={i} className="card relative overflow-hidden flex items-center gap-4 py-4 px-4">
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${s.bar}`} />
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${s.bg}`}>{s.emoji}</div>
              <div className="min-w-0">
                <p className={`font-black text-gray-900 tabular-nums leading-none ${s.bigVal ? 'text-[17px]' : 'text-[22px]'}`}>{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-1.5 font-semibold leading-tight">{s.label}</p>
                {s.delta && <p className={`text-[10px] font-bold mt-1 ${s.deltaClass}`}>{s.delta}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Répétiteurs disponibles — remonté en haut pour la visibilité */}
        {matchingTutors.length > 0 && (
          <div className="card mb-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900">🎯 Répétiteurs disponibles — {parent.city}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {matchingTutors.length} répétiteur{matchingTutors.length > 1 ? 's' : ''} · filtrés par matière
                  {favoriteTutors.length > 0 && ` · ★ favoris en tête`}
                </p>
              </div>
              <Link href="/recherche" className="text-xs text-primary font-semibold hover:underline">Voir tout →</Link>
            </div>
            <div className="relative">
              <button type="button" onClick={() => scrollAvail(-1)}
                      className="hidden sm:flex absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 items-center justify-center hover:bg-gray-50">
                <ChevronLeft size={16} />
              </button>
              <div ref={availRef} className="flex gap-3 overflow-x-auto scroll-smooth snap-x pb-1" style={{ scrollbarWidth: 'none' }}>
                {[
                  ...matchingTutors.filter(t => favoriteIds.has(t.id)),
                  ...matchingTutors.filter(t => !favoriteIds.has(t.id)),
                ].slice(0, 12).map(t => (
                  <div key={t.id} className="w-40 flex-shrink-0 snap-start">
                    <TutorCard tutor={t} />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => scrollAvail(1)}
                      className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-100 items-center justify-center hover:bg-gray-50">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Séances à confirmer — prioritaire */}
        {sessionsToReport.length > 0 && (
          <div className="card mb-5 border-orange-200 bg-orange-50/30">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                Séances à confirmer
                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">{sessionsToReport.length}</span>
              </h2>
            </div>
            <div className="space-y-3">
              {sessionsToReport.slice(0, 5).map(s => {
                const eng = engagements.find(e => e.id === s.engagementId)
                const t = eng ? getTutor(eng.tutorId) : null
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-orange-100">
                    <Avatar user={t} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {eng?.subject} — {t?.firstName} {t?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{shortDate(s.scheduledDate)} à {s.scheduledTime?.slice(0, 5)}</p>
                    </div>
                    <button
                      onClick={() => openReportModal(s)}
                      className="text-xs font-semibold text-primary bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg whitespace-nowrap"
                    >
                      Confirmer
                    </button>
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
                Ce mois-ci
              </h2>
            </div>
            {activeEngagements.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucun contrat en cours</p>
                <Link href="/recherche" className="text-xs text-primary font-medium mt-2 block hover:underline">
                  Trouver un répétiteur →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activeEngagements.map(e => {
                  const t = getTutor(e.tutorId)
                  const pkg = levelPackages.find(p => p.levelKey === e.levelKey)
                  const total = pkg ? pkg.sessionsPerWeek * 4 : 0
                  const days = daysUntil(e.endDate)
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Avatar user={t} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{t?.firstName} {t?.lastName}</p>
                        <p className="text-xs text-gray-500">{e.sessionsDone}/{total} séances validées{days >= 0 && days <= 7 ? ` · règlement dans ${days} j` : ''}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mes contrats */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-secondary" />
                Mes contrats
              </h2>
            </div>
            {activeEngagements.length === 0 && pendingEngagements.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucun contrat en cours</p>
                <Link href="/recherche" className="text-xs text-primary font-medium mt-2 block hover:underline">
                  Trouver un répétiteur →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {[...activeEngagements, ...pendingEngagements].map(e => {
                  const t = getTutor(e.tutorId)
                  const days = daysUntil(e.endDate)
                  const pkg = levelPackages.find(p => p.levelKey === e.levelKey)
                  const totalSessions = e.status === 'active' && pkg ? pkg.sessionsPerWeek * 4 : 0
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Avatar user={t} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{e.subject} — {t?.firstName} {t?.lastName}</p>
                        <p className="text-xs text-gray-500">
                          {e.status === 'active'
                            ? (days < 0 ? 'Contrat expiré (renouvellement en attente)' : days === 0 ? "Se termine aujourd'hui" : `Se termine dans ${days} j`)
                            : "En attente d'acceptation du répétiteur"}
                        </p>
                        {e.status === 'active' && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatFCFA(e.monthlyRate)}/mois
                            {days >= 0 && days <= 7 && (
                              <span className="ml-1 text-orange-500 font-semibold">· Règlement dans {days} j</span>
                            )}
                          </p>
                        )}
                        {e.status === 'active' && totalSessions > 0 && (
                          <div className="mt-1.5">
                            <p className="text-[11px] text-gray-500 mb-1">Séances faites ce mois : <strong>{e.sessionsDone}/{totalSessions}</strong></p>
                            <div className="flex flex-wrap gap-1">
                              {Array.from({ length: totalSessions }).map((_, k) => {
                                const done = k < e.sessionsDone
                                return (
                                  <button
                                    key={k}
                                    onClick={() => setSessionsDone(e.id, done ? k : k + 1)}
                                    title={`Séance ${k + 1}`}
                                    className={`w-6 h-6 rounded-md border text-[10px] flex items-center justify-center transition-colors ${done ? 'bg-secondary text-white border-secondary' : 'bg-white border-gray-300 text-gray-400 hover:border-secondary'}`}
                                  >
                                    {done ? '✓' : k + 1}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {e.status === 'active' ? 'Actif' : 'En attente'}
                        </span>
                        {e.status === 'active' && (
                          <button onClick={() => setEndModal(e)} className="text-[11px] text-red-500 hover:text-red-600 font-medium">Mettre fin</button>
                        )}
                        {e.status === 'pending' && (
                          <button onClick={() => setEndModal(e)} className="text-[11px] text-red-500 hover:text-red-600 font-medium">Annuler</button>
                        )}
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
                <h3 className="font-semibold text-gray-900 mb-2">{endModal.status === 'pending' ? 'Annuler la demande ?' : 'Mettre fin au contrat ?'}</h3>
                <p className="text-sm text-gray-500 mb-5">{endModal.status === 'pending'
                  ? 'Votre demande de contrat sera annulée. Vous pourrez en soumettre une nouvelle (autre niveau, autres jours).'
                  : 'Le contrat avec ce répétiteur sera résilié. Le répétiteur en sera informé. Cette action est définitive.'}</p>
                <div className="flex gap-3">
                  <button onClick={() => setEndModal(null)} disabled={endLoading} className="btn-outline flex-1">Annuler</button>
                  <button
                    onClick={async () => { setEndLoading(true); const ok = await endEngagement(endModal.id, 'parent'); setEndLoading(false); if (ok) setEndModal(null) }}
                    disabled={endLoading}
                    className="flex-1 bg-red-500 text-white font-semibold px-4 py-3 rounded-full hover:bg-red-600 disabled:opacity-60"
                  >
                    {endLoading ? '…' : (endModal.status === 'pending' ? 'Annuler la demande' : 'Mettre fin')}
                  </button>
                </div>
              </div>
            </div>
          )}

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
              <div className="text-center py-8">
                <MessageCircle size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucune conversation</p>
                <Link href="/recherche" className="text-xs text-primary font-medium mt-2 block hover:underline">
                  Contacter un répétiteur →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 3).map(conv => {
                  const tutorId = conv.participants.find(p => p !== parent.id)
                  const t = getTutor(tutorId)
                  const unread = conv.unreadCount[parent.id] || 0
                  return (
                    <button
                      key={conv.id}
                      onClick={() => openChat(conv.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left ${unread ? 'bg-primary-50' : ''}`}
                    >
                      <Avatar user={t} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${unread ? 'font-semibold' : 'font-medium'} text-gray-800`}>{t?.firstName} {t?.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{conv.lastMessage?.content}</p>
                      </div>
                      {unread > 0 && (
                        <span className="w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">{unread}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Favoris */}
          {favoriteTutors.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Heart size={18} className="text-red-400" />
                  Répétiteurs favoris
                </h2>
              </div>
              <div className="space-y-2">
                {favoriteTutors.slice(0, 3).map(t => <TutorCard key={t.id} tutor={t} compact />)}
              </div>
            </div>
          )}
        </div>

        {/* CTA vide */}
        {activeEngagements.length === 0 && pendingEngagements.length === 0 && conversations.length === 0 && (
          <div className="mt-6 card text-center bg-gradient-to-br from-primary-50 to-secondary-50 border-primary-100">
            <BookOpen size={48} className="text-primary mx-auto mb-4 opacity-80" />
            <h3 className="font-display font-semibold text-xl text-gray-800 mb-2">Commencez dès aujourd'hui !</h3>
            <p className="text-gray-500 text-sm mb-5">Trouvez le répétiteur idéal parmi nos professeurs vérifiés.</p>
            <Link href="/recherche" className="btn-primary inline-flex items-center gap-2">
              <Search size={18} /> Trouver un répétiteur
            </Link>
          </div>
        )}

      </div>

      {/* ── Modal rapport de séance ─────────────────────────────── */}
      {reportingSession && (() => {
        const eng = engagements.find(e => e.id === reportingSession.engagementId)
        const t   = eng ? getTutor(eng.tutorId) : null
        return (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget && !reportLoading) setReportingSession(null) }}
          >
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
              {!reportConfirm ? (
                <>
                  <h3 className="font-display font-bold text-lg text-gray-900 mb-1">Rapport de séance</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    {eng?.subject} avec {t?.firstName} {t?.lastName}
                    {' · '}{shortDate(reportingSession.scheduledDate)} à {reportingSession.scheduledTime?.slice(0, 5)}
                  </p>

                  <p className="text-sm font-semibold text-gray-700 mb-3">Le répétiteur est-il venu ?</p>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {[
                      { value: 'on_time', emoji: '✓', label: 'À l\'heure', active: 'bg-green-500 text-white', idle: 'bg-green-50 text-green-700 border border-green-200' },
                      { value: 'late',    emoji: '⏰', label: 'En retard',  active: 'bg-orange-500 text-white', idle: 'bg-orange-50 text-orange-700 border border-orange-200' },
                      { value: 'absent',  emoji: '✗', label: 'Absent',     active: 'bg-red-500 text-white',    idle: 'bg-red-50 text-red-700 border border-red-200' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setPresence(opt.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl font-semibold text-sm transition-colors ${presence === opt.value ? opt.active : opt.idle}`}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {presence === 'late' && (
                    <div className="mb-4">
                      <label className="text-sm text-gray-600 mb-1 block">Retard estimé (minutes)</label>
                      <input
                        type="number" min="1" max="180"
                        value={lateMinutes}
                        onChange={e => setLateMinutes(e.target.value)}
                        className="input-field w-full"
                        placeholder="ex : 15"
                      />
                    </div>
                  )}

                  {presence && presence !== 'absent' && (
                    <div className="mb-5">
                      <p className="text-sm text-gray-600 mb-2">
                        Note de la séance <span className="text-gray-400 font-normal">(optionnel)</span>
                      </p>
                      <StarPicker value={rating} onChange={setRating} />
                      {rating > 0 && (
                        <textarea
                          value={ratingComment}
                          onChange={e => setRatingComment(e.target.value)}
                          className="input-field w-full mt-3 resize-none"
                          rows={2}
                          placeholder="Commentaire optionnel…"
                        />
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setReportingSession(null)} className="btn-outline flex-1">Annuler</button>
                    <button
                      onClick={() => setReportConfirm(true)}
                      disabled={!presence || (presence === 'late' && !lateMinutes)}
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      Valider
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display font-bold text-lg text-gray-900 mb-2">Confirmer votre rapport ?</h3>
                  <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm text-gray-700 space-y-1">
                    <p>Séance du <strong>{shortDate(reportingSession.scheduledDate)}</strong></p>
                    <p>Présence : <strong>
                      {presence === 'on_time' ? '✓ Venu à l\'heure' : presence === 'late' ? `⏰ En retard (${lateMinutes} min)` : '✗ Absent'}
                    </strong></p>
                    {rating > 0 && <p>Note : <strong>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</strong></p>}
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Cette information ne peut plus être modifiée après confirmation.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setReportConfirm(false)} className="btn-outline flex-1">Modifier</button>
                    <button onClick={submitReport} disabled={reportLoading} className="btn-primary flex-1 disabled:opacity-50">
                      {reportLoading
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        : 'Confirmer'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Modal déclaration de paiement ──────────────────────── */}
      {declaringEng && (() => {
        const t = getTutor(declaringEng.tutorId)
        return (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget && !payLoading) setDeclaringEng(null) }}
          >
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
              {!payConfirm ? (
                <>
                  <h3 className="font-display font-bold text-lg text-gray-900 mb-1">Déclarer le paiement</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    {declaringEng.subject} avec {t?.firstName} {t?.lastName} — {formatFCFA(declaringEng.monthlyRate)}
                  </p>

                  <p className="text-sm font-semibold text-gray-700 mb-2">Mode de paiement</p>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {Object.entries(PAY_METHODS).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setPayMethod(val)}
                        className={`p-3 rounded-xl text-sm font-medium border transition-colors ${payMethod === val ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-700 hover:border-primary/40'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-sm font-semibold text-gray-700 mb-2">Souhaitez-vous continuer le mois prochain ?</p>
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <button
                      onClick={() => setWantsContinue(true)}
                      className={`p-3 rounded-xl text-sm font-medium border transition-colors ${wantsContinue === true ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-700 hover:border-green-400'}`}
                    >
                      Oui, continuer
                    </button>
                    <button
                      onClick={() => setWantsContinue(false)}
                      className={`p-3 rounded-xl text-sm font-medium border transition-colors ${wantsContinue === false ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-700 hover:border-red-400'}`}
                    >
                      Non, arrêter
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setDeclaringEng(null)} className="btn-outline flex-1">Annuler</button>
                    <button
                      onClick={() => setPayConfirm(true)}
                      disabled={wantsContinue === null}
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display font-bold text-lg text-gray-900 mb-2">Confirmer votre déclaration ?</h3>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-5 text-sm text-gray-700 space-y-1">
                    <p>Montant payé : <strong>{formatFCFA(declaringEng.monthlyRate)}</strong></p>
                    <p>Via : <strong>{PAY_METHODS[payMethod]}</strong></p>
                    <p>Décision : <strong>{wantsContinue ? 'Continuer le mois prochain' : 'Arrêter le contrat'}</strong></p>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">
                    Le répétiteur devra confirmer la réception. Si les deux souhaitent continuer, le contrat sera renouvelé automatiquement.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setPayConfirm(false)} className="btn-outline flex-1">Modifier</button>
                    <button onClick={submitPayment} disabled={payLoading} className="btn-primary flex-1 disabled:opacity-50">
                      {payLoading
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        : 'Confirmer'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}
    </DashboardLayout>
  )
}
