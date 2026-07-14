'use client'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, LEVELS, CITIES } from '../data/constants'
import Avatar from '../components/common/Avatar'
import {
  User, Lock, Bell, Trash2, Save, Eye, EyeOff,
  LogOut, Clock
} from 'lucide-react'
import { useRouter } from 'next/navigation'

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const DAY_LABELS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' }
const TIME_SLOTS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']

const TABS_TUTOR = ['Profil', 'Disponibilités', 'Sécurité', 'Notifications']
const TABS_OTHER = ['Profil', 'Sécurité', 'Notifications']

export default function SettingsPage() {
  const { currentUser, logout, updateCurrentUser } = useAuth()
  const { showToast, updateTutorAvailability, getTutor } = useApp()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Profil')
  const [showPwd, setShowPwd] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pwd, setPwd] = useState({ newPassword: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState('')
  const [pwdDone, setPwdDone] = useState(false)

  // Availability state (for tutors)
  const tutorData = currentUser?.role === 'tutor' ? getTutor(currentUser.id) : null
  const [availability, setAvailability] = useState(() => {
    const base = {}
    DAYS.forEach(d => { base[d] = [] })
    return tutorData?.availability || base
  })

  const toggleSlot = (day, time) => {
    setAvailability(prev => {
      const slots = prev[day] || []
      return {
        ...prev,
        [day]: slots.includes(time) ? slots.filter(t => t !== time) : [...slots, time],
      }
    })
  }

  const handleSaveAvailability = () => {
    updateTutorAvailability(currentUser.id, availability)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwd.newPassword !== pwd.confirm) { setPwdError('Les mots de passe ne correspondent pas.'); return }
    if (pwd.newPassword.length < 6) { setPwdError('Minimum 6 caractères.'); return }
    setPwdLoading(true)
    setPwdError('')
    const { error } = await supabase.auth.updateUser({ password: pwd.newPassword })
    setPwdLoading(false)
    if (error) { setPwdError(error.message); return }
    setPwdDone(true)
    setPwd({ newPassword: '', confirm: '' })
    setTimeout(() => setPwdDone(false), 3000)
  }

  const TABS = currentUser?.role === 'tutor' ? TABS_TUTOR : TABS_OTHER

  const [profile, setProfile] = useState({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    phone: currentUser?.phone || '',
    city: currentUser?.city || '',
    bio: currentUser?.bio || '',
    monthlyRate: currentUser?.monthlyRate || '',
  })

  const [notifications, setNotifications] = useState({
    newMessage: true,
    bookingRequest: true,
    bookingUpdate: true,
    reviewReceived: true,
    subscriptionExpiry: true,
    profileViews: false,
  })

  const handleSaveProfile = (e) => {
    e.preventDefault()
    updateCurrentUser(profile)
    showToast('Profil mis à jour avec succès !')
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleDeleteAccount = () => {
    logout()
    router.push('/')
    showToast('Compte supprimé. À bientôt !', 'info')
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">Paramètres</h1>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar */}
          <div className="sm:w-48 flex-shrink-0">
            <nav className="card p-2">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-primary-50 text-primary'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab === 'Profil' && <User size={16} />}
                  {tab === 'Disponibilités' && <Clock size={16} />}
                  {tab === 'Sécurité' && <Lock size={16} />}
                  {tab === 'Notifications' && <Bell size={16} />}
                  {tab}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button
                  onClick={() => { logout(); router.push('/') }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Déconnexion
                </button>
              </div>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Profile tab */}
            {activeTab === 'Profil' && (
              <div className="card">
                <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
                  <Avatar user={currentUser} size="xl" />
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{currentUser?.firstName} {currentUser?.lastName}</p>
                    <p className="text-gray-500 text-sm">{currentUser?.email}</p>
                    <p className="text-xs text-gray-400 capitalize mt-1">
                      {currentUser?.role === 'tutor' ? 'Répétiteur' : currentUser?.role === 'parent' ? 'Parent' : 'Administrateur'}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                      <input className="input-field" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                      <input className="input-field" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
                    <input type="tel" className="input-field" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
                    <select className="input-field" value={profile.city} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}>
                      <option value="">Sélectionner</option>
                      {CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  {currentUser?.role === 'tutor' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Biographie</label>
                        <textarea
                          className="input-field resize-none h-32"
                          value={profile.bio}
                          onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                          maxLength={600}
                        />
                        <p className="text-xs text-gray-400 mt-1">{profile.bio.length}/600</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarif mensuel (FCFA)</label>
                        <input type="number" className="input-field" value={profile.monthlyRate} onChange={e => setProfile(p => ({ ...p, monthlyRate: e.target.value }))} step="1000" />
                      </div>
                    </>
                  )}

                  <div className="pt-2">
                    <button type="submit" className="btn-primary flex items-center gap-2">
                      <Save size={16} />
                      {saved ? 'Profil mis à jour !' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Availability tab (tutors only) */}
            {activeTab === 'Disponibilités' && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Clock size={18} className="text-primary" />
                  Mes créneaux disponibles
                </h2>
                <p className="text-xs text-gray-400 mb-5">Cliquez sur un créneau pour l'activer ou le désactiver. Les créneaux en orange sont disponibles.</p>

                <div className="overflow-x-auto -mx-2">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr>
                        <th className="pr-3 pb-2 text-left text-gray-400 font-medium w-14">Heure</th>
                        {DAYS.map(d => (
                          <th key={d} className="pb-2 text-center text-gray-600 font-semibold px-1">
                            {DAY_LABELS[d]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map(time => (
                        <tr key={time} className="border-t border-gray-50">
                          <td className="pr-3 py-1 text-gray-400 font-mono">{time}</td>
                          {DAYS.map(day => {
                            const active = (availability[day] || []).includes(time)
                            return (
                              <td key={day} className="px-1 py-1 text-center">
                                <button
                                  onClick={() => toggleSlot(day, time)}
                                  className={`w-full h-7 rounded-lg transition-colors text-xs font-medium ${
                                    active
                                      ? 'bg-primary text-white'
                                      : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                  }`}
                                  title={`${DAY_LABELS[day]} ${time}`}
                                >
                                  {active ? '✓' : ''}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-4 mt-5 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-4 h-4 bg-primary rounded inline-block" />
                    Disponible
                    <span className="w-4 h-4 bg-gray-100 rounded inline-block ml-2" />
                    Non disponible
                  </div>
                  <button onClick={handleSaveAvailability} className="btn-primary ml-auto flex items-center gap-2 text-sm">
                    <Save size={15} />
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* Security tab */}
            {activeTab === 'Sécurité' && (
              <div className="space-y-4">
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-primary" />
                    Changer le mot de passe
                  </h2>
                  <form onSubmit={handlePasswordChange} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
                      <div className="relative">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          className="input-field pr-10"
                          placeholder="••••••••"
                          value={pwd.newPassword}
                          onChange={e => setPwd(p => ({ ...p, newPassword: e.target.value }))}
                          minLength={6}
                          required
                        />
                        <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le nouveau mot de passe</label>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="••••••••"
                        value={pwd.confirm}
                        onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
                        required
                      />
                    </div>
                    {pwdError && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pwdError}</p>}
                    {pwdDone && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Mot de passe mis à jour !</p>}
                    <button type="submit" disabled={pwdLoading} className="btn-primary text-sm flex items-center gap-2">
                      {pwdLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Mettre à jour le mot de passe'}
                    </button>
                  </form>
                </div>

                <div className="card border-red-100 bg-red-50">
                  <h2 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <Trash2 size={18} />
                    Zone de danger
                  </h2>
                  <p className="text-sm text-red-700 mb-4">
                    La suppression de votre compte est irréversible. Toutes vos données seront définitivement effacées.
                  </p>
                  {deleteConfirm ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-red-800">Êtes-vous vraiment sûr ? Cette action est irréversible.</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirm(false)} className="btn-outline text-sm flex-1">Annuler</button>
                        <button onClick={handleDeleteAccount} className="flex-1 bg-red-600 text-white py-2.5 rounded-full text-sm font-semibold hover:bg-red-700">
                          Supprimer définitivement
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(true)} className="text-red-600 border border-red-300 bg-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-50">
                      Supprimer mon compte
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Notifications tab */}
            {activeTab === 'Notifications' && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Préférences de notifications</h2>
                <div className="space-y-4">
                  {[
                    { key: 'newMessage', label: 'Nouveaux messages', desc: 'Soyez notifié quand vous recevez un message' },
                    { key: 'bookingRequest', label: 'Demandes de séance', desc: 'Nouvelles demandes reçues' },
                    { key: 'bookingUpdate', label: 'Mises à jour de réservation', desc: 'Confirmations, annulations, etc.' },
                    { key: 'reviewReceived', label: 'Nouveaux avis', desc: 'Quand un parent laisse un avis sur votre profil' },
                    { key: 'subscriptionExpiry', label: 'Expiration d\'abonnement', desc: 'Rappel 5 jours avant expiration' },
                    { key: 'profileViews', label: 'Vues de profil', desc: 'Statistiques hebdomadaires de votre profil' },
                  ].map(item => (
                    <div key={item.key} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifications(p => ({ ...p, [item.key]: !p[item.key] }))}
                        className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-colors duration-200 ${notifications[item.key] ? 'bg-primary' : 'bg-gray-200'}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifications[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => showToast('Préférences enregistrées !')} className="btn-primary mt-4 text-sm">
                  Enregistrer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
