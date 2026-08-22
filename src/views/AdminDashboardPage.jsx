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
import { formatDateShort, formatFCFA, getDocumentApprovalProgress } from '../utils/helpers'
import DashboardLayout, { useHeaderSlot } from '../components/layout/DashboardLayout'

const TABS = ['Vue globale', 'Vérifications', 'Utilisateurs', 'Abonnements', 'Forfaits', 'Contrats', 'Paiements', 'Avis']
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

const DOC_REVIEW_PILL = {
  approved: { text: 'Approuvé', cls: 'bg-green-100 text-green-700' },
  rejected: { text: 'Rejeté',   cls: 'bg-red-100 text-red-700' },
  pending:  { text: 'En attente', cls: 'bg-gray-100 text-gray-500' },
}

function DocReviewRow({ label, submitted, reviewStatus, reviewReason, onView, onViewSecondary, onApprove, onReject }) {
  const pill = DOC_REVIEW_PILL[reviewStatus] || DOC_REVIEW_PILL.pending
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 px-3 rounded-xl bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${submitted ? 'text-gray-800' : 'text-orange-500 italic'}`}>{label}</span>
          {submitted
            ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pill.cls}`}>{pill.text}</span>
            : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">Non soumis</span>
          }
        </div>
        {reviewStatus === 'rejected' && reviewReason && (
          <p className="text-xs text-red-600 mt-0.5">Motif : {reviewReason}</p>
        )}
        {submitted && (onView || onViewSecondary) && (
          <div className="flex items-center gap-3 mt-1">
            {onView && (
              <button onClick={onView} className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink size={11} /> Voir
              </button>
            )}
            {onViewSecondary && (
              <button onClick={onViewSecondary} className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink size={11} /> Voir verso
              </button>
            )}
          </div>
        )}
      </div>
      {submitted && (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onReject}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              reviewStatus === 'rejected' ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600'
            }`}
          >
            Rejeter
          </button>
          <button
            onClick={onApprove}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              reviewStatus === 'approved' ? 'bg-secondary text-white' : 'bg-secondary/10 text-secondary hover:bg-secondary hover:text-white'
            }`}
          >
            Approuver
          </button>
        </div>
      )}
    </div>
  )
}

function SparklineChart({ data, height = 80 }) {
  if (!data || data.length < 2) return null
  const W = 360, H = height
  const PAD = { top: 8, right: 8, bottom: 28, left: 28 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(...data.map(d => d.total), 1)
  const xStep  = innerW / (data.length - 1)

  const pts = (key) => data.map((d, i) => [
    PAD.left + i * xStep,
    PAD.top + innerH - (d[key] / maxVal) * innerH,
  ])

  const polyline = (points) => points.map(p => p.join(',')).join(' ')
  const area     = (points) => [
    `M ${points[0][0]} ${PAD.top + innerH}`,
    ...points.map(p => `L ${p[0]} ${p[1]}`),
    `L ${points[points.length - 1][0]} ${PAD.top + innerH}`,
    'Z',
  ].join(' ')

  const tutorPts  = pts('tutors')
  const parentPts = pts('parents')
  const totalPts  = pts('total')

  const yTicks = [0, Math.round(maxVal / 2), maxVal]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* Y grid */}
      {yTicks.map((v, i) => {
        const y = PAD.top + innerH - (v / maxVal) * innerH
        return (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="#9ca3af">{v}</text>
          </g>
        )
      })}

      {/* Area fills */}
      <path d={area(totalPts)}  fill="#2D6A4F" fillOpacity={0.06} />
      <path d={area(tutorPts)}  fill="#2D6A4F" fillOpacity={0.12} />
      <path d={area(parentPts)} fill="#3b82f6" fillOpacity={0.10} />

      {/* Lines */}
      <polyline points={polyline(totalPts)}  fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4 2" />
      <polyline points={polyline(tutorPts)}  fill="none" stroke="#2D6A4F" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={polyline(parentPts)} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots on last point */}
      {[{ pts: tutorPts, color: '#2D6A4F' }, { pts: parentPts, color: '#3b82f6' }].map(({ pts: p, color }, ki) => {
        const last = p[p.length - 1]
        return <circle key={ki} cx={last[0]} cy={last[1]} r={3} fill={color} stroke="white" strokeWidth={1.5} />
      })}

      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={PAD.left + i * xStep} y={H - 6} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight="600">
          {d.label}
        </text>
      ))}
    </svg>
  )
}

