'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useChatBubble } from '../context/ChatBubbleContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/common/Avatar'
import TutorCard from '../components/common/TutorCard'
import {
  Calendar, MessageCircle, Heart, Search, Clock,
  FileText, AlertCircle, ChevronRight, BookOpen,
  Users, Send, MapPin, Star,
} from 'lucide-react'
import { formatFCFA } from '../utils/helpers'
import DashboardLayout from '../components/layout/DashboardLayout'

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
    subscribeToNotifications, getTutor, getOrCreateConversation,
    reportSession, declarePayment, runMaintenanceTasks,
  } = useApp()
  const { openChat } = useChatBubble()
  const parent = currentUser

  // ── Session report modal ────────────────────────────────────
  const [reportingSession, setReportingSession] = useState(null)
  const [presence, setPresence]         = useState(null)
  const [lateMinutes, setLateMinutes]   = useState('')
  const [rating, setRating]             = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [reportConfirm, setReportConfirm] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  // ── Répétiteurs disponibles ─────────────────────────────────
  const [matchingTutors, setMatchingTutors] = useState([])
  const [contactingId, setContactingId]     = useState(null)

  // ── Payment declaration modal ───────────────────────────────
  const [declaringEng, setDeclaringEng]   = useState(null)
  const [payMethod, setPayMethod]         = useState('cash')
  const [wantsContinue, setWantsContinue] = useState(null)
  const [payConfirm, setPayConfirm]       = useState(false)
  const [payLoading, setPayLoading]       = useState(false)

  useEffect(() => {
    if (!parent?.id) return
    loadUserConversations(parent.id)
    loadUserEngagements(parent.id, 'parent')
    loadAllUserSessions(parent.id, 'parent')
    loadUserFavorites(parent.id)
    loadUserNotifications(parent.id)
    runMaintenanceTasks()
    return subscribeToNotifications(parent.id)
  }, [parent?.id])

  // Répétiteurs vérifiés dans la même ville
  useEffect(() => {
    if (!parent?.city) return
    supabase
      .from('profiles')
      .select('id, first_name, last_name, city, avatar_color, tutors(subjects, levels, monthly_rate, rating, is_active, verification_status)')
      .eq('role', 'tutor')
      .eq('city', parent.city)
      .order('join_date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) return
        let list = data.filter(p => p.tutors?.is_active && p.tutors?.verification_status === 'verified')
        if (parent.subjectsNeeded?.length) {
          list = list.filter(t => !t.tutors?.subjects?.length || t.tutors.subjects.some(s => parent.subjectsNeeded.includes(s)))
        }
        list.sort((a, b) => (b.tutors?.rating || 0) - (a.tutors?.rating || 0))
        setMatchingTutors(list.slice(0, 12).map(p => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          city: p.city,
          avatarColor: p.avatar_color,
          subjects: p.tutors?.subjects || [],
          levels: p.tutors?.levels || [],
          monthlyRate: p.tutors?.monthly_rate,
          rating: p.tutors?.rating,
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

  const stats = [
    { label: 'Contrats actifs',     value: activeEngagements.length,  icon: <FileText size={20} />,  color: 'bg-secondary-50 text-secondary',                                                                            bar: 'bg-secondary' },
    { label: 'Séances à confirmer', value: sessionsToReport.length,   icon: <Clock size={20} />,     color: sessionsToReport.length > 0 ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400', bar: sessionsToReport.length > 0 ? 'bg-orange-500' : 'bg-gray-300' },
    { label: 'Cette semaine',       value: thisWeekSessions.length,   icon: <Calendar size={20} />,  color: 'bg-primary-50 text-primary',                                                                                bar: 'bg-primary' },
    { label: 'Répétiteurs favoris', value: favoriteTutors.length,     icon: <Heart size={20} />,     color: 'bg-red-50 text-red-500',                                                                                    bar: 'bg-red-500' },
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Avatar user={parent} size="lg" />
            <div>
              <h1 className="font-display text-2xl font-bold text-gray-900">Bonjour, {parent.firstName} !</h1>
              <p className="text-gray-500 text-sm mt-0.5">Espace parent</p>
            </div>
          </div>
          <Link href="/recherche" className="btn-primary flex items-center gap-2">
            <Search size={18} /> Trouver un répétiteur
          </Link>
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
            <div key={i} className="card relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${s.bar}`} />
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

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
                Cette semaine
              </h2>
            </div>
            {thisWeekSessions.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucune séance cette semaine</p>
                {activeEngagements.length === 0 && (
                  <Link href="/recherche" className="text-xs text-primary font-medium mt-2 block hover:underline">
                    Trouver un répétiteur →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {thisWeekSessions.map(s => {
                  const eng = engagements.find(e => e.id === s.engagementId)
                  const t = eng ? getTutor(eng.tutorId) : null
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-primary-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary leading-none">{s.scheduledDate.split('-')[2]}</span>
                        <span className="text-xs text-primary/60 leading-none">{MONTHS_FR[parseInt(s.scheduledDate.split('-')[1]) - 1]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{eng?.subject}</p>
                        <p className="text-xs text-gray-500">{t?.firstName} {t?.lastName} · {s.scheduledTime?.slice(0, 5)}</p>
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
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Avatar user={t} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{e.subject} — {t?.firstName} {t?.lastName}</p>
                        <p className="text-xs text-gray-500">
                          {e.status === 'active'
                            ? (days === 0 ? "Se termine aujourd'hui" : `Se termine dans ${days} j`)
                            : "En attente d'acceptation du répétiteur"}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {e.status === 'active' ? 'Actif' : 'En attente'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
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

        {/* Répétiteurs disponibles */}
        <div className="mt-6">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users size={18} className="text-secondary" />
              Répétiteurs disponibles à {parent.city}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {matchingTutors.length > 0
                ? `${matchingTutors.length} répétiteur${matchingTutors.length > 1 ? 's' : ''} correspond${matchingTutors.length > 1 ? 'ent' : ''} à votre recherche`
                : "Aucun répétiteur correspondant pour l'instant"}
            </p>
          </div>

          {matchingTutors.length === 0 ? (
            <div className="card text-center py-10">
              <Users size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Aucun répétiteur vérifié dans votre ville pour l'instant.</p>
              <Link href="/recherche" className="text-xs text-primary font-medium mt-2 inline-block hover:underline">
                Recherche avancée →
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matchingTutors.map(t => (
                <div key={t.id} className="card flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: t.avatarColor || '#E87722' }}
                    >
                      {t.firstName?.[0]}{t.lastName?.[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{t.firstName} {t.lastName}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} /> {t.city}</p>
                    </div>
                    {t.rating > 0 && (
                      <div className="flex items-center gap-1 text-accent text-xs font-semibold flex-shrink-0">
                        <Star size={12} fill="currentColor" /> {t.rating?.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {t.monthlyRate > 0 && (
                      <p className="text-xs text-gray-600 font-medium">{formatFCFA(t.monthlyRate)} / mois</p>
                    )}
                    {t.subjects?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {t.subjects.slice(0, 3).map(s => (
                          <span
                            key={s}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${parent.subjectsNeeded?.includes(s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {s}
                          </span>
                        ))}
                        {t.subjects.length > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+{t.subjects.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Link
                      href={`/repetiteur/${t.id}`}
                      className="btn-outline text-xs py-2 flex-1 text-center"
                    >
                      Profil
                    </Link>
                    <button
                      onClick={() => handleContactTutor(t.id)}
                      disabled={contactingId === t.id}
                      className="btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {contactingId === t.id
                        ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Send size={13} />}
                      Contacter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
