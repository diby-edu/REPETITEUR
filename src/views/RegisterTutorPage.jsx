'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, LEVELS, QUARTIERS_BY_CITY } from '../data/constants'
import { MODALITIES } from '../utils/helpers'
import CityCombobox from '../components/common/CityCombobox'
import {
  CheckCircle, ChevronLeft, Upload, Clock, Info,
  Home, Building2, Users, Wifi, FileText, Plus, Trash2,
  Camera, RefreshCw,
} from 'lucide-react'

const MODALITY_ICONS = {
  domicile_parent: <Home size={18} />,
  domicile_repetiteur: <Building2 size={18} />,
  lieu_neutre: <Users size={18} />,
  en_ligne: <Wifi size={18} />,
}

const steps = ['Informations', 'Expertise', 'Documents', 'Selfie', 'Confirmation']

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const SLOTS = ['8h-10h', '10h-12h', '12h-14h', '14h-16h', '16h-18h', '18h-20h']
const DAY_LABELS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' }

function FileUploadZone({ file, onFile, label, inputRef }) {
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
        className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer ${
          file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'
        }`}
      >
        {file ? (
          <>
            <FileText size={24} className="text-green-500" />
            <span className="text-xs font-medium text-green-700 text-center break-all">{file.name}</span>
            <span className="text-xs text-gray-400">Cliquer pour changer</span>
          </>
        ) : (
          <>
            <Upload size={24} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
            <span className="text-xs text-gray-400">JPG, PNG ou PDF — max 5 Mo</span>
          </>
        )}
      </button>
    </>
  )
}

export default function RegisterTutorPage() {
  const { register } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [emailConfirmation, setEmailConfirmation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '',
    city: 'Abidjan', quartier: '', bio: '',
    subjects: [], levels: [], monthlyRate: '', modalities: [],
    availability: { lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [], dimanche: [] },
    idType: 'cni',
    cniRectoFile: null,
    cniVersoFile: null,
    passportFile: null,
    diplomas: [{ name: '', file: null }],
    selfieDataUrl: null,
  })

  // Refs pour les inputs fichiers
  const cniRectoRef = useRef(null)
  const cniVersoRef = useRef(null)
  const passportRef = useRef(null)
  const diplomaRefs = useRef([])

  // Refs pour la caméra
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const toggleItem = (key, item) => {
    set(key, form[key].includes(item) ? form[key].filter(x => x !== item) : [...form[key], item])
  }

  const toggleAvailability = (day, slot) => {
    const current = form.availability[day]
    const updated = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot]
    set('availability', { ...form.availability, [day]: updated })
  }

  // Sélection rapide — colonne (tout un créneau sur tous les jours)
  const toggleColumn = useCallback((slot) => {
    const allSelected = DAYS.every(d => form.availability[d].includes(slot))
    const updated = { ...form.availability }
    DAYS.forEach(d => {
      if (allSelected) updated[d] = updated[d].filter(s => s !== slot)
      else if (!updated[d].includes(slot)) updated[d] = [...updated[d], slot]
    })
    set('availability', updated)
  }, [form.availability])

  // Sélection rapide — ligne (tous les créneaux d'un jour)
  const toggleRow = useCallback((day) => {
    const allSelected = SLOTS.every(s => form.availability[day].includes(s))
    set('availability', { ...form.availability, [day]: allSelected ? [] : [...SLOTS] })
  }, [form.availability])

  const selectAllSlots = () => {
    const updated = {}
    DAYS.forEach(d => { updated[d] = [...SLOTS] })
    set('availability', updated)
  }

  const clearAllSlots = () => {
    const updated = {}
    DAYS.forEach(d => { updated[d] = [] })
    set('availability', updated)
  }

  const quartiers = form.city === 'Abidjan' ? (QUARTIERS_BY_CITY['Abidjan'] || []) : []

  const addDiploma = () => set('diplomas', [...form.diplomas, { name: '', file: null }])

  const removeDiploma = (i) => set('diplomas', form.diplomas.filter((_, idx) => idx !== i))

  const updateDiploma = (i, key, val) => {
    set('diplomas', form.diplomas.map((d, idx) => idx === i ? { ...d, [key]: val } : d))
  }

  const idDocReady = form.idType === 'cni'
    ? (form.cniRectoFile && form.cniVersoFile)
    : form.passportFile

  // Diplôme valide : les deux champs remplis OU les deux vides (si plusieurs diplômes, au moins un complet)
  const diplomasValid = form.diplomas.every(d => {
    const hasName = d.name.trim().length > 0
    const hasFile = !!d.file
    return (hasName && hasFile) || (!hasName && !hasFile)
  })
  const diplomasReady = form.diplomas.some(d => d.name.trim() && d.file) && diplomasValid

  // ── Selfie / Caméra ──────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch {
      alert('Impossible d\'accéder à la caméra. Vérifiez les autorisations de votre navigateur.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    set('selfieDataUrl', dataUrl)
    stopCamera()
  }, [stopCamera])

  const retakePhoto = useCallback(() => {
    set('selfieDataUrl', null)
    startCamera()
  }, [startCamera])

  // Stopper la caméra si on quitte l'étape selfie
  useEffect(() => {
    if (step !== 3 && cameraActive) stopCamera()
  }, [step, cameraActive, stopCamera])

  // ── Soumission ────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const result = await register({
      email: form.email,
      password: form.password,
      role: 'tutor',
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      city: form.city,
      quartier: form.quartier,
      avatarColor: '#9B59B6',
      bio: form.bio,
      subjects: form.subjects,
      levels: form.levels,
      monthlyRate: Number.parseInt(form.monthlyRate) || 25000,
      modalities: form.modalities,
      availability: form.availability,
      documents: {},
    })

    if (!result.success) {
      setError(result.error || 'Erreur lors de la création du compte.')
      setLoading(false)
      return
    }

    if (result.emailConfirmation) {
      setLoading(false)
      setEmailConfirmation(true)
      return
    }

    const userId = result.user.id
    const documents = { idType: form.idType }

    // Uploader la pièce d'identité
    if (form.idType === 'cni') {
      if (form.cniRectoFile) {
        const ext = form.cniRectoFile.name.split('.').pop()
        const { error: e } = await supabase.storage.from('documents').upload(`${userId}/cni_recto.${ext}`, form.cniRectoFile, { upsert: true })
        if (!e) { documents.cniRecto = true; documents.cniRectoPath = `${userId}/cni_recto.${ext}` }
      }
      if (form.cniVersoFile) {
        const ext = form.cniVersoFile.name.split('.').pop()
        const { error: e } = await supabase.storage.from('documents').upload(`${userId}/cni_verso.${ext}`, form.cniVersoFile, { upsert: true })
        if (!e) { documents.cniVerso = true; documents.cniVersoPath = `${userId}/cni_verso.${ext}` }
      }
    } else if (form.passportFile) {
      const ext = form.passportFile.name.split('.').pop()
      const { error: e } = await supabase.storage.from('documents').upload(`${userId}/passport.${ext}`, form.passportFile, { upsert: true })
      if (!e) { documents.passport = true; documents.passportPath = `${userId}/passport.${ext}` }
    }

    // Uploader les diplômes
    const uploadedDiplomas = []
    for (let i = 0; i < form.diplomas.length; i++) {
      const d = form.diplomas[i]
      if (!d.file || !d.name.trim()) continue
      const ext = d.file.name.split('.').pop()
      const path = `${userId}/diplome_${i}.${ext}`
      const { error: e } = await supabase.storage.from('documents').upload(path, d.file, { upsert: true })
      if (!e) uploadedDiplomas.push({ name: d.name.trim(), path })
    }
    documents.diplomes = uploadedDiplomas

    // Uploader le selfie
    if (form.selfieDataUrl) {
      try {
        const res = await fetch(form.selfieDataUrl)
        const blob = await res.blob()
        const { error: e } = await supabase.storage.from('documents').upload(`${userId}/selfie.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })
        if (!e) documents.selfiePath = `${userId}/selfie.jpg`
      } catch { /* selfie upload non bloquant */ }
    }

    await supabase.from('tutors').update({ documents }).eq('id', userId)

    setLoading(false)
    setSubmitted(true)
  }

  // ── Écrans de fin ────────────────────────────────────────────

  if (emailConfirmation) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-blue-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Confirmez votre email !</h1>
          <p className="text-gray-500 mb-2">
            Un email de confirmation a été envoyé à <strong>{form.email}</strong>.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Cliquez sur le lien dans l'email pour activer votre compte, puis connectez-vous.
          </p>
          <button onClick={() => router.push('/connexion')} className="btn-primary">
            Aller à la connexion
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-yellow-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Inscription soumise !</h1>
          <p className="text-gray-500 mb-3">
            Merci <strong>{form.firstName}</strong> ! Votre dossier est en cours de vérification. Vous serez notifié sous 24-48h.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 mb-6">
            <p className="font-semibold mb-1">En attendant la validation :</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>Votre profil est invisible des recherches</li>
              <li>Choisissez un abonnement pour être prêt</li>
              <li>Complétez votre biographie</li>
            </ul>
          </div>
          <button onClick={() => router.push('/tableau-de-bord/repetiteur')} className="btn-primary">
            Accéder à mon tableau de bord
          </button>
        </div>
      </div>
    )
  }

  // ── Formulaire principal ─────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => step === 0 ? router.push('/inscription') : setStep(step - 1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Inscription Répétiteur</h1>
            <p className="text-gray-500 text-sm">Étape {step + 1} sur {steps.length}</p>
          </div>
        </div>

        {/* Barre de progression — cliquable pour les étapes déjà visitées */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`flex-1 flex flex-col gap-1 text-left ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? 'bg-primary' : 'bg-gray-200'}`} />
              <p className={`text-xs hidden sm:block ${i === step ? 'text-primary font-semibold' : i < step ? 'text-primary/60 hover:text-primary' : 'text-gray-400'}`}>{s}</p>
            </button>
          ))}
        </div>

        <div className="card">

          {/* ── Étape 1 : Informations personnelles ─── */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-gray-800">Informations personnelles</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom *</label>
                  <input className="input-field" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Amadou" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
                  <input className="input-field" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Koné" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} placeholder="votre@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone *</label>
                <input type="tel" className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+225 07 XX XX XX" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville *</label>
                  <CityCombobox value={form.city} onChange={city => { set('city', city); set('quartier', '') }} />
                </div>
                {quartiers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Quartier *</label>
                    <select className="input-field" value={form.quartier} onChange={e => set('quartier', e.target.value)}>
                      <option value="">Choisir un quartier</option>
                      {quartiers.map(q => <option key={q}>{q}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Biographie *</label>
                <textarea
                  className="input-field resize-none h-28"
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  placeholder="Décrivez votre expérience, vos diplômes, votre méthode d'enseignement..."
                  maxLength={600}
                />
                <p className="text-xs text-gray-400 mt-1">{form.bio.length}/600 caractères</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe *</label>
                <input type="password" className="input-field" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!form.firstName || !form.lastName || !form.email || !form.city || !form.bio || (quartiers.length > 0 && !form.quartier)}
                className="btn-primary w-full disabled:opacity-50"
              >
                Continuer
              </button>
            </div>
          )}

          {/* ── Étape 2 : Expertise & Disponibilités ─── */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="font-semibold text-lg text-gray-800">Expertise & Disponibilités</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Matières enseignées *</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map(s => (
                    <button key={s} type="button" onClick={() => toggleItem('subjects', s)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${form.subjects.includes(s) ? 'bg-primary border-primary text-white' : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Niveaux enseignés *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {LEVELS.map(l => (
                    <button key={l} type="button" onClick={() => toggleItem('levels', l)}
                      className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.levels.includes(l) ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarif par séance — 2h (FCFA) *</label>
                <input type="number" className="input-field" value={form.monthlyRate} onChange={e => set('monthlyRate', e.target.value)} placeholder="Ex: 5000" min="1000" max="200000" step="500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Modalités acceptées *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MODALITIES.map(m => {
                    const selected = form.modalities.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => set('modalities', selected ? form.modalities.filter(x => x !== m.id) : [...form.modalities, m.id])}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${selected ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <span className={`mt-0.5 flex-shrink-0 ${selected ? 'text-primary' : 'text-gray-400'}`}>{MODALITY_ICONS[m.id]}</span>
                        <div>
                          <p className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-gray-700'}`}>{m.label}</p>
                          <p className="text-xs text-gray-400">{m.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Grille de disponibilités avec en-têtes cliquables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Clock size={16} />Disponibilités
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAllSlots} className="text-xs text-primary hover:underline font-medium">Tout sélectionner</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={clearAllSlots} className="text-xs text-gray-500 hover:underline">Tout effacer</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {/* Coin vide */}
                        <th className="w-8 py-1 pr-1" />
                        {/* En-têtes colonnes cliquables = sélectionner ce créneau pour tous les jours */}
                        {SLOTS.map(slot => (
                          <th key={slot} className="py-1 px-0.5 text-center">
                            <button
                              type="button"
                              title={`Sélectionner ${slot} tous les jours`}
                              onClick={() => toggleColumn(slot)}
                              className="text-gray-500 hover:text-primary font-normal whitespace-nowrap transition-colors px-1 py-0.5 rounded hover:bg-primary-50"
                            >
                              {slot}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day}>
                          {/* En-têtes lignes cliquables = sélectionner tous les créneaux du jour */}
                          <td className="py-1 pr-1">
                            <button
                              type="button"
                              title={`Sélectionner toute la journée`}
                              onClick={() => toggleRow(day)}
                              className="text-gray-600 font-medium hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-primary-50 w-full text-left"
                            >
                              {DAY_LABELS[day]}
                            </button>
                          </td>
                          {SLOTS.map(slot => (
                            <td key={slot} className="py-1 px-0.5">
                              <button
                                type="button"
                                onClick={() => toggleAvailability(day, slot)}
                                className={`w-full h-7 rounded-lg transition-colors ${form.availability[day].includes(slot) ? 'bg-primary' : 'bg-gray-100 hover:bg-gray-200'}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Cliquer sur un jour ou un créneau pour tout sélectionner. Orange = disponible.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-outline flex-1">Retour</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!form.subjects.length || !form.levels.length || !form.monthlyRate || !form.modalities.length}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 3 : Documents ─── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg text-gray-800">Documents de vérification</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Ces documents permettent de vérifier votre identité et vos qualifications. Votre profil sera validé sous 24-48h après soumission.
                </p>
              </div>

              {/* Type de pièce */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de pièce d'identité *</label>
                <div className="flex gap-3">
                  {[
                    { value: 'cni', label: 'Carte Nationale d\'Identité' },
                    { value: 'passport', label: 'Passeport' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('idType', opt.value)}
                      className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all ${form.idType === opt.value ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CNI recto + verso */}
              {form.idType === 'cni' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CNI — Recto & Verso *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <FileUploadZone file={form.cniRectoFile} onFile={f => set('cniRectoFile', f)} label="Recto" inputRef={cniRectoRef} />
                    <FileUploadZone file={form.cniVersoFile} onFile={f => set('cniVersoFile', f)} label="Verso" inputRef={cniVersoRef} />
                  </div>
                </div>
              )}

              {/* Passeport */}
              {form.idType === 'passport' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Passeport *</label>
                  <FileUploadZone file={form.passportFile} onFile={f => set('passportFile', f)} label="Page principale du passeport" inputRef={passportRef} />
                </div>
              )}

              {/* Diplômes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Diplôme(s) *</label>
                  <button type="button" onClick={addDiploma} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                    <Plus size={14} /> Ajouter un diplôme
                  </button>
                </div>
                <div className="space-y-4">
                  {form.diplomas.map((d, i) => {
                    if (!diplomaRefs.current[i]) diplomaRefs.current[i] = { current: null }
                    const partialError = (d.name.trim() && !d.file) || (!d.name.trim() && !!d.file)
                    return (
                      <div key={i} className={`border rounded-xl p-4 space-y-3 ${partialError ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">Diplôme {i + 1}</p>
                          {form.diplomas.length > 1 && (
                            <button type="button" onClick={() => removeDiploma(i)} className="text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <input
                          className="input-field"
                          placeholder="Ex: Licence de Mathématiques — Université de Cocody"
                          value={d.name}
                          onChange={e => updateDiploma(i, 'name', e.target.value)}
                        />
                        <input
                          ref={el => { if (!diplomaRefs.current[i]) diplomaRefs.current[i] = {}; diplomaRefs.current[i].current = el }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={e => updateDiploma(i, 'file', e.target.files?.[0] || null)}
                        />
                        <button
                          type="button"
                          onClick={() => diplomaRefs.current[i]?.current?.click()}
                          className={`w-full border-2 border-dashed rounded-xl p-3 flex items-center gap-3 transition-all cursor-pointer ${
                            d.file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'
                          }`}
                        >
                          {d.file ? (
                            <>
                              <FileText size={20} className="text-green-500 flex-shrink-0" />
                              <span className="text-xs font-medium text-green-700 truncate">{d.file.name}</span>
                            </>
                          ) : (
                            <>
                              <Upload size={20} className="text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-500">Cliquez pour sélectionner le fichier (JPG, PNG, PDF — max 5 Mo)</span>
                            </>
                          )}
                        </button>
                        {partialError && (
                          <p className="text-xs text-orange-600 font-medium">
                            {d.name.trim() && !d.file ? 'Veuillez joindre le fichier du diplôme.' : 'Veuillez saisir l\'intitulé du diplôme.'}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-outline flex-1">Retour</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!idDocReady || !diplomasReady}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 4 : Selfie ─── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg text-gray-800">Selfie avec votre pièce d'identité</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Pourquoi ce selfie ?</p>
                  <p>Tenez votre pièce d'identité à côté de votre visage et prenez une photo. Cela confirme que vous êtes bien le titulaire du document.</p>
                </div>
              </div>

              {/* Zone caméra / aperçu */}
              <div className="rounded-2xl overflow-hidden bg-gray-900 aspect-video flex items-center justify-center relative">
                {/* Vidéo caméra en direct */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                {/* Canvas (caché, utilisé pour la capture) */}
                <canvas ref={canvasRef} className="hidden" />
                {/* Photo capturée */}
                {form.selfieDataUrl && !cameraActive && (
                  <img src={form.selfieDataUrl} alt="Selfie" className="w-full h-full object-cover" />
                )}
                {/* État initial */}
                {!cameraActive && !form.selfieDataUrl && (
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Camera size={48} className="opacity-40" />
                    <p className="text-sm">Cliquez sur "Ouvrir la caméra" pour commencer</p>
                  </div>
                )}
              </div>

              {/* Boutons d'action */}
              {!form.selfieDataUrl && !cameraActive && (
                <button type="button" onClick={startCamera} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Camera size={18} /> Ouvrir la caméra
                </button>
              )}
              {cameraActive && (
                <button type="button" onClick={capturePhoto} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Camera size={18} /> Capturer
                </button>
              )}
              {form.selfieDataUrl && (
                <div className="flex gap-3">
                  <button type="button" onClick={retakePhoto} className="btn-outline flex-1 flex items-center justify-center gap-2">
                    <RefreshCw size={16} /> Recommencer
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-2 text-green-600 font-medium text-sm">
                    <CheckCircle size={18} /> Photo validée
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center">
                La photo reste privée et ne sera vue que par notre équipe de vérification.
              </p>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-outline flex-1">Retour</button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!form.selfieDataUrl}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 5 : Confirmation ─── */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-gray-800">Récapitulatif</h2>
              <div className="bg-primary-50 rounded-xl p-4 space-y-2">
                {[
                  ['Nom', `${form.firstName} ${form.lastName}`],
                  ['Ville', `${form.quartier ? form.quartier + ', ' : ''}${form.city}`],
                  ['Matières', form.subjects.join(', ')],
                  ['Niveaux', form.levels.join(', ')],
                  ['Tarif par séance (2h)', `${parseInt(form.monthlyRate || 0).toLocaleString('fr-FR')} FCFA`],
                  ['Modalités', form.modalities.map(m => ({ domicile_parent: 'Dom. parent', domicile_repetiteur: 'Dom. répétiteur', lieu_neutre: 'Lieu neutre', en_ligne: 'En ligne' })[m]).join(', ')],
                  ['Pièce d\'identité', form.idType === 'cni' ? 'CNI (recto + verso)' : 'Passeport'],
                  ['Diplômes', form.diplomas.filter(d => d.name.trim()).map(d => d.name).join(', ')],
                  ['Selfie', form.selfieDataUrl ? '✓ Capturé' : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">{v}</span>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                Votre profil sera <strong>en attente de vérification</strong> jusqu'à validation de vos documents par notre équipe.
              </div>

              <p className="text-xs text-gray-400">En vous inscrivant, vous acceptez nos CGU et notre politique de confidentialité.</p>
              {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="btn-outline flex-1" disabled={loading}>Retour</button>
                <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Soumettre mon dossier'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="text-primary font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
