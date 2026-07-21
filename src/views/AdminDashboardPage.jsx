'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Avatar from '../components/common/Avatar'
import { StatusBadge } from '../components/common/Badge'
import StarRating from '../components/common/StarRating'
import {
  Users, GraduationCap, Calendar, TrendingUp, ShieldCheck,
  CheckCircle, XCircle, Eye, AlertTriangle, Search,
  BarChart3, FileText, ExternalLink, Wallet,
} from 'lucide-react'
import { formatDateShort, formatFCFA } from '../utils/helpers'
import DashboardLayout from '../components/layout/DashboardLayout'

const TABS = ['Vue globale', 'Vérifications', 'Utilisateurs', 'Abonnements', 'Contrats']
const TODAY = new Date().toISOString().split('T')[0]

// Week / month boundaries (computed once at module load)
const _now = new Date()
const _dow = _now.getDay() // 0=dim
const _weekStart = new Date(_now)
_weekStart.setDate(_now.getDate() - (_dow === 0 ? 6 : _dow - 1))
_weekStart.setHours(0, 0, 0, 0)
const WEEK_START  = _weekStart.toISOString().split('T')[0]
const WEEK_END    = new Date(_weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
const MONTH_START = new Date(_now.getFullYear(), _now.getMonth(), 1).toISOString().split('T')[0]

export default function AdminDashboardPage() {
  const { tutors, validateTutor, suspendTutor, showToast, reloadTutors } = useApp()
  const [activeTab, setActiveTab]     = useState('Vue globale')
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [userFilter, setUserFilter]   = useState('')
  const [parents, setParents]         = useState([])

  // Engagement / session / payment stats
  const [engStats, setEngStats]         = useState({ pending: 0, active: 0, ended: 0 })
  const [sessionStats, setSessionStats] = useState({ upcoming: 0, toConfirm: 0, reported: 0 })
  const [payStats, setPayStats]         = useState({ pendingDecl: 0, confirmed: 0 })
  const [recentEngagements, setRecentEngagements] = useState([])
  const [weekStats, setWeekStats]       = useState({ tutors: 0, parents: 0, engagements: 0, sessions: 0 })
  const [monthSessionCount, setMonthSessionCount] = useState(0)
  const [parentMonthCount, setParentMonthCount]   = useState(0)

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    // Parents
    supabase.from('profiles').select('*').eq('role', 'parent').then(({ data }) => {
      if (data) setParents(data.map(p => ({
        id: p.id, firstName: p.first_name, lastName: p.last_name,
        email: p.email, city: p.city, avatarColor: p.avatar_color, role: 'parent',
      })))
    })

    // Engagement stats
    Promise.all([
      supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('engagements').select('*', { count: 'exact', head: true }).eq('status', 'ended'),
    ]).then(([p, a, e]) => setEngStats({
      pending: p.count || 0, active: a.count || 0, ended: e.count || 0,
    }))

    // Session stats
    Promise.all([
      supabase.from('sessions').select('*', { count: 'exact', head: true })
        .gte('scheduled_date', TODAY).is('parent_report', null),
      supabase.from('sessions').select('*', { count: 'exact', head: true })
        .lt('scheduled_date', TODAY).is('parent_report', null),
      supabase.from('sessions').select('*', { count: 'exact', head: true })
        .not('parent_report', 'is', null),
    ]).then(([up, tc, rp]) => setSessionStats({
      upcoming: up.count || 0, toConfirm: tc.count || 0, reported: rp.count || 0,
    }))

    // Payment stats
    Promise.all([
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'parent_declared'),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ]).then(([pd, c]) => setPayStats({ pendingDecl: pd.count || 0, confirmed: c.count || 0 }))

    // Séances ce mois (filtré par mois en cours)
    supabase.from('sessions').select('*', { count: 'exact', head: true })
      .gte('scheduled_date', MONTH_START)
      .then(({ count }) => setMonthSessionCount(count || 0))

    // Parents inscrits ce mois
    supabase.from('profiles').select('*', { count: 'exact', head: true })
      .eq('role', 'parent').gte('join_date', MONTH_START)
      .then(({ count }) => setParentMonthCount(count || 0))

    // Stats de la semaine courante
    Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tutor').gte('join_date', WEEK_START),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'parent').gte('join_date', WEEK_START),
      supabase.from('engagements').select('*', { count: 'exact', head: true }).gte('created_at', WEEK_START),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('scheduled_date', WEEK_START).lte('scheduled_date', WEEK_END),
    ]).then(([wt, wp, we, ws]) => setWeekStats({
      tutors: wt.count || 0, parents: wp.count || 0,
      engagements: we.count || 0, sessions: ws.count || 0,
    }))

    // Recent engagements (with tutor + parent profiles)
    supabase
      .from('engagements')
      .select('id, status, subject, monthly_rate, start_date, end_date, created_at, parent_id, tutor_id')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(async ({ data: engs }) => {
        if (!engs || engs.length === 0) return
        const allIds = [...new Set([...engs.map(e => e.parent_id), ...engs.map(e => e.tutor_id)])]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_color')
          .in('id', allIds)
        const profileMap = {}
        profiles?.forEach(p => { profileMap[p.id] = { id: p.id, firstName: p.first_name, lastName: p.last_name, avatarColor: p.avatar_color } })
        setRecentEngagements(engs.map(e => ({
          ...e,
          parent: profileMap[e.parent_id],
          tutor:  profileMap[e.tutor_id],
        })))
      })

    // Realtime: reload tutors on changes
    const channel = supabase
      .channel('admin-tutors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutors' }, () => reloadTutors())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [reloadTutors])

  // ── Document viewer ──────────────────────────────────────────
  const viewDocument = useCallback(async (path) => {
    if (!path) return
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
    if (error) { showToast("Impossible d'ouvrir le document.", 'error'); return }
    window.open(data.signedUrl, '_blank')
  }, [showToast])

  // ── Derived ──────────────────────────────────────────────────
  const pending  = tutors.filter(t => t.verificationStatus === 'pending')
  const verified = tutors.filter(t => t.verificationStatus === 'verified')
  const rejected = tutors.filter(t => t.verificationStatus === 'rejected')
  const premiumSubs  = tutors.filter(t => t.subscription?.plan === 'premium'  && t.subscription?.status === 'active')
  const standardSubs = tutors.filter(t => t.subscription?.plan === 'standard' && t.subscription?.status === 'active')
  const activeSubscriptions = tutors.filter(t => t.subscription?.status === 'active' && t.subscription?.plan !== 'gratuit')

  const handleValidate = (tutorId) => validateTutor(tutorId, 'verified')
  const handleReject   = (tutor)   => { setRejectModal(tutor); setRejectReason('') }
  const confirmReject  = () => {
    if (!rejectReason.trim()) { showToast('Veuillez saisir un motif de rejet.', 'error'); return }
    validateTutor(rejectModal.id, 'rejected', rejectReason)
    setRejectModal(null); setRejectReason('')
  }

  const filteredUsers = [...tutors, ...parents].filter(u => {
    const q = userFilter.toLowerCase()
    return !q || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  const totalEngagements = engStats.pending + engStats.active + engStats.ended
  const totalSessions    = sessionStats.upcoming + sessionStats.toConfirm + sessionStats.reported

  const totalMonthlyRevenue = (standardSubs.length * 3000) + (premiumSubs.length * 5000)
  const stats = [
    { label: 'Répétiteurs actifs', value: verified.length,       emoji: '🎓', bg: 'bg-primary-50',   bar: 'bg-primary',   delta: `${tutors.length} inscrits · ${pending.length} en attente`, deltaClass: 'text-gray-400' },
    { label: 'Parents inscrits',   value: parents.length,        emoji: '👨‍👩‍👧', bg: 'bg-secondary-50', bar: 'bg-secondary', delta: parentMonthCount > 0 ? `+${parentMonthCount} ce mois` : '→ stable', deltaClass: parentMonthCount > 0 ? 'text-green-600' : 'text-gray-400' },
    { label: 'Séances ce mois',    value: monthSessionCount,     emoji: '📅', bg: 'bg-blue-50',      bar: 'bg-blue-500',  delta: sessionStats.toConfirm > 0 ? `${sessionStats.toConfirm} à confirmer` : '→ stable', deltaClass: sessionStats.toConfirm > 0 ? 'text-orange-500' : 'text-gray-400' },
    { label: 'CA FCFA (mois)',     value: totalMonthlyRevenue > 0 ? totalMonthlyRevenue.toLocaleString('fr-FR') : '0', emoji: '💰', bg: 'bg-accent-50', bar: 'bg-accent', bigVal: totalMonthlyRevenue >= 100000, delta: `${activeSubscriptions.length} abonnements actifs`, deltaClass: 'text-green-600' },
  ]

  // ── Render ───────────────────────────────────────────────────
  return (
    <DashboardLayout>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Rejeter le dossier</h3>
                <p className="text-sm text-gray-500">{rejectModal.firstName} {rejectModal.lastName}</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motif du rejet *</label>
            <textarea
              className="input-field resize-none h-28"
              placeholder="Expliquez pourquoi le dossier est rejeté..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="btn-outline flex-1">Annuler</button>
              <button onClick={confirmReject} className="flex-1 bg-red-500 text-white font-semibold px-6 py-3 rounded-full hover:bg-red-600 transition-colors">
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-xl font-bold text-gray-900">Administration 🛡️</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              MonRépétiteur · Tableau de bord · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-outline text-sm">Exporter CSV</button>
            <button className="btn-outline text-sm">Paramètres</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="card relative overflow-hidden flex items-center gap-4 py-4 px-4">
              <div className={`absolute top-0 left-0 right-0 h-[3px] ${stat.bar}`} />
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${stat.bg}`}>{stat.emoji}</div>
              <div className="min-w-0">
                <p className={`font-black text-gray-900 tabular-nums leading-none ${stat.bigVal ? 'text-[17px]' : 'text-[22px]'}`}>{stat.value}</p>
                <p className="text-[11px] text-gray-400 mt-1.5 font-semibold leading-tight">{stat.label}</p>
                {stat.delta && <p className={`text-[10px] font-bold mt-1 ${stat.deltaClass}`}>{stat.delta}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Actions requises + Cette semaine */}
        <div className="grid md:grid-cols-2 gap-5 mb-6">
          {/* Actions requises */}
          <div className="card border-orange-200 bg-orange-50/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">⚠️ Actions requises</h2>
              {(pending.length + sessionStats.toConfirm) > 0 && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">{pending.length + sessionStats.toConfirm} urgentes</span>
              )}
            </div>
            {pending.length === 0 && sessionStats.toConfirm === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune action requise ✓</p>
            ) : (
              <div className="space-y-2">
                {pending.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-white border border-orange-200 rounded-xl">
                    <ShieldCheck size={16} className="text-orange-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{pending.length} vérification{pending.length > 1 ? 's' : ''} CNI en attente</p>
                      <p className="text-xs text-gray-400 truncate">{pending.slice(0, 3).map(t => `${t.firstName} ${t.lastName?.[0]}.`).join(', ')}</p>
                    </div>
                    <button onClick={() => setActiveTab('Vérifications')} className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg whitespace-nowrap">Traiter</button>
                  </div>
                )}
                {sessionStats.toConfirm > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-white border border-blue-200 rounded-xl">
                    <Calendar size={16} className="text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{sessionStats.toConfirm} séance{sessionStats.toConfirm > 1 ? 's' : ''} sans rapport</p>
                      <p className="text-xs text-gray-400">En attente de confirmation parent</p>
                    </div>
                    <button onClick={() => setActiveTab('Contrats')} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg whitespace-nowrap">Voir</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cette semaine */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-900 mb-4">📊 Cette semaine</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Répétiteurs', value: `+${weekStats.tutors}`,      bg: 'bg-primary-50',   color: 'text-primary' },
                { label: 'Parents',     value: `+${weekStats.parents}`,     bg: 'bg-secondary-50', color: 'text-secondary' },
                { label: 'Contrats',    value: `+${weekStats.engagements}`, bg: 'bg-green-50',     color: 'text-green-600' },
                { label: 'Séances',     value: `+${weekStats.sessions}`,    bg: 'bg-blue-50',      color: 'text-blue-600' },
              ].map(item => (
                <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
                  <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div className="card mb-6 bg-gradient-to-br from-secondary-50 to-primary-50 border-secondary-100">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 size={18} className="text-secondary" />
            <h2 className="font-semibold text-gray-900">Revenus mensuels simulés</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-primary">{formatFCFA(standardSubs.length * 3000)}</p>
              <p className="text-xs text-gray-500">Plan Standard ({standardSubs.length})</p>
            </div>
            <div>
              <p className="text-xl font-bold text-accent">{formatFCFA(premiumSubs.length * 5000)}</p>
              <p className="text-xs text-gray-500">Plan Premium ({premiumSubs.length})</p>
            </div>
            <div>
              <p className="text-xl font-bold text-secondary">{formatFCFA((standardSubs.length * 3000) + (premiumSubs.length * 5000))}</p>
              <p className="text-xs text-gray-500">Total mensuel</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'Vérifications' && pending.length > 0 && (
                <span className="ml-2 w-5 h-5 bg-primary text-white text-xs rounded-full inline-flex items-center justify-center">{pending.length}</span>
              )}
              {tab === 'Contrats' && sessionStats.toConfirm > 0 && (
                <span className="ml-2 w-5 h-5 bg-orange-500 text-white text-xs rounded-full inline-flex items-center justify-center">{sessionStats.toConfirm}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Vue globale ────────────────────────────────── */}
        {activeTab === 'Vue globale' && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Statuts de vérification</h3>
              <div className="space-y-3">
                {[
                  { label: 'Vérifiés',   value: verified.length,       color: 'bg-green-500' },
                  { label: 'En attente', value: pending.length,        color: 'bg-yellow-400' },
                  { label: 'Rejetés',    value: rejected.length,       color: 'bg-red-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`${item.color} h-3 rounded-full`} style={{ width: `${tutors.length ? (item.value / tutors.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Statuts des abonnements</h3>
              <div className="space-y-3">
                {[
                  { label: 'Premium',  value: premiumSubs.length,                                                    color: 'bg-accent' },
                  { label: 'Standard', value: standardSubs.length,                                                   color: 'bg-primary' },
                  { label: 'Expiré',   value: tutors.filter(t => t.subscription?.status === 'expired').length,       color: 'bg-red-400' },
                  { label: 'Gratuit',  value: tutors.filter(t => !t.subscription?.plan || t.subscription?.plan === 'gratuit').length, color: 'bg-gray-300' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`${item.color} h-3 rounded-full`} style={{ width: `${tutors.length ? (item.value / tutors.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activité des contrats */}
            <div className="card md:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">Activité des contrats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                {[
                  { label: 'Contrats total',  value: totalEngagements,          color: 'text-gray-900' },
                  { label: 'Actifs',          value: engStats.active,           color: 'text-green-600' },
                  { label: 'En attente',      value: engStats.pending,          color: 'text-yellow-600' },
                  { label: 'Terminés',        value: engStats.ended,            color: 'text-gray-500' },
                  { label: 'Séances totales', value: totalSessions,             color: 'text-gray-900' },
                  { label: 'À confirmer',     value: sessionStats.toConfirm,    color: sessionStats.toConfirm > 0 ? 'text-orange-600' : 'text-gray-500' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-4">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Vérifications ──────────────────────────────── */}
        {activeTab === 'Vérifications' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Dossiers en attente ({pending.length})</h3>
            {pending.length === 0 && (
              <div className="card text-center py-12">
                <CheckCircle size={48} className="text-green-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Aucun dossier en attente</p>
                <p className="text-gray-400 text-sm">Tous les dossiers ont été traités !</p>
              </div>
            )}
            {pending.map(tutor => (
              <div key={tutor.id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar user={tutor} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{tutor.firstName} {tutor.lastName}</h4>
                      <StatusBadge status="pending" />
                    </div>
                    <p className="text-sm text-gray-500">{tutor.email} — {tutor.city}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Matières : {tutor.subjects.join(', ')} | Niveaux : {tutor.levels.join(', ')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Inscrit le {formatDateShort(tutor.joinDate)}</p>
                  </div>
                  <div className="flex-shrink-0 min-w-[220px]">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 mb-2">Documents soumis :</p>
                      {!tutor.documents?.idType && !tutor.documents?.cni && !tutor.documents?.cniRecto && !tutor.documents?.passport && (
                        <p className="text-xs text-orange-500 italic">Aucun document soumis.</p>
                      )}
                      {tutor.documents?.idType === 'cni' && (
                        <>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${tutor.documents?.cniRecto ? 'bg-green-400' : 'bg-red-400'}`} />
                              <span className="text-gray-600">CNI — Recto</span>
                            </div>
                            {tutor.documents?.cniRectoPath && (
                              <button onClick={() => viewDocument(tutor.documents.cniRectoPath)} className="flex items-center gap-1 text-primary hover:underline">
                                <ExternalLink size={11} /> Voir
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${tutor.documents?.cniVerso ? 'bg-green-400' : 'bg-red-400'}`} />
                              <span className="text-gray-600">CNI — Verso</span>
                            </div>
                            {tutor.documents?.cniVersoPath && (
                              <button onClick={() => viewDocument(tutor.documents.cniVersoPath)} className="flex items-center gap-1 text-primary hover:underline">
                                <ExternalLink size={11} /> Voir
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      {tutor.documents?.idType === 'passport' && (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${tutor.documents?.passport ? 'bg-green-400' : 'bg-red-400'}`} />
                            <span className="text-gray-600">Passeport</span>
                          </div>
                          {tutor.documents?.passportPath && (
                            <button onClick={() => viewDocument(tutor.documents.passportPath)} className="flex items-center gap-1 text-primary hover:underline">
                              <ExternalLink size={11} /> Voir
                            </button>
                          )}
                        </div>
                      )}
                      {!tutor.documents?.idType && tutor.documents?.cni && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span className="text-gray-600">CNI soumise</span>
                        </div>
                      )}
                      {tutor.documents?.selfiePath && (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-gray-600">Selfie avec pièce</span>
                          </div>
                          <button onClick={() => viewDocument(tutor.documents.selfiePath)} className="flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink size={11} /> Voir
                          </button>
                        </div>
                      )}
                      {(tutor.documents?.diplomes || []).map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                            <span className="text-gray-600 truncate">{d.name || d}</span>
                          </div>
                          {d.path && (
                            <button onClick={() => viewDocument(d.path)} className="flex items-center gap-1 text-primary hover:underline flex-shrink-0">
                              <ExternalLink size={11} /> Voir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => handleReject(tutor)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
                        <XCircle size={15} /> Rejeter
                      </button>
                      <button onClick={() => handleValidate(tutor.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary-600 transition-colors">
                        <CheckCircle size={15} /> Valider
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(verified.length > 0 || rejected.length > 0) && (
              <>
                <h3 className="font-semibold text-gray-700 mt-6">Dossiers traités récemment</h3>
                <div className="space-y-3">
                  {[...verified, ...rejected].slice(0, 5).map(tutor => (
                    <div key={tutor.id} className="card flex items-center gap-4">
                      <Avatar user={tutor} size="md" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{tutor.firstName} {tutor.lastName}</p>
                        <p className="text-xs text-gray-500">{tutor.city} — {tutor.subjects.join(', ')}</p>
                      </div>
                      <StatusBadge status={tutor.verificationStatus} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Utilisateurs ───────────────────────────────── */}
        {activeTab === 'Utilisateurs' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input
                className="bg-transparent flex-1 outline-none text-sm"
                placeholder="Rechercher un utilisateur..."
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              {filteredUsers.map(user => (
                <div key={user.id} className="card flex items-center gap-4">
                  <Avatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800 text-sm">{user.firstName} {user.lastName}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.role === 'tutor' ? 'bg-primary-50 text-primary' : 'bg-secondary-50 text-secondary'}`}>
                        {user.role === 'tutor' ? 'Répétiteur' : 'Parent'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{user.email} — {user.city}</p>
                    {user.role === 'tutor' && (
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={user.verificationStatus} />
                        <StatusBadge status={user.subscription?.status || 'inactive'} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {user.rating > 0 && <StarRating rating={user.rating} count={user.reviewCount} size={12} />}
                    {user.role === 'tutor' && !user.suspended && (
                      <button onClick={() => suspendTutor(user.id)} className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50">
                        Suspendre
                      </button>
                    )}
                    {user.suspended && <span className="text-xs text-red-500 font-medium px-2 py-1">Suspendu</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Abonnements ────────────────────────────────── */}
        {activeTab === 'Abonnements' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { plan: 'Premium',  count: premiumSubs.length,                                                  price: 5000, color: 'accent' },
                { plan: 'Standard', count: standardSubs.length,                                                 price: 3000, color: 'primary' },
                { plan: 'Expiré',   count: tutors.filter(t => t.subscription?.status === 'expired').length,    price: 0,    color: 'gray' },
              ].map(item => (
                <div key={item.plan} className="card text-center">
                  <p className="text-2xl font-bold text-gray-900">{item.count}</p>
                  <p className="text-sm text-gray-500">{item.plan}</p>
                  {item.price > 0 && <p className="text-xs text-gray-400 mt-1">{formatFCFA(item.count * item.price)}/mois</p>}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {tutors.map(tutor => (
                <div key={tutor.id} className="card flex items-center gap-4">
                  <Avatar user={tutor} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{tutor.firstName} {tutor.lastName}</p>
                    <p className="text-xs text-gray-500">{tutor.city}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={tutor.subscription?.status || 'inactive'} />
                    <p className="text-xs text-gray-500 mt-1 capitalize">{tutor.subscription?.plan || 'gratuit'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">
                      {tutor.subscription?.plan === 'premium' ? formatFCFA(5000) : tutor.subscription?.plan === 'standard' ? formatFCFA(3000) : '—'}
                    </p>
                    {tutor.subscription?.endDate && (
                      <p className="text-xs text-gray-400">exp. {formatDateShort(tutor.subscription.endDate)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Contrats ────────────────────────────────────── */}
        {activeTab === 'Contrats' && (
          <div className="space-y-6">
            {/* Synthèse */}
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Engagements */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-primary" /> Contrats
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Actifs',      value: engStats.active,  color: 'bg-green-500' },
                    { label: 'En attente',  value: engStats.pending, color: 'bg-yellow-400' },
                    { label: 'Terminés',    value: engStats.ended,   color: 'bg-gray-300' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">{item.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${item.color} h-2 rounded-full`} style={{ width: `${totalEngagements ? (item.value / totalEngagements) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-5 text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-secondary" /> Séances
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'À venir',       value: sessionStats.upcoming,   color: 'bg-blue-400' },
                    { label: 'À confirmer',   value: sessionStats.toConfirm,  color: sessionStats.toConfirm > 0 ? 'bg-orange-400' : 'bg-gray-200' },
                    { label: 'Confirmées',    value: sessionStats.reported,   color: 'bg-green-400' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">{item.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${item.color} h-2 rounded-full`} style={{ width: `${totalSessions ? (item.value / totalSessions) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-5 text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Paiements */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Wallet size={16} className="text-green-600" /> Paiements
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">En attente de confirmation</span>
                    <span className={`text-sm font-bold ${payStats.pendingDecl > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{payStats.pendingDecl}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Confirmés</span>
                    <span className="text-sm font-bold text-green-600">{payStats.confirmed}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total</span>
                      <span className="text-sm font-bold text-gray-700">{payStats.pendingDecl + payStats.confirmed}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Liste des contrats récents */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Contrats récents</h3>
              {recentEngagements.length === 0 ? (
                <div className="card text-center py-12">
                  <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucun contrat pour l'instant</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEngagements.map(e => (
                    <div key={e.id} className="card flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-800 text-sm">{e.subject}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            e.status === 'active'  ? 'bg-green-100 text-green-700' :
                            e.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {e.status === 'active' ? 'Actif' : e.status === 'pending' ? 'En attente' : 'Terminé'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Parent : {e.parent ? `${e.parent.firstName} ${e.parent.lastName}` : '…'}
                          {' · '}
                          Répétiteur : {e.tutor ? `${e.tutor.firstName} ${e.tutor.lastName}` : '…'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatFCFA(e.monthly_rate)}/mois · {formatDateShort(e.start_date)} → {formatDateShort(e.end_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
