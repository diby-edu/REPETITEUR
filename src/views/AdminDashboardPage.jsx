'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Avatar from '../components/common/Avatar'
import { StatusBadge } from '../components/common/Badge'
import StarRating from '../components/common/StarRating'
import {
  Users, GraduationCap, Calendar, TrendingUp, ShieldCheck,
  CheckCircle, XCircle, Eye, Trash2, AlertTriangle, Search,
  Filter, BarChart3, FileText, ExternalLink,
} from 'lucide-react'
import { formatDateShort, formatFCFA } from '../utils/helpers'

const TABS = ['Vue globale', 'Vérifications', 'Utilisateurs', 'Abonnements']

export default function AdminDashboardPage() {
  const { tutors, validateTutor, suspendTutor, showToast, reloadTutors } = useApp()
  const [activeTab, setActiveTab] = useState('Vue globale')
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [parents, setParents] = useState([])
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'parent').then(({ data }) => {
      if (data) setParents(data.map(p => ({
        id: p.id, firstName: p.first_name, lastName: p.last_name,
        email: p.email, city: p.city, avatarColor: p.avatar_color, role: 'parent',
      })))
    })
    supabase.from('bookings').select('*').then(({ data }) => {
      if (data) setBookings(data.map(b => ({ ...b, status: b.status })))
    })

    const channel = supabase
      .channel('admin-tutors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutors' }, () => {
        reloadTutors()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [reloadTutors])

  const viewDocument = useCallback(async (path) => {
    if (!path) return
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
    if (error) { showToast('Impossible d\'ouvrir le document.', 'error'); return }
    window.open(data.signedUrl, '_blank')
  }, [showToast])

  const pending = tutors.filter(t => t.verificationStatus === 'pending')
  const verified = tutors.filter(t => t.verificationStatus === 'verified')
  const rejected = tutors.filter(t => t.verificationStatus === 'rejected')
  const activeSubscriptions = tutors.filter(t => t.subscription?.status === 'active' && t.subscription?.plan !== 'gratuit')
  const premiumSubs = tutors.filter(t => t.subscription?.plan === 'premium' && t.subscription?.status === 'active')
  const standardSubs = tutors.filter(t => t.subscription?.plan === 'standard' && t.subscription?.status === 'active')
  const completedBookings = bookings.filter(b => b.status === 'completed')

  const handleValidate = (tutorId) => {
    validateTutor(tutorId, 'verified')
  }

  const handleReject = (tutor) => {
    setRejectModal(tutor)
    setRejectReason('')
  }

  const confirmReject = () => {
    if (!rejectReason.trim()) { showToast('Veuillez saisir un motif de rejet.', 'error'); return }
    validateTutor(rejectModal.id, 'rejected', rejectReason)
    setRejectModal(null)
    setRejectReason('')
  }

  const filteredUsers = [...tutors, ...parents].filter(u => {
    const q = userFilter.toLowerCase()
    return !q || `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const stats = [
    { label: 'Répétiteurs inscrits', value: tutors.length, icon: <GraduationCap size={20} />, color: 'bg-primary-50 text-primary', sub: `${verified.length} vérifiés` },
    { label: 'Parents inscrits', value: parents.length, icon: <Users size={20} />, color: 'bg-secondary-50 text-secondary', sub: 'Accès gratuit' },
    { label: 'Séances complétées', value: completedBookings.length, icon: <Calendar size={20} />, color: 'bg-green-50 text-green-600', sub: 'Total plateforme' },
    { label: 'Abonnements actifs', value: activeSubscriptions.length, icon: <TrendingUp size={20} />, color: 'bg-accent-50 text-accent', sub: `${premiumSubs.length} Premium` },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Tableau de bord Admin</h1>
            <p className="text-gray-500 text-sm mt-1">MonRépétiteur — Administration</p>
          </div>
          {pending.length > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-xl text-sm font-medium">
              <AlertTriangle size={16} />
              {pending.length} dossier{pending.length > 1 ? 's' : ''} en attente
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <div key={i} className="card">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue simulation */}
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
                <span className="ml-2 w-5 h-5 bg-primary text-white text-xs rounded-full inline-flex items-center justify-center">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Vue globale */}
        {activeTab === 'Vue globale' && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Statuts de vérification</h3>
              <div className="space-y-3">
                {[
                  { label: 'Vérifiés', value: verified.length, color: 'bg-green-500' },
                  { label: 'En attente', value: pending.length, color: 'bg-yellow-400' },
                  { label: 'Rejetés', value: rejected.length, color: 'bg-red-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`${item.color} h-3 rounded-full transition-all`} style={{ width: `${tutors.length ? (item.value / tutors.length) * 100 : 0}%` }} />
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
                  { label: 'Premium', value: premiumSubs.length, color: 'bg-accent' },
                  { label: 'Standard', value: standardSubs.length, color: 'bg-primary' },
                  { label: 'Expiré', value: tutors.filter(t => t.subscription?.status === 'expired').length, color: 'bg-red-400' },
                  { label: 'Gratuit', value: tutors.filter(t => t.subscription?.plan === 'gratuit').length, color: 'bg-gray-300' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`${item.color} h-3 rounded-full transition-all`} style={{ width: `${tutors.length ? (item.value / tutors.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-6 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card md:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">Activité des réservations</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {[
                  { label: 'Total', value: bookings.length, color: 'text-gray-900' },
                  { label: 'En attente', value: bookings.filter(b => b.status === 'pending').length, color: 'text-yellow-600' },
                  { label: 'Confirmées', value: bookings.filter(b => b.status === 'confirmed').length, color: 'text-blue-600' },
                  { label: 'Terminées', value: completedBookings.length, color: 'text-green-600' },
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

        {/* Tab: Vérifications */}
        {activeTab === 'Vérifications' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700">
              Dossiers en attente ({pending.length})
            </h3>
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
                  <div className="flex-shrink-0 min-w-[200px]">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 mb-2">Documents soumis :</p>
                      {/* Pièce d'identité */}
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
                      {/* Legacy: anciens comptes sans idType */}
                      {!tutor.documents?.idType && tutor.documents?.cni && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span className="text-gray-600">CNI soumise</span>
                        </div>
                      )}
                      {/* Selfie */}
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
                      {/* Diplômes */}
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
                      <button
                        onClick={() => handleReject(tutor)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                      >
                        <XCircle size={15} /> Rejeter
                      </button>
                      <button
                        onClick={() => handleValidate(tutor.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-secondary-600 transition-colors"
                      >
                        <CheckCircle size={15} /> Valider
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Recently processed */}
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

        {/* Tab: Utilisateurs */}
        {activeTab === 'Utilisateurs' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                  className="bg-transparent flex-1 outline-none text-sm"
                  placeholder="Rechercher un utilisateur..."
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                />
              </div>
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
                      <button
                        onClick={() => suspendTutor(user.id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Suspendre
                      </button>
                    )}
                    {user.suspended && (
                      <span className="text-xs text-red-500 font-medium px-2 py-1">Suspendu</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Abonnements */}
        {activeTab === 'Abonnements' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { plan: 'Premium', count: premiumSubs.length, price: 5000, color: 'accent' },
                { plan: 'Standard', count: standardSubs.length, price: 3000, color: 'primary' },
                { plan: 'Expiré', count: tutors.filter(t => t.subscription?.status === 'expired').length, price: 0, color: 'gray' },
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
                      {tutor.subscription?.plan === 'premium' ? formatFCFA(5000) :
                       tutor.subscription?.plan === 'standard' ? formatFCFA(3000) : '—'}
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
      </div>
    </div>
  )
}
