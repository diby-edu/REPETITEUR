'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Avatar from '../components/common/Avatar'
import { StatusBadge } from '../components/common/Badge'
import StarRating from '../components/common/StarRating'
import {
  Users, GraduationCap, Calendar, TrendingUp, ShieldCheck,
  CheckCircle, XCircle, Eye, AlertTriangle, Search,
  BarChart3, FileText, ExternalLink, Wallet, Star,
} from 'lucide-react'
import { formatDateShort, formatFCFA } from '../utils/helpers'
import DashboardLayout, { useHeaderSlot } from '../components/layout/DashboardLayout'

const TABS = ['Vue globale', 'Vérifications', 'Utilisateurs', 'Abonnements', 'Contrats', 'Paiements', 'Avis']
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

// ── Chart helpers ────────────────────────────────────────────
function DonutChart({ segments, total, label = 'total' }) {
  let cum = 0
  const parts = total > 0
    ? segments.map(s => {
        const pct = (s.value / total) * 100
        const part = `${s.color} ${cum.toFixed(1)}% ${(cum + pct).toFixed(1)}%`
        cum += pct
        return part
      })
    : []
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative flex-shrink-0" style={{ width: 130, height: 130 }}>
        <div
          className="w-full h-full rounded-full"
          style={{ background: total > 0 ? `conic-gradient(${parts.join(', ')}, #f3f4f6 ${cum.toFixed(1)}% 100%)` : '#f3f4f6' }}
        />
        <div className="absolute inset-[19px] rounded-full bg-white shadow-sm flex flex-col items-center justify-center">
          <span className="text-[22px] font-black text-gray-900 leading-none">{total}</span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">{label}</span>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2 min-w-[120px]">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-sm text-gray-600 flex-1">{s.label}</span>
            <span className="text-sm font-bold text-gray-900">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VerticalBars({ bars, height = 128 }) {
  const max = Math.max(...bars.map(b => b.value), 1)
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {bars.map((bar, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <span className="text-xs font-bold text-gray-700 tabular-nums">{bar.value}</span>
          <div className="w-full flex items-end" style={{ height: height - 38 }}>
            <div
              className="w-full rounded-t-lg transition-all duration-700 ease-out"
              style={{ backgroundColor: bar.color, height: `${(bar.value / max) * 100}%`, minHeight: bar.value > 0 ? 3 : 0 }}
            />
          </div>
          <span className="text-[10px] text-gray-500 text-center leading-tight">{bar.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboardPage() {
  const { tutors, validateTutor, suspendTutor, unsuspendTutor, showToast, reloadTutors } = useApp()
  const { setSlot } = useHeaderSlot()
  const searchParams = useSearchParams()
  const router = useRouter()
  // Derive activeTab directly from URL — no state needed, always in sync
  const rawTab = searchParams.get('tab')
  const activeTab = rawTab && TABS.includes(rawTab) ? rawTab : 'Vue globale'
  const switchTab = (tab) => {
    if (tab === 'Vue globale') router.push('/admin')
    else router.push('/admin?tab=' + encodeURIComponent(tab))
  }
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [userFilter, setUserFilter]   = useState('')
  const [parents, setParents]         = useState([])

  // Engagement / session / payment stats
  const [engStats, setEngStats]         = useState({ pending: 0, active: 0, ended: 0 })
  const [sessionStats, setSessionStats] = useState({ upcoming: 0, toConfirm: 0, reported: 0 })
  const [payStats, setPayStats]         = useState({ pendingDecl: 0, confirmed: 0 })
  const [recentEngagements, setRecentEngagements] = useState([])
  const [paymentsList, setPaymentsList] = useState([])
  const [reviewsList, setReviewsList]   = useState([])

  useEffect(() => {
    setSlot(<button className="btn-outline text-sm" onClick={exportCSV}>Exporter CSV</button>)
    return () => setSlot(null)
  }, [])
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

  // ── Load Paiements tab ───────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'Paiements') return
    supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(100)
      .then(async ({ data: pmts }) => {
        if (!pmts?.length) { setPaymentsList([]); return }
        const engIds = [...new Set(pmts.map(p => p.engagement_id).filter(Boolean))]
        const { data: engs } = engIds.length
          ? await supabase.from('engagements').select('id, subject, parent_id, tutor_id, monthly_rate').in('id', engIds)
          : { data: [] }
        const allIds = [...new Set((engs || []).flatMap(e => [e.parent_id, e.tutor_id]).filter(Boolean))]
        const { data: profiles } = allIds.length
          ? await supabase.from('profiles').select('id, first_name, last_name').in('id', allIds)
          : { data: [] }
        const pMap = {}
        profiles?.forEach(p => { pMap[p.id] = `${p.first_name} ${p.last_name}` })
        const eMap = {}
        engs?.forEach(e => { eMap[e.id] = { ...e, parentName: pMap[e.parent_id] || '—', tutorName: pMap[e.tutor_id] || '—' } })
        setPaymentsList(pmts.map(p => ({ ...p, engagement: eMap[p.engagement_id] })))
      })
  }, [activeTab])

  // ── Load Avis tab ────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'Avis') return
    supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(200)
      .then(async ({ data: revs }) => {
        if (!revs?.length) { setReviewsList([]); return }
        const ids = [...new Set([...revs.map(r => r.reviewer_id), ...revs.map(r => r.tutor_id)].filter(Boolean))]
        const { data: profiles } = ids.length
          ? await supabase.from('profiles').select('id, first_name, last_name').in('id', ids)
          : { data: [] }
        const pMap = {}
        profiles?.forEach(p => { pMap[p.id] = `${p.first_name} ${p.last_name}` })
        setReviewsList(revs.map(r => ({ ...r, reviewerName: pMap[r.reviewer_id] || '—', tutorName: pMap[r.tutor_id] || '—' })))
      })
  }, [activeTab])

  // ── CSV Export ───────────────────────────────────────────────
  const exportCSV = async () => {
    showToast('Génération du CSV…', 'info')
    const [{ data: engs }, { data: profs }, { data: subs }] = await Promise.all([
      supabase.from('engagements').select('id, status, subject, monthly_rate, start_date, end_date, created_at, parent_id, tutor_id'),
      supabase.from('profiles').select('id, first_name, last_name, email, role, city, join_date'),
      supabase.from('tutors').select('id, subscription_plan, subscription_status, rating, is_active, verification_status'),
    ])
    const profileMap = {}
    profs?.forEach(p => { profileMap[p.id] = p })
    const subMap = {}
    subs?.forEach(s => { subMap[s.id] = s })

    const rows = [
      ['ID contrat', 'Statut', 'Matière', 'Tarif mensuel (FCFA)', 'Début', 'Fin', 'Parent', 'Email parent', 'Répétiteur', 'Email répétiteur', 'Ville', 'Créé le'],
      ...(engs || []).map(e => {
        const parent = profileMap[e.parent_id]
        const tutor  = profileMap[e.tutor_id]
        return [
          e.id, e.status, e.subject, e.monthly_rate,
          e.start_date, e.end_date,
          parent ? `${parent.first_name} ${parent.last_name}` : '',
          parent?.email || '',
          tutor  ? `${tutor.first_name} ${tutor.last_name}`  : '',
          tutor?.email || '',
          parent?.city || tutor?.city || '',
          e.created_at?.slice(0, 10),
        ]
      }),
    ]

    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: `monrepetiteur_contrats_${new Date().toISOString().slice(0,10)}.csv` })
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV téléchargé.', 'success')
  }

  const deleteReview = async (reviewId) => {
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
    if (!error) {
      setReviewsList(prev => prev.filter(r => r.id !== reviewId))
      showToast('Avis supprimé.', 'success')
    }
  }

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

      <div className="max-w-5xl mx-auto px-6 py-6">
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Contextual page header — changes with active module */}
        <div className="mb-6">
          <h1 className="font-display text-xl font-bold text-gray-900">
            {activeTab === 'Vue globale' ? 'Administration 🛡️' : activeTab}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            MonRépétiteur · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* ── Tab: Vue globale ────────────────────────────────── */}
        {activeTab === 'Vue globale' && (
          <div key="vue-globale" className="space-y-5" style={{ animation: 'fadeUp .3s ease-out' }}>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Répétiteurs actifs', value: verified.length, icon: GraduationCap, color: '#2D6A4F', bg: '#f0fdf4', delta: weekStats.tutors > 0 ? `↑ +${weekStats.tutors} cette semaine` : '→ stable', pos: weekStats.tutors > 0 },
                { label: 'Parents inscrits',   value: parents.length,  icon: Users,         color: '#3b82f6', bg: '#eff6ff', delta: parentMonthCount > 0 ? `↑ +${parentMonthCount} ce mois` : '→ stable', pos: parentMonthCount > 0 },
                { label: 'Contrats actifs',    value: engStats.active, icon: FileText,      color: '#E87722', bg: '#fff7ed', delta: engStats.pending > 0 ? `${engStats.pending} en attente` : '→ stable', pos: false },
                { label: 'CA mensuel (FCFA)',  value: totalMonthlyRevenue > 0 ? formatFCFA(totalMonthlyRevenue) : '0', icon: Wallet, color: '#F4A61D', bg: '#fffbeb', delta: `${activeSubscriptions.length} abonnements actifs`, pos: activeSubscriptions.length > 0, big: totalMonthlyRevenue >= 100000 },
              ].map((kpi, i) => (
                <div key={i} className="card py-4 px-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-[inherit]" style={{ backgroundColor: kpi.color }} />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: kpi.bg }}>
                    <kpi.icon size={18} style={{ color: kpi.color }} />
                  </div>
                  <p className={`font-black text-gray-900 tabular-nums leading-none ${kpi.big ? 'text-[17px]' : 'text-[26px]'}`}>{kpi.value}</p>
                  <p className="text-[11px] text-gray-500 font-semibold mt-1.5 leading-tight">{kpi.label}</p>
                  <p className={`text-[10px] font-bold mt-1.5 ${kpi.pos ? 'text-green-500' : 'text-gray-400'}`}>{kpi.delta}</p>
                </div>
              ))}
            </div>

            {/* Charts row: bar + donut */}
            <div className="grid md:grid-cols-5 gap-5">
              {/* Abonnements par plan — bar chart */}
              <div className="card md:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Abonnements par plan</h3>
                  <span className="text-xs text-gray-400 font-medium">{tutors.length} répétiteurs</span>
                </div>
                <VerticalBars bars={[
                  { label: 'Gratuit',   value: tutors.filter(t => !t.subscription?.plan || t.subscription?.plan === 'gratuit').length, color: '#d1d5db' },
                  { label: 'Standard',  value: standardSubs.length,   color: '#E87722' },
                  { label: 'Premium',   value: premiumSubs.length,    color: '#F4A61D' },
                  { label: 'Expiré',    value: tutors.filter(t => t.subscription?.status === 'expired').length, color: '#fca5a5' },
                ]} height={140} />
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">CA simulé ce mois</span>
                  <span className="text-sm font-black text-secondary">{formatFCFA(totalMonthlyRevenue)}</span>
                </div>
              </div>

              {/* Vérifications — donut */}
              <div className="card md:col-span-2 flex flex-col">
                <h3 className="font-semibold text-gray-900 mb-4">Vérification répétiteurs</h3>
                <div className="flex-1 flex items-center">
                  <DonutChart
                    segments={[
                      { label: 'Vérifiés',   value: verified.length, color: '#22c55e' },
                      { label: 'En attente', value: pending.length,  color: '#f59e0b' },
                      { label: 'Rejetés',    value: rejected.length, color: '#ef4444' },
                    ]}
                    total={tutors.length}
                    label="répétiteurs"
                  />
                </div>
                {pending.length > 0 && (
                  <button onClick={() => switchTab('Vérifications')} className="mt-3 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-lg w-full transition-colors">
                    Traiter {pending.length} dossier{pending.length > 1 ? 's' : ''} en attente
                  </button>
                )}
              </div>
            </div>

            {/* Engagements + Actions requises */}
            <div className="grid md:grid-cols-5 gap-5">
              {/* Engagements — horizontal bars + sessions mini */}
              <div className="card md:col-span-3">
                <h3 className="font-semibold text-gray-900 mb-4">Activité des contrats</h3>
                <div className="space-y-3 mb-4">
                  {[
                    { label: 'Actifs',      value: engStats.active,  total: totalEngagements, color: '#22c55e' },
                    { label: 'En attente',  value: engStats.pending, total: totalEngagements, color: '#f59e0b' },
                    { label: 'Terminés',    value: engStats.ended,   total: totalEngagements, color: '#d1d5db' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-24 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full transition-all duration-700"
                          style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 w-5 text-right tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 text-center">
                  {[
                    { label: 'Séances à venir',  value: sessionStats.upcoming,  color: 'text-blue-600' },
                    { label: 'À confirmer',       value: sessionStats.toConfirm, color: sessionStats.toConfirm > 0 ? 'text-orange-500' : 'text-gray-900' },
                    { label: 'Cette semaine',     value: weekStats.sessions,     color: 'text-green-600' },
                  ].map(s => (
                    <div key={s.label}>
                      <p className={`text-2xl font-black ${s.color} tabular-nums`}>{s.value}</p>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions requises */}
              <div className="card md:col-span-2 border-orange-200 bg-orange-50/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">⚠️ Actions requises</h3>
                  {(pending.length + sessionStats.toConfirm) > 0 && (
                    <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">{pending.length + sessionStats.toConfirm}</span>
                  )}
                </div>
                {pending.length === 0 && sessionStats.toConfirm === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-2xl mb-1">✓</p>
                    <p className="text-sm text-gray-400">Tout est traité</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pending.length > 0 && (
                      <div className="flex items-center gap-2.5 p-2.5 bg-white border border-orange-200 rounded-xl">
                        <ShieldCheck size={15} className="text-orange-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900">{pending.length} CNI en attente</p>
                          <p className="text-[10px] text-gray-400 truncate">{pending.slice(0, 2).map(t => `${t.firstName} ${t.lastName?.[0]}.`).join(', ')}</p>
                        </div>
                        <button onClick={() => switchTab('Vérifications')} className="text-[10px] font-bold text-white bg-orange-500 hover:bg-orange-600 px-2 py-1 rounded-lg whitespace-nowrap">Traiter</button>
                      </div>
                    )}
                    {sessionStats.toConfirm > 0 && (
                      <div className="flex items-center gap-2.5 p-2.5 bg-white border border-blue-200 rounded-xl">
                        <Calendar size={15} className="text-blue-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900">{sessionStats.toConfirm} séance{sessionStats.toConfirm > 1 ? 's' : ''} sans rapport</p>
                          <p className="text-[10px] text-gray-400">Confirmation parent requise</p>
                        </div>
                        <button onClick={() => switchTab('Contrats')} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg whitespace-nowrap">Voir</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue + Cette semaine */}
            <div className="grid md:grid-cols-2 gap-5">
              <div className="card bg-gradient-to-br from-secondary-50 to-primary-50 border-secondary-100">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-secondary" />
                  <h3 className="font-semibold text-gray-900 text-sm">Revenus mensuels simulés</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-lg font-black text-primary tabular-nums">{formatFCFA(standardSubs.length * 3000)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Standard ({standardSubs.length})</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-lg font-black text-accent tabular-nums">{formatFCFA(premiumSubs.length * 5000)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Premium ({premiumSubs.length})</p>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3">
                    <p className="text-lg font-black text-secondary tabular-nums">{formatFCFA(totalMonthlyRevenue)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Total</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-sm font-bold text-gray-900 mb-3">📊 Cette semaine</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Nouveaux répét.',   value: `+${weekStats.tutors}`,      bg: 'bg-primary-50',   color: 'text-primary' },
                    { label: 'Nouveaux parents',  value: `+${weekStats.parents}`,     bg: 'bg-blue-50',      color: 'text-blue-600' },
                    { label: 'Nouveaux contrats', value: `+${weekStats.engagements}`, bg: 'bg-green-50',     color: 'text-green-600' },
                    { label: 'Séances planif.',   value: `+${weekStats.sessions}`,    bg: 'bg-purple-50',    color: 'text-purple-600' },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl p-3 text-center`}>
                      <p className={`text-xl font-black ${item.color} tabular-nums`}>{item.value}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-medium leading-tight">{item.label}</p>
                    </div>
                  ))}
                </div>
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
                    {user.role === 'tutor' && user.suspended && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-500 font-semibold">Suspendu</span>
                        <button onClick={() => unsuspendTutor(user.id)} className="text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1 rounded-lg hover:bg-green-50">
                          Réactiver
                        </button>
                      </div>
                    )}
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

        {/* ── Tab: Paiements ──────────────────────────────────── */}
        {activeTab === 'Paiements' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Déclarations de paiement ({paymentsList.length})</h3>
              {payStats.pendingDecl > 0 && (
                <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
                  {payStats.pendingDecl} en attente de confirmation
                </span>
              )}
            </div>
            {paymentsList.length === 0 ? (
              <div className="card text-center py-12">
                <Wallet size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucune déclaration de paiement</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentsList.map(p => (
                  <div key={p.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-800 text-sm">
                          {p.engagement?.subject || 'Matière inconnue'}
                        </p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          p.status === 'confirmed'       ? 'bg-green-100 text-green-700' :
                          p.status === 'parent_declared' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {p.status === 'confirmed' ? 'Confirmé' : p.status === 'parent_declared' ? 'En attente' : p.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Parent : {p.engagement?.parentName} · Répétiteur : {p.engagement?.tutorName}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatFCFA(p.amount || p.engagement?.monthly_rate || 0)} · {p.payment_method || '—'} · {formatDateShort(p.created_at)}
                      </p>
                    </div>
                    {p.status === 'parent_declared' && (
                      <button
                        onClick={async () => {
                          const { error } = await supabase.from('payments').update({ status: 'confirmed' }).eq('id', p.id)
                          if (!error) {
                            setPaymentsList(prev => prev.map(x => x.id === p.id ? { ...x, status: 'confirmed' } : x))
                            showToast('Paiement confirmé.', 'success')
                          }
                        }}
                        className="flex-shrink-0 text-xs font-bold text-white bg-green-500 hover:bg-green-600 px-4 py-2 rounded-xl whitespace-nowrap"
                      >
                        Confirmer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Avis ───────────────────────────────────────── */}
        {activeTab === 'Avis' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Avis des parents ({reviewsList.length})</h3>
            </div>
            {reviewsList.length === 0 ? (
              <div className="card text-center py-12">
                <Star size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucun avis pour l'instant</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviewsList.map(r => (
                  <div key={r.id} className="card flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-gray-800 text-sm">{r.reviewerName}</p>
                        <span className="text-gray-400 text-xs">→</span>
                        <p className="text-sm text-primary font-medium">{r.tutorName}</p>
                        <div className="flex">
                          {[1,2,3,4,5].map(n => (
                            <span key={n} className={`text-sm ${n <= r.rating ? 'text-accent' : 'text-gray-200'}`}>★</span>
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="text-sm text-gray-600 italic">"{r.comment}"</p>}
                      <p className="text-xs text-gray-400 mt-1">{formatDateShort(r.created_at)}</p>
                    </div>
                    <button
                      onClick={() => deleteReview(r.id)}
                      className="flex-shrink-0 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg whitespace-nowrap"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
