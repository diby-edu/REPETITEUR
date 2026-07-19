'use client'
import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { CITIES, LEVELS } from '../data/constants'
import Avatar from '../components/common/Avatar'
import {
  User, Lock, Bell, Trash2, Save, Eye, EyeOff,
  LogOut, Clock, FileText, Camera, RefreshCw, Plus, Upload,
  CheckCircle, AlertCircle, UserX,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const DAY_LABELS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' }
const TIME_SLOTS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']

const TABS_TUTOR = ['Profil', 'Documents', 'Disponibilités', 'Sécurité', 'Notifications']
const TABS_OTHER = ['Profil', 'Sécurité', 'Notifications']
const ROLE_LABELS = { tutor: 'Répétiteur', parent: 'Parent', admin: 'Admin' }

function DocUploadZone({ file, onFile, inputRef, label }) {
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={e => onFile(e.target.files?.[0] || null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
          file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'
        }`}
      >
        {file ? (
          <>
            <CheckCircle size={20} className="text-green-500" />
            <span className="text-xs font-medium text-green-700 text-center break-all">{file.name}</span>
            <span className="text-xs text-gray-400">Cliquer pour changer</span>
          </>
        ) : (
          <>
            <Upload size={20} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
            <span className="text-xs text-gray-400">JPG, PNG ou PDF — 5 Mo max</span>
          </>
        )}
      </button>
    </>
  )
}

export default function SettingsPage() {
  const { currentUser, logout, updateCurrentUser, refreshCurrentUser } = useAuth()
  const { showToast, updateTutorAvailability, getTutor } = useApp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TABS_TUTOR.includes(tabParam) ? tabParam : 'Profil'
  )
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

  // ── Document upload state (tutors only) ──────────────────────
  const existingDocs = currentUser?.documents || {}
  const [docIdType, setDocIdType] = useState(existingDocs.idType || 'cni')
  const [docCniRecto, setDocCniRecto] = useState(null)
  const [docCniVerso, setDocCniVerso] = useState(null)
  const [docPassport, setDocPassport] = useState(null)
  const [docDiplomas, setDocDiplomas] = useState([{ name: '', file: null }])
  const [docSelfieDataUrl, setDocSelfieDataUrl] = useState(null)
  const [docCameraActive, setDocCameraActive] = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [docDone, setDocDone] = useState(false)
  const [docError, setDocError] = useState('')

  const docVideoRef = useRef(null)
  const docCanvasRef = useRef(null)
  const docStreamRef = useRef(null)
  const docCniRectoRef = useRef(null)
  const docCniVersoRef = useRef(null)
  const docPassportRef = useRef(null)

  const startDocCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      docStreamRef.current = stream
      if (docVideoRef.current) docVideoRef.current.srcObject = stream
      setDocCameraActive(true)
    } catch {
      showToast('Impossible d\'activer la caméra. Vérifiez les autorisations.', 'error')
    }
  }

  const captureDocPhoto = () => {
    const canvas = docCanvasRef.current
    const video = docVideoRef.current
    if (!canvas || !video) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    setDocSelfieDataUrl(canvas.toDataURL('image/jpeg', 0.85))
    stopDocCamera()
  }

  const stopDocCamera = () => {
    if (docStreamRef.current) docStreamRef.current.getTracks().forEach(t => t.stop())
    docStreamRef.current = null
    setDocCameraActive(false)
  }

  const retakeDocPhoto = () => {
    setDocSelfieDataUrl(null)
    startDocCamera()
  }

  const handleUploadDocuments = async () => {
    if (!currentUser?.id) return
    setDocUploading(true)
    setDocError('')
    const userId = currentUser.id
    const documents = { ...existingDocs, idType: docIdType }
    let hasNewContent = false

    if (docIdType === 'cni') {
      if (docCniRecto) {
        const ext = docCniRecto.name.split('.').pop()
        const { error } = await supabase.storage.from('documents').upload(`${userId}/cni_recto.${ext}`, docCniRecto, { upsert: true })
        if (!error) { documents.cniRecto = true; documents.cniRectoPath = `${userId}/cni_recto.${ext}`; hasNewContent = true }
        else setDocError(`Erreur upload CNI recto : ${error.message}`)
      }
      if (docCniVerso) {
        const ext = docCniVerso.name.split('.').pop()
        const { error } = await supabase.storage.from('documents').upload(`${userId}/cni_verso.${ext}`, docCniVerso, { upsert: true })
        if (!error) { documents.cniVerso = true; documents.cniVersoPath = `${userId}/cni_verso.${ext}`; hasNewContent = true }
        else setDocError(`Erreur upload CNI verso : ${error.message}`)
      }
    } else if (docPassport) {
      const ext = docPassport.name.split('.').pop()
      const { error } = await supabase.storage.from('documents').upload(`${userId}/passport.${ext}`, docPassport, { upsert: true })
      if (!error) { documents.passport = true; documents.passportPath = `${userId}/passport.${ext}`; hasNewContent = true }
      else setDocError(`Erreur upload passeport : ${error.message}`)
    }

    const existingDiplomas = documents.diplomes || []
    const newDiplomas = []
    for (let i = 0; i < docDiplomas.length; i++) {
      const d = docDiplomas[i]
      if (!d.file || !d.name.trim()) continue
      const ext = d.file.name.split('.').pop()
      const path = `${userId}/diplome_${Date.now()}_${i}.${ext}`
      const { error } = await supabase.storage.from('documents').upload(path, d.file, { upsert: true })
      if (!error) { newDiplomas.push({ name: d.name.trim(), path }); hasNewContent = true }
    }
    documents.diplomes = [...existingDiplomas, ...newDiplomas]

    if (docSelfieDataUrl) {
      try {
        const res = await fetch(docSelfieDataUrl)
        const blob = await res.blob()
        const { error } = await supabase.storage.from('documents').upload(`${userId}/selfie.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })
        if (!error) { documents.selfiePath = `${userId}/selfie.jpg`; hasNewContent = true }
      } catch { /* non-bloquant */ }
    }

    if (!hasNewContent) {
      setDocUploading(false)
      setDocError('Aucun fichier sélectionné.')
      return
    }

    const { error: dbErr } = await supabase.from('tutors').update({ documents, verification_status: 'pending' }).eq('id', userId)
    if (dbErr) {
      setDocError(`Erreur base de données : ${dbErr.message}`)
      setDocUploading(false)
      return
    }

    await refreshCurrentUser()
    setDocUploading(false)
    setDocDone(true)
    setDocCniRecto(null); setDocCniVerso(null); setDocPassport(null)
    setDocDiplomas([{ name: '', file: null }]); setDocSelfieDataUrl(null)
    showToast('Documents soumis — en attente de vérification admin.')
    setTimeout(() => setDocDone(false), 5000)
  }

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
    childLevels: currentUser?.childLevels || [],
    openToContact: currentUser?.openToContact !== false,
  })

  const toggleProfileLevel = (l) =>
    setProfile(prev => ({
      ...prev,
      childLevels: prev.childLevels.includes(l)
        ? prev.childLevels.filter(x => x !== l)
        : [...prev.childLevels, l],
    }))

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

  const docs = currentUser?.documents || {}
  const hasId = !!(docs.cniRecto || docs.passport || docs.cni)
  const hasSelfie = !!docs.selfiePath
  const diplomaCount = docs.diplomes?.length || 0

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">Paramètres</h1>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar */}
          <div className="sm:w-48 flex-shrink-0">
            <nav className="card p-2">
              {TABS.map(tab => {
                const iconMap = {
                  Profil: <User size={16} />,
                  Documents: (
                    <span className="relative inline-flex">
                      <FileText size={16} />
                      {!hasId && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" />}
                    </span>
                  ),
                  Disponibilités: <Clock size={16} />,
                  Sécurité: <Lock size={16} />,
                  Notifications: <Bell size={16} />,
                }
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      activeTab === tab ? 'bg-primary-50 text-primary' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {iconMap[tab]}
                    {tab}
                  </button>
                )
              })}
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
                      {ROLE_LABELS[currentUser?.role] || 'Admin'}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="s-firstName" className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                      <input id="s-firstName" className="input-field" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor="s-lastName" className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                      <input id="s-lastName" className="input-field" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="s-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
                    <input id="s-phone" type="tel" className="input-field" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                  </div>

                  <div>
                    <label htmlFor="s-city" className="block text-sm font-medium text-gray-700 mb-1.5">Ville</label>
                    <select id="s-city" className="input-field" value={profile.city} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}>
                      <option value="">Sélectionner</option>
                      {CITIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  {currentUser?.role === 'tutor' && (
                    <>
                      <div>
                        <label htmlFor="s-bio" className="block text-sm font-medium text-gray-700 mb-1.5">Biographie</label>
                        <textarea
                          id="s-bio"
                          className="input-field resize-none h-32"
                          value={profile.bio}
                          onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                          maxLength={600}
                        />
                        <p className="text-xs text-gray-400 mt-1">{profile.bio.length}/600</p>
                      </div>
                      <div>
                        <label htmlFor="s-rate" className="block text-sm font-medium text-gray-700 mb-1.5">Tarif mensuel (FCFA)</label>
                        <input id="s-rate" type="number" className="input-field" value={profile.monthlyRate} onChange={e => setProfile(p => ({ ...p, monthlyRate: e.target.value }))} step="1000" />
                      </div>
                    </>
                  )}

                  {currentUser?.role === 'parent' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Niveau(x) scolaire(s)</label>
                        <p className="text-xs text-gray-400 mb-2">Sélectionnez tous les niveaux de vos enfants</p>
                        <div className="grid grid-cols-2 gap-2">
                          {LEVELS.map(l => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => toggleProfileLevel(l)}
                              className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                                profile.childLevels.includes(l)
                                  ? 'border-secondary bg-secondary-50 text-secondary'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profile.openToContact}
                            onChange={e => setProfile(p => ({ ...p, openToContact: e.target.checked }))}
                            className="mt-0.5 w-4 h-4 accent-secondary flex-shrink-0"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                              <UserX size={14} className="text-gray-500" />
                              Accepter d'être contacté par des répétiteurs
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Décochez si vous avez déjà trouvé un répétiteur et ne souhaitez plus être sollicité.
                            </p>
                          </div>
                        </label>
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

            {/* Documents tab (tutors only) */}
            {activeTab === 'Documents' && currentUser?.role === 'tutor' && (
              <div className="space-y-4">

                {/* Statut actuel */}
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText size={18} className="text-primary" />
                    Statut de votre dossier
                  </h2>
                  <div className="space-y-2">
                    {[
                      { label: 'Pièce d\'identité', ok: hasId },
                      { label: 'Selfie avec pièce', ok: hasSelfie },
                      { label: `Diplôme${diplomaCount > 1 ? 's' : ''} (${diplomaCount} soumis)`, ok: diplomaCount > 0 },
                    ].map(({ label, ok }) => (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        {ok
                          ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          : <AlertCircle size={16} className="text-orange-400 flex-shrink-0" />
                        }
                        <span className={ok ? 'text-gray-700' : 'text-orange-700 font-medium'}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {docDone && (
                    <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm text-green-700">
                      <CheckCircle size={15} />
                      Documents soumis — l'admin les vérifiera sous 24-48h.
                    </div>
                  )}
                </div>

                {/* Upload form */}
                <div className="card space-y-5">
                  <h2 className="font-semibold text-gray-900">Soumettre / Compléter vos documents</h2>

                  {/* Pièce d'identité */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Type de pièce d'identité</p>
                    <div className="flex gap-3 mb-3">
                      {['cni', 'passport'].map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setDocIdType(type)}
                          className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                            docIdType === type ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {type === 'cni' ? 'CNI' : 'Passeport'}
                        </button>
                      ))}
                    </div>
                    {docIdType === 'cni' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5">CNI Recto</p>
                          <DocUploadZone file={docCniRecto} onFile={setDocCniRecto} inputRef={docCniRectoRef} label="Charger le recto" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5">CNI Verso</p>
                          <DocUploadZone file={docCniVerso} onFile={setDocCniVerso} inputRef={docCniVersoRef} label="Charger le verso" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">Page photo du passeport</p>
                        <DocUploadZone file={docPassport} onFile={setDocPassport} inputRef={docPassportRef} label="Charger la page photo" />
                      </div>
                    )}
                  </div>

                  {/* Diplômes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">Diplômes à ajouter</p>
                      <button
                        type="button"
                        onClick={() => setDocDiplomas(d => [...d, { name: '', file: null }])}
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        <Plus size={13} /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-3">
                      {docDiplomas.map((d, i) => (
                        <div key={i} className="space-y-2">
                          <input
                            className="input-field text-sm"
                            placeholder={`Intitulé du diplôme ${i + 1} (ex: Licence Maths)`}
                            value={d.name}
                            onChange={e => {
                              const next = [...docDiplomas]
                              next[i] = { ...next[i], name: e.target.value }
                              setDocDiplomas(next)
                            }}
                          />
                          {d.name.trim() && (
                            <>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                className="hidden"
                                id={`doc-diploma-${i}`}
                                onChange={e => {
                                  const next = [...docDiplomas]
                                  next[i] = { ...next[i], file: e.target.files?.[0] || null }
                                  setDocDiplomas(next)
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => document.getElementById(`doc-diploma-${i}`)?.click()}
                                className={`w-full border-2 border-dashed rounded-xl p-2.5 flex items-center gap-2 text-xs transition-all ${
                                  d.file ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-300 hover:border-primary text-gray-500'
                                }`}
                              >
                                {d.file ? <><CheckCircle size={14} className="text-green-500" /> {d.file.name}</> : <><Upload size={14} /> Fichier du diplôme</>}
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {docs.diplomes?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">{docs.diplomes.length} diplôme{docs.diplomes.length > 1 ? 's' : ''} déjà soumis — les nouveaux s'ajouteront.</p>
                    )}
                  </div>

                  {/* Selfie */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Selfie avec pièce d'identité
                      {hasSelfie && <span className="ml-2 text-xs text-green-600 font-normal">— déjà soumis</span>}
                    </p>
                    <div className="bg-gray-50 rounded-xl p-4">
                      {docSelfieDataUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <img src={docSelfieDataUrl} alt="selfie" className="w-48 h-36 object-cover rounded-xl border border-green-300" />
                          <button type="button" onClick={retakeDocPhoto} className="text-xs text-primary flex items-center gap-1">
                            <RefreshCw size={13} /> Reprendre
                          </button>
                        </div>
                      ) : docCameraActive ? (
                        <div className="flex flex-col items-center gap-3">
                          <video ref={docVideoRef} autoPlay playsInline className="w-full max-w-xs rounded-xl" />
                          <canvas ref={docCanvasRef} className="hidden" />
                          <div className="flex gap-3">
                            <button type="button" onClick={captureDocPhoto} className="btn-primary text-sm px-5">
                              Capturer
                            </button>
                            <button type="button" onClick={stopDocCamera} className="btn-outline text-sm px-4">
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-2">
                          <p className="text-xs text-gray-500 text-center">
                            Tenez votre pièce d'identité à côté de votre visage et activez la caméra.
                          </p>
                          <button type="button" onClick={startDocCamera} className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                            <Camera size={16} />
                            Activer la caméra
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {docError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{docError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleUploadDocuments}
                    disabled={docUploading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {docUploading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Envoi en cours…</>
                      : <><Save size={16} /> Soumettre les documents</>
                    }
                  </button>
                </div>
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
                      <label htmlFor="s-newpwd" className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
                      <div className="relative">
                        <input
                          id="s-newpwd"
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
                      <label htmlFor="s-confirmpwd" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le nouveau mot de passe</label>
                      <input
                        id="s-confirmpwd"
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
