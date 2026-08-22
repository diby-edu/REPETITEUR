'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import Avatar from '../components/common/Avatar'
import { FileText, MessageCircle, CheckCircle, XCircle } from 'lucide-react'
import { formatFCFA, formatDateShort } from '../utils/helpers'
import DashboardLayout from '../components/layout/DashboardLayout'

const TABS = ['Actifs', 'En attente', 'Terminés']

const STATUS = {
  active:  { label: 'Actif',      cls: 'bg-green-100 text-green-700' },
  pending: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
  ended:   { label: 'Terminé',    cls: 'bg-gray-100 text-gray-600' },
}

export default function BookingPage() {
  const { currentUser } = useAuth()
  const { getUserEngagements, loadUserEngagements, getTutor, getParent, endEngagement, respondToEngagement, levelPackages } = useApp()
  const isTutor = currentUser?.role === 'tutor'

  const [activeTab, setActiveTab] = useState('Actifs')
  const [parentCache, setParentCache] = useState({})
  const [endModal, setEndModal] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (currentUser?.id) loadUserEngagements(currentUser.id, currentUser.role)
  }, [currentUser?.id])

  const allEng = getUserEngagements(currentUser.id, currentUser.role)

  // Précharger les profils parents (pour le répétiteur)
  useEffect(() => {
    if (!isTutor) return
    const ids = [...new Set(allEng.map(e => e.parentId))]
    ids.forEach(async (pid) => {
      if (!parentCache[pid]) {
        const p = await getParent(pid)
        if (p) setParentCache(prev => ({ ...prev, [pid]: p }))
      }
    })
  }, [allEng.length, isTutor])

  const byTab = {
    'Actifs': allEng.filter(e => e.status === 'active'),
    'En attente': allEng.filter(e => e.status === 'pending'),
    'Terminés': allEng.filter(e => e.status === 'ended'),
  }
  const displayed = byTab[activeTab] || []

  const other = (e) => isTutor ? parentCache[e.parentId] : getTutor(e.tutorId)
  const levelLabel = (lk) => levelPackages.find(p => p.levelKey === lk)?.label || 'Contrat'

  const endedLabel = (e) => {
    if (e.endedBy === 'system') return 'Terminé (abonnement du répétiteur expiré)'
    if (e.endedBy === 'parent') return 'Terminé par le parent'
    if (e.endedBy === 'tutor') return 'Terminé par le répétiteur'
    return 'Terminé'
  }

  return (
    <DashboardLayout>
    <div className="bg-surface">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">Mes contrats</h1>

        {/* Modale de résiliation */}
        {endModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="font-semibold text-gray-900 mb-2">Mettre fin au contrat ?</h3>
              <p className="text-sm text-gray-500 mb-5">Le contrat sera résilié et l'autre partie en sera informée. Cette action est définitive.</p>
              <div className="flex gap-3">
                <button onClick={() => setEndModal(null)} disabled={busy} className="btn-outline flex-1">Annuler</button>
                <button
                  onClick={async () => { setBusy(true); const ok = await endEngagement(endModal.id, isTutor ? 'tutor' : 'parent'); setBusy(false); if (ok) setEndModal(null) }}
                  disabled={busy}
                  className="flex-1 bg-red-500 text-white font-semibold px-4 py-3 rounded-full hover:bg-red-600 disabled:opacity-60"
                >
                  {busy ? 'Résiliation…' : 'Mettre fin'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Onglets */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab}
              {byTab[tab].length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{byTab[tab].length}</span>
              )}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="card text-center py-16">
            <FileText size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Aucun contrat</p>
            {activeTab === 'Actifs' && !isTutor && (
              <Link href="/recherche" className="btn-primary mt-4 inline-block text-sm">Trouver un répétiteur</Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(e => {
              const o = other(e)
              const st = STATUS[e.status] || STATUS.ended
              return (
                <div key={e.id} className="card">
                  <div className="flex items-start gap-4 mb-3">
                    <Avatar user={o} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{o?.firstName} {o?.lastName}</p>
                          <p className="text-sm text-primary font-medium">{levelLabel(e.levelKey)}{e.subject ? ` · ${e.subject}` : ''}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1 mb-3">
                    <p><strong>{formatFCFA(e.monthlyRate)}</strong>/mois</p>
                    {e.agreedSchedule && <p className="text-gray-500">🗓️ {e.agreedSchedule}</p>}
                    {e.status === 'active' && <p className="text-xs text-gray-400">Période en cours jusqu'au {formatDateShort(e.endDate)}</p>}
                    {e.status === 'pending' && <p className="text-xs text-gray-400">En attente d'acceptation du répétiteur</p>}
                    {e.status === 'ended' && <p className="text-xs text-gray-400">{endedLabel(e)}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                    {isTutor && e.status === 'pending' && (
                      <>
                        <button onClick={() => respondToEngagement(e.id, true)} className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white text-sm font-semibold rounded-full hover:bg-secondary-600 transition-colors">
                          <CheckCircle size={15} /> Accepter
                        </button>
                        <button onClick={() => respondToEngagement(e.id, false)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors">
                          <XCircle size={15} /> Refuser
                        </button>
                      </>
                    )}
                    {e.status === 'active' && (
                      <button onClick={() => setEndModal(e)} className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-full hover:bg-red-50 transition-colors">
                        <XCircle size={15} /> Mettre fin
                      </button>
                    )}
                    <Link href="/messagerie" className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors ml-auto">
                      <MessageCircle size={15} /> Message
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  )
}