export default function AdminDashboardPage() {
  const { tutors, reviewDocument, suspendTutor, unsuspendTutor, updateTutorSubscription, showToast, reloadTutors, levelPackages, updateLevelPackage } = useApp()
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
  const [rejectModal, setRejectModal]       = useState(null)
  const [rejectReason, setRejectReason]     = useState('')
  const [approveModal, setApproveModal]     = useState(null)
  const [subModal, setSubModal]             = useState(null)   // activation manuelle d'abonnement
  const [subPlan, setSubPlan]               = useState('standard')
  const [subMonths, setSubMonths]           = useState(1)
  const [subBusy, setSubBusy]               = useState(false)
  const [reopenedId, setReopenedId]         = useState(null)   // dossier traité rouvert pour re-revue
  const [forfaitEdits, setForfaitEdits]     = useState({})     // éditions locales des forfaits
  const [userFilter, setUserFilter]         = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')   // 'all' | 'tutor' | 'parent'
  const [userStatusFilter, setUserStatusFilter] = useState('all') // 'all' | 'verified' | 'pending' | 'rejected'
  const [parents, setParents]               = useState([])

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
  const [period, setPeriod]             = useState('30d')
  const [periodStats, setPeriodStats]   = useState({ tutors: 0, parents: 0, engagements: 0, sessions: 0 })
  const [growthData, setGrowthData]     = useState([])

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

    // Croissance inscriptions — 6 derniers mois
    ;(async () => {
      const now = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
        return { year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString('fr-FR', { month: 'short' }) }
      })
      const firstDay = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`
      const { data: allProfs } = await supabase.from('profiles').select('join_date, role').gte('join_date', firstDay)
      const buckets = months.map(m => ({ label: m.label, tutors: 0, parents: 0, total: 0 }))
      allProfs?.forEach(p => {
        if (!p.join_date) return
        const [y, mo] = p.join_date.split('-').map(Number)
        const idx = months.findIndex(m => m.year === y && m.month === mo)
        if (idx < 0) return
        buckets[idx].total++
        if (p.role === 'tutor')  buckets[idx].tutors++
        if (p.role === 'parent') buckets[idx].parents++
      })
      setGrowthData(buckets)
    })()

    // Realtime: reload tutors on changes
    const channel = supabase
      .channel('admin-tutors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutors' }, () => reloadTutors())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [reloadTutors])

  // ── Period stats (Vue globale selector) ─────────────────────
  useEffect(() => {
    const now = new Date()
    let startDate
    if (period === '7d')  { const d = new Date(now); d.setDate(now.getDate() - 6);           startDate = d.toISOString().split('T')[0] }
    if (period === '30d') { const d = new Date(now); d.setDate(now.getDate() - 29);          startDate = d.toISOString().split('T')[0] }
    if (period === '3m')  { const d = new Date(now); d.setMonth(now.getMonth() - 3);         startDate = d.toISOString().split('T')[0] }
    if (period === '12m') { const d = new Date(now); d.setFullYear(now.getFullYear() - 1);   startDate = d.toISOString().split('T')[0] }
    if (!startDate) return
    Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tutor').gte('join_date', startDate),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'parent').gte('join_date', startDate),
      supabase.from('engagements').select('*', { count: 'exact', head: true }).gte('created_at', startDate),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('scheduled_date', startDate),
    ]).then(([t, p, e, s]) => setPeriodStats({ tutors: t.count || 0, parents: p.count || 0, engagements: e.count || 0, sessions: s.count || 0 }))
  }, [period])

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
  // Dossier traité rouvert pour re-consultation/re-décision (toujours frais).
  const reopenedTutor = reopenedId ? tutors.find(t => t.id === reopenedId) : null
  const dossiersToReview = reopenedTutor && !pending.some(t => t.id === reopenedId)
    ? [reopenedTutor, ...pending]
    : pending
  const premiumSubs  = tutors.filter(t => t.subscription?.plan === 'premium'  && t.subscription?.status === 'active')
  const standardSubs = tutors.filter(t => t.subscription?.plan === 'standard' && t.subscription?.status === 'active')
  const activeSubscriptions = tutors.filter(t => t.subscription?.status === 'active' && t.subscription?.plan !== 'gratuit')

  // Revue individuelle par document — docKey: 'id' | 'selfie' | 'diploma-<index>'
  const openReviewApprove = (tutor, docKey, label) => setApproveModal({ tutor, docKey, label })
  const openReviewReject  = (tutor, docKey, label) => { setRejectModal({ tutor, docKey, label }); setRejectReason('') }
  const confirmValidate = () => {
    reviewDocument(approveModal.tutor.id, approveModal.docKey, 'approved')
    setApproveModal(null)
  }
  const confirmReject  = () => {
    if (!rejectReason.trim()) { showToast('Veuillez saisir un motif de rejet.', 'error'); return }
    reviewDocument(rejectModal.tutor.id, rejectModal.docKey, 'rejected', rejectReason)
    setRejectModal(null); setRejectReason('')
  }

  const filteredUsers = [...tutors, ...parents].filter(u => {
    const q = userFilter.toLowerCase()
    if (q && !`${u.firstName} ${u.lastName}`.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
    if (userStatusFilter !== 'all' && u.role === 'tutor' && u.verificationStatus !== userStatusFilter) return false
    if (userStatusFilter !== 'all' && u.role === 'parent') return false
    return true
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
                <h3 className="font-semibold text-gray-900">Rejeter — {rejectModal.label}</h3>
                <p className="text-sm text-gray-500">{rejectModal.tutor.firstName} {rejectModal.tutor.lastName}</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motif du rejet *</label>
            <textarea
              className="input-field resize-none h-28"
              placeholder="Expliquez pourquoi ce document est rejeté..."
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

      {/* Approve modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle size={20} className="text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Approuver — {approveModal.label}</h3>
                <p className="text-sm text-gray-500">{approveModal.tutor.firstName} {approveModal.tutor.lastName}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Confirmez-vous l'approbation de ce document ? Le répétiteur ne devient visible dans les recherches qu'une fois pièce d'identité, selfie et au moins un diplôme approuvés.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setApproveModal(null)} className="btn-outline flex-1">Annuler</button>
              <button onClick={confirmValidate} className="flex-1 bg-secondary text-white font-semibold px-6 py-3 rounded-full hover:bg-secondary-600 transition-colors">
                Confirmer la validation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activation manuelle d'abonnement (paiement hors ligne) */}
      {subModal && (() => {
        const preview = (() => { const d = new Date(); d.setMonth(d.getMonth() + Number(subMonths)); return d.toISOString().split('T')[0] })()
        const verified = subModal.verificationStatus === 'verified'
        const price = subPlan === 'premium' ? 5000 : 3000
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center">
                  <Wallet size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Activer un abonnement</h3>
                  <p className="text-sm text-gray-500">{subModal.firstName} {subModal.lastName}</p>
                </div>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select className="input-field mb-3" value={subPlan} onChange={e => setSubPlan(e.target.value)}>
                <option value="standard">Standard — 3 000 FCFA/mois</option>
                <option value="premium">Premium — 5 000 FCFA/mois</option>
              </select>

              <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
              <select className="input-field mb-3" value={subMonths} onChange={e => setSubMonths(Number(e.target.value))}>
                <option value={1}>1 mois</option>
                <option value={3}>3 mois</option>
                <option value={6}>6 mois</option>
                <option value={12}>12 mois</option>
              </select>

              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 space-y-1">
                <p>Montant encaissé : <strong>{formatFCFA(price * subMonths)}</strong> ({subMonths} mois)</p>
                <p>Actif jusqu'au : <strong>{formatDateShort(preview)}</strong></p>
              </div>

              {!verified && (
                <p className="mt-3 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                  ⚠️ Ce répétiteur n'est pas encore vérifié : l'abonnement sera enregistré, mais le profil ne deviendra visible dans les recherches qu'une fois le dossier vérifié.
                </p>
              )}

              <div className="flex gap-3 mt-5">
                <button onClick={() => setSubModal(null)} className="btn-outline flex-1" disabled={subBusy}>Annuler</button>
                <button
                  onClick={async () => {
                    setSubBusy(true)
                    const ok = await updateTutorSubscription(subModal.id, subPlan, subMonths)
                    setSubBusy(false)
                    if (ok) setSubModal(null)
                  }}
                  disabled={subBusy}
                  className="flex-1 bg-secondary text-white font-semibold px-6 py-3 rounded-full hover:bg-secondary-600 transition-colors disabled:opacity-60"
                >
                  {subBusy ? 'Activation…' : 'Activer l\'abonnement'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">📊 Activité</h3>
                  <div className="flex gap-1">
                    {[['7d','7j'],['30d','30j'],['3m','3m'],['12m','12m']].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setPeriod(key)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${period === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Nouveaux répét.',   value: `+${periodStats.tutors}`,      bg: 'bg-primary-50',   color: 'text-primary' },
                    { label: 'Nouveaux parents',  value: `+${periodStats.parents}`,     bg: 'bg-blue-50',      color: 'text-blue-600' },
                    { label: 'Nouveaux contrats', value: `+${periodStats.engagements}`, bg: 'bg-green-50',     color: 'text-green-600' },
                    { label: 'Séances planif.',   value: `+${periodStats.sessions}`,    bg: 'bg-purple-50',    color: 'text-purple-600' },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl p-3 text-center`}>
                      <p className={`text-xl font-black ${item.color} tabular-nums`}>{item.value}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-medium leading-tight">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Sparkline — croissance inscriptions 6 mois */}
            {growthData.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} className="text-secondary" />
                    <h3 className="text-sm font-bold text-gray-900">Croissance des inscriptions</h3>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" />Répétiteurs</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />Parents</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />Total</span>
                  </div>
                </div>
                <SparklineChart data={growthData} height={90} />
                <div className="flex justify-between mt-2 pt-2 border-t border-gray-100">
                  {growthData.slice(-3).map((d, i) => (
                    <div key={i} className="text-center">
                      <p className="text-base font-black text-gray-900 tabular-nums">{d.total}</p>
                      <p className="text-[10px] text-gray-400 font-medium capitalize">{d.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Tab: Vérifications ──────────────────────────────── */}
        {activeTab === 'Vérifications' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">Dossiers en attente ({pending.length})</h3>
            {reopenedTutor && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                <p className="text-sm text-blue-700">
                  Dossier rouvert : <strong>{reopenedTutor.firstName} {reopenedTutor.lastName}</strong> — vous pouvez re-consulter et re-statuer chaque pièce.
                </p>
                <button onClick={() => setReopenedId(null)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Fermer</button>
              </div>
            )}
            {dossiersToReview.length === 0 && (
              <div className="card text-center py-12">
                <CheckCircle size={48} className="text-green-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Aucun dossier en attente</p>
                <p className="text-gray-400 text-sm">Tous les dossiers ont été traités !</p>
              </div>
            )}
            {dossiersToReview.map(tutor => {
              const docs = tutor.documents || {}
              const isPassport = docs.idType === 'passport'
              const idSubmitted = isPassport ? !!docs.passport : !!(docs.cniRecto && docs.cniVerso)
              const idLabel = isPassport ? 'Passeport' : 'CNI (recto + verso)'
              const diplomas = docs.diplomes || []
              const progress = getDocumentApprovalProgress(docs)
              return (
                <div key={tutor.id} className="card">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar user={tutor} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{tutor.firstName} {tutor.lastName}</h4>
                        <StatusBadge status={tutor.verificationStatus} />
                      </div>
                      <p className="text-sm text-gray-500">{tutor.email} — {tutor.city}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Matières : {tutor.subjects.join(', ')} | Niveaux : {tutor.levels.join(', ')}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Inscrit le {formatDateShort(tutor.joinDate)}</p>
                    </div>
                    {progress.total > 0 && (
                      <div className="flex-shrink-0 w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Approbation</span>
                          <span className="text-[10px] font-bold text-gray-700 tabular-nums">{progress.pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${progress.rejected > 0 ? 'bg-red-400' : 'bg-secondary'}`}
                            style={{ width: `${progress.pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{progress.approved}/{progress.total} approuvés</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Documents — à approuver ou rejeter individuellement</p>

                    <DocReviewRow
                      label={idLabel}
                      submitted={idSubmitted}
                      reviewStatus={docs.idReview?.status || 'pending'}
                      reviewReason={docs.idReview?.reason}
                      onView={idSubmitted ? () => viewDocument(isPassport ? docs.passportPath : docs.cniRectoPath) : null}
                      onViewSecondary={!isPassport && docs.cniVersoPath ? () => viewDocument(docs.cniVersoPath) : null}
                      onApprove={() => openReviewApprove(tutor, 'id', idLabel)}
                      onReject={() => openReviewReject(tutor, 'id', idLabel)}
                    />

                    <DocReviewRow
                      label="Selfie avec pièce"
                      submitted={!!docs.selfiePath}
                      reviewStatus={docs.selfieReview?.status || 'pending'}
                      reviewReason={docs.selfieReview?.reason}
                      onView={docs.selfiePath ? () => viewDocument(docs.selfiePath) : null}
                      onApprove={() => openReviewApprove(tutor, 'selfie', 'Selfie')}
                      onReject={() => openReviewReject(tutor, 'selfie', 'Selfie')}
                    />

                    {diplomas.length === 0 && (
                      <p className="text-xs text-orange-500 italic py-1 px-3">Aucun diplôme soumis.</p>
                    )}
                    {diplomas.map((d, i) => {
                      const label = d.name || `Diplôme ${i + 1}`
                      return (
                        <DocReviewRow
                          key={i}
                          label={label}
                          submitted={!!d.path}
                          reviewStatus={d.review?.status || 'pending'}
                          reviewReason={d.review?.reason}
                          onView={d.path ? () => viewDocument(d.path) : null}
                          onApprove={() => openReviewApprove(tutor, `diploma-${i}`, label)}
                          onReject={() => openReviewReject(tutor, `diploma-${i}`, label)}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {(verified.length > 0 || rejected.length > 0) && (
              <>
                <h3 className="font-semibold text-gray-700 mt-6">Dossiers traités récemment</h3>
                <div className="space-y-3">
                  {[...verified, ...rejected].slice(0, 5).map(tutor => (
                    <button
                      key={tutor.id}
                      onClick={() => { setReopenedId(tutor.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="w-full text-left card flex items-center gap-4 hover:border-primary hover:shadow-md transition-all"
                    >
                      <Avatar user={tutor} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800">{tutor.firstName} {tutor.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{tutor.city} — {tutor.subjects.join(', ')}</p>
                      </div>
                      <StatusBadge status={tutor.verificationStatus} />
                      <span className="text-xs text-primary font-semibold flex-shrink-0 whitespace-nowrap">Rouvrir →</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Utilisateurs ───────────────────────────────── */}
        {activeTab === 'Utilisateurs' && (
          <div className="space-y-4">
            {/* Barre de recherche */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input
                className="bg-transparent flex-1 outline-none text-sm"
                placeholder="Rechercher un utilisateur..."
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
              />
              {userFilter && (
                <button onClick={() => setUserFilter('')} className="text-gray-400 hover:text-gray-600 text-xs font-medium">✕</button>
              )}
            </div>
            {/* Filtres chips */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 font-semibold self-center">Rôle :</span>
              {[['all', 'Tous'], ['tutor', 'Répétiteurs'], ['parent', 'Parents']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setUserRoleFilter(val); if (val === 'parent') setUserStatusFilter('all') }}
                  className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${userRoleFilter === val ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-600 border-gray-200 hover:border-secondary/40'}`}
                >
                  {label}
                </button>
              ))}
              {userRoleFilter !== 'parent' && (
                <>
                  <span className="text-xs text-gray-500 font-semibold self-center ml-2">Statut :</span>
                  {[['all', 'Tous'], ['verified', 'Vérifiés'], ['pending', 'En attente'], ['rejected', 'Rejetés']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setUserStatusFilter(val)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${userStatusFilter === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'}`}
                    >
                      {label}
                    </button>
                  ))}
                </>
              )}
              <span className="text-xs text-gray-400 self-center ml-auto">{filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}</span>
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
                        {/* Visibilité réelle en recherche (is_active), pas le statut d'abonnement */}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.isActive ? 'Visible' : 'Non visible'}
                        </span>
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
                  <button
                    onClick={() => {
                      setSubPlan(tutor.subscription?.plan && tutor.subscription.plan !== 'gratuit' ? tutor.subscription.plan : 'standard')
                      setSubMonths(1)
                      setSubModal(tutor)
                    }}
                    className="flex-shrink-0 text-xs font-bold text-white bg-secondary hover:bg-secondary-600 px-3 py-2 rounded-xl whitespace-nowrap"
                  >
                    Activer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Forfaits ───────────────────────────────────── */}
        {activeTab === 'Forfaits' && (
          <div className="space-y-3">
            <div className="card bg-blue-50 border-blue-100">
              <p className="text-sm text-blue-800">Forfaits imposés par niveau. Modifie le nombre de séances/semaine, la durée d'une séance et le total mensuel — ces valeurs cadrent les offres des répétiteurs.</p>
            </div>
            {levelPackages.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-sm text-gray-400">Aucun forfait chargé — lance la migration <code>supabase_lot1_forfaits.sql</code>.</p>
              </div>
            ) : levelPackages.map(pkg => {
              const e = forfaitEdits[pkg.levelKey] || {}
              const val = (f) => (e[f] ?? pkg[f])
              const set = (f, v) => setForfaitEdits(p => ({ ...p, [pkg.levelKey]: { ...p[pkg.levelKey], [f]: v } }))
              const dirty = e.sessionsPerWeek != null || e.hoursPerSession != null || e.hoursPerMonth != null
              return (
                <div key={pkg.levelKey} className="card flex flex-wrap items-end gap-4">
                  <div className="w-24 flex-shrink-0">
                    <p className="font-semibold text-gray-800">{pkg.label}</p>
                    <p className="text-xs text-gray-400 capitalize">{pkg.category}</p>
                  </div>
                  <label className="text-xs text-gray-500">Séances/sem.
                    <input type="number" min="1" className="input-field mt-1 w-20" value={val('sessionsPerWeek')} onChange={ev => set('sessionsPerWeek', Number(ev.target.value))} />
                  </label>
                  <label className="text-xs text-gray-500">Heures/séance
                    <input type="number" step="0.5" min="0.5" className="input-field mt-1 w-20" value={val('hoursPerSession')} onChange={ev => set('hoursPerSession', Number(ev.target.value))} />
                  </label>
                  <label className="text-xs text-gray-500">Total h/mois
                    <input type="number" step="1" min="1" className="input-field mt-1 w-20" value={val('hoursPerMonth')} onChange={ev => set('hoursPerMonth', Number(ev.target.value))} />
                  </label>
                  <button
                    disabled={!dirty}
                    onClick={async () => { const ok = await updateLevelPackage(pkg.levelKey, e); if (ok) setForfaitEdits(p => { const n = { ...p }; delete n[pkg.levelKey]; return n }) }}
                    className="btn-primary text-sm px-4 py-2 disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                  <p className="text-[11px] text-gray-400 w-full">{pkg.hasSubjects ? 'Matières choisies par le répétiteur' : 'Aucune matière (niveau global)'}</p>
                </div>
              )
            })}
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
