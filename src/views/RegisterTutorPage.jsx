'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, LEVELS, QUARTIERS_BY_CITY } from '../data/constants'
import { MODALITIES } from '../utils/helpers'
import CityCombobox from '../components/common/CityCombobox'
import OtpInput from '../components/common/OtpInput'
import {
  CheckCircle, ChevronLeft, Upload, Clock, Home, Building2,
  Users, Wifi, FileText, Plus, Camera, RefreshCw,
  Eye, EyeOff, Mail, Shield, GraduationCap, X, Trash2,
} from 'lucide-react'

const STEPS = ['Compte', 'Vérification', 'Informations', 'Expertise', 'Documents', 'Selfie']
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const SLOTS = ['8h-10h', '10h-12h', '12h-14h', '14h-16h', '16h-18h', '18h-20h']
const DAY_LABELS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' }
const MODALITY_ICONS = {
  domicile_parent: <Home size={16} />,
  domicile_repetiteur: <Building2 size={16} />,
  lieu_neutre: <Users size={16} />,
  en_ligne: <Wifi size={16} />,
}
const AVATAR_COLORS = ['#E87722', '#2D6A4F', '#9B59B6', '#2980B9', '#E74C3C', '#16A085', '#D35400', '#1A5276']

// ── Composants locaux ────────────────────────────────────────────

function FileUploadZone({ file, existingPath, uploading, onFile, inputRef, label }) {
  const done = !!file || !!existingPath
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
        disabled={uploading}
        className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer disabled:cursor-wait ${
          done ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'
        }`}
      >
        {uploading ? (
          <>
            <RefreshCw size={22} className="text-primary animate-spin" />
            <span className="text-xs font-medium text-gray-500">Envoi en cours…</span>
          </>
        ) : file ? (
          <>
            <FileText size={22} className="text-green-500" />
            <span className="text-xs font-medium text-green-700 text-center break-all">{file.name}</span>
            <span className="text-xs text-gray-400">Cliquer pour changer</span>
          </>
        ) : existingPath ? (
          <>
            <CheckCircle size={22} className="text-green-500" />
            <span className="text-xs font-medium text-green-700 text-center">Document déjà envoyé</span>
            <span className="text-xs text-gray-400">Cliquer pour remplacer</span>
          </>
        ) : (
          <>
            <Upload size={22} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
            <span className="text-xs text-gray-400">JPG, PNG ou PDF — 5 Mo max</span>
          </>
        )}
      </button>
    </>
  )
}

async function uploadDoc(userId, file, filename) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${filename}.${ext}`
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  return error ? null : path
}

// ── Page principale ──────────────────────────────────────────────

export default function RegisterTutorPage() {
  const { verifyOtp, refreshCurrentUser, currentUser } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [stepSaving, setStepSaving] = useState(false)
  const [uploadingDocs, setUploadingDocs] = useState({})
  const [selfieUploading, setSelfieUploading] = useState(false)

  // Étape 0
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Étape 1 (OTP)
  const [pendingEmail, setPendingEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [resent, setResent] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  // Caméra selfie
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Refs fichiers
  const cniRectoRef = useRef(null)
  const cniVersoRef = useRef(null)
  const passportRef = useRef(null)

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', phone: '', city: 'Abidjan', quartier: '', bio: '',
    subjects: [], levels: [], monthlyRate: '', modalities: [],
    availability: { lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [], dimanche: [] },
    idType: 'cni',
    cniRectoFile: null, cniVersoFile: null, passportFile: null,
    documents: {},
    diplomas: [{ name: '', file: null, path: null, uploading: false }],
    selfieDataUrl: null,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  })

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const toggleItem = (key, item) =>
    setForm(prev => ({
      ...prev,
      [key]: prev[key].includes(item) ? prev[key].filter(x => x !== item) : [...prev[key], item],
    }))

  const toggleAvailability = (day, slot) => {
    const cur = form.availability[day]
    set('availability', { ...form.availability, [day]: cur.includes(slot) ? cur.filter(s => s !== slot) : [...cur, slot] })
  }

  const toggleColumn = useCallback((slot) => {
    const allSelected = DAYS.every(d => form.availability[d].includes(slot))
    const updated = { ...form.availability }
    DAYS.forEach(d => {
      if (allSelected) updated[d] = updated[d].filter(s => s !== slot)
      else if (!updated[d].includes(slot)) updated[d] = [...updated[d], slot]
    })
    set('availability', updated)
  }, [form.availability])

  const toggleRow = useCallback((day) => {
    const allSelected = SLOTS.every(s => form.availability[day].includes(s))
    set('availability', { ...form.availability, [day]: allSelected ? [] : [...SLOTS] })
  }, [form.availability])

  const selectAll = () => {
    const updated = {}
    DAYS.forEach(d => { updated[d] = [...SLOTS] })
    set('availability', updated)
  }

  const clearAll = () => {
    const updated = {}
    DAYS.forEach(d => { updated[d] = [] })
    set('availability', updated)
  }

  // Validation diplômes
  const diplomasValid = form.diplomas.every(d => {
    const hasName = d.name.trim() !== ''
    const hasContent = !!d.file || !!d.path
    return (!hasName && !hasContent) || (hasName && hasContent)
  })
  const diplomasReady = form.diplomas.some(d => d.name.trim() && (d.file || d.path)) && diplomasValid

  // ── Sauvegarde progressive (survit à un refresh) ──────────────
  const persistDocPatch = async (patch) => {
    let newDocs
    setForm(f => {
      newDocs = { ...f.documents, ...patch }
      return { ...f, documents: newDocs }
    })
    if (currentUser?.id) await supabase.from('tutors').update({ documents: newDocs }).eq('id', currentUser.id)
  }

  const persistDiplomas = async () => {
    let newDocs
    setForm(f => {
      const diplomes = f.diplomas.filter(d => d.name.trim() && d.path).map(d => ({ name: d.name.trim(), path: d.path }))
      newDocs = { ...f.documents, diplomes }
      return { ...f, documents: newDocs }
    })
    if (currentUser?.id) await supabase.from('tutors').update({ documents: newDocs }).eq('id', currentUser.id)
  }

  const handleIdFile = async (field, file) => {
    set(`${field}File`, file)
    if (!file || !currentUser?.id) return
    setUploadingDocs(u => ({ ...u, [field]: true }))
    const filename = field === 'cniRecto' ? 'cni_recto' : field === 'cniVerso' ? 'cni_verso' : 'passport'
    const path = await uploadDoc(currentUser.id, file, filename)
    setUploadingDocs(u => ({ ...u, [field]: false }))
    if (!path) { setError("Échec de l'envoi du fichier. Réessayez."); return }
    await persistDocPatch({ idType: form.idType, [field]: true, [`${field}Path`]: path })
  }

  const handleDiplomaFile = async (i, file) => {
    setForm(f => {
      const next = [...f.diplomas]
      next[i] = { ...next[i], file, uploading: !!file }
      return { ...f, diplomas: next }
    })
    if (!file || !currentUser?.id) return
    const path = await uploadDoc(currentUser.id, file, `diplome_${i}_${Date.now()}`)
    setForm(f => {
      const next = [...f.diplomas]
      next[i] = { ...next[i], path: path || next[i].path, uploading: false }
      return { ...f, diplomas: next }
    })
    if (path) await persistDiplomas()
    else setError("Échec de l'envoi du fichier. Réessayez.")
  }

  // Caméra
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      setCameraActive(true)
    } catch {
      setError('Impossible d\'activer la caméra. Vérifiez les autorisations.')
    }
  }

  const capturePhoto = async () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    set('selfieDataUrl', dataUrl)
    stopCamera()
    if (!currentUser?.id) return
    setSelfieUploading(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const { error: e } = await supabase.storage.from('documents').upload(`${currentUser.id}/selfie.jpg`, blob, { upsert: true, contentType: 'image/jpeg' })
      if (!e) await persistDocPatch({ selfiePath: `${currentUser.id}/selfie.jpg` })
      else setError("Échec de l'envoi du selfie. Réessayez.")
    } finally {
      setSelfieUploading(false)
    }
  }

  const stopCamera = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  useEffect(() => {
    if (step !== 5 && cameraActive) stopCamera()
  }, [step, cameraActive, stopCamera])

  // Le <video> n'existe dans le DOM qu'une fois cameraActive=true (rendu
  // conditionnel) — assigner srcObject dans startCamera() est donc trop tôt
  // (le ref est encore null) et laisse l'écran noir. On l'attache ici, une
  // fois le composant vidéo effectivement monté.
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play?.().catch(() => {})
    }
  }, [cameraActive])

  // Primaire uniquement = polyvalent, pas de sélection de matières
  const isPrimaireOnly = form.levels.length === 1 && form.levels[0] === 'Primaire'
  useEffect(() => {
    if (isPrimaireOnly && form.subjects.length > 0) set('subjects', [])
  }, [isPrimaireOnly])

  // Timer renvoi OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendTimer])

  // Reprise après refresh : si déjà authentifié, sauter compte/OTP et reprendre
  // exactement là où l'utilisateur s'est arrêté (aucune donnée n'est perdue,
  // chaque étape est sauvegardée en base au fur et à mesure).
  useEffect(() => {
    if (!currentUser?.id || currentUser.role !== 'tutor') return
    if (currentUser.verificationStatus === 'verified' || currentUser.verificationStatus === 'rejected') {
      router.replace('/tableau-de-bord/repetiteur')
      return
    }

    const docs = currentUser.documents || {}
    const quartierOk = QUARTIERS_BY_CITY[currentUser.city]?.length > 0 ? !!currentUser.quartier : true
    const hasBasicInfo = !!(currentUser.firstName && currentUser.lastName && currentUser.phone && currentUser.city && currentUser.bio?.trim() && quartierOk)
    const primaireOnly = currentUser.levels?.length === 1 && currentUser.levels[0] === 'Primaire'
    const hasExpertise = currentUser.levels?.length > 0 && (primaireOnly || currentUser.subjects?.length > 0) && currentUser.monthlyRate > 0 && currentUser.modalities?.length > 0
    const hasId = docs.idType === 'cni' ? !!(docs.cniRecto && docs.cniVerso) : docs.idType === 'passport' ? !!docs.passport : false
    const hasDocuments = hasId && docs.diplomes?.length > 0
    const hasSelfie = !!docs.selfiePath

    setForm(f => ({
      ...f,
      firstName: currentUser.firstName || f.firstName,
      lastName: currentUser.lastName || f.lastName,
      phone: currentUser.phone || f.phone,
      city: currentUser.city || f.city,
      quartier: currentUser.quartier || f.quartier,
      bio: currentUser.bio || f.bio,
      subjects: currentUser.subjects?.length ? currentUser.subjects : f.subjects,
      levels: currentUser.levels?.length ? currentUser.levels : f.levels,
      monthlyRate: currentUser.monthlyRate ? String(currentUser.monthlyRate) : f.monthlyRate,
      modalities: currentUser.modalities?.length ? currentUser.modalities : f.modalities,
      availability: currentUser.availability && Object.keys(currentUser.availability).length ? { ...f.availability, ...currentUser.availability } : f.availability,
      idType: docs.idType || f.idType,
      documents: docs,
      diplomas: docs.diplomes?.length ? docs.diplomes.map(d => ({ name: d.name, path: d.path, file: null, uploading: false })) : f.diplomas,
      avatarColor: currentUser.avatarColor || f.avatarColor,
    }))

    if (!hasBasicInfo) setStep(2)
    else if (!hasExpertise) setStep(3)
    else if (!hasDocuments) setStep(4)
    else if (!hasSelfie) setStep(5)
    else setSubmitted(true)
  }, [currentUser?.id])

  // ── Étape 0 : Créer le compte ─────────────────────────────────

  const handleCreateAccount = async () => {
    setError('')
    if (!form.email || !form.password) { setError('Remplissez tous les champs.'); return }
    if (form.password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (form.password !== form.confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { role: 'tutor' } },
    })
    setLoading(false)

    if (err) {
      console.error('[Signup] Supabase error:', { message: err.message, status: err.status, code: err.code, name: err.name, raw: JSON.stringify(err) })
      const msg = err.message
      if (!msg || msg === '{}') setError('Erreur lors de la création du compte. Réessayez.')
      else if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) setError('Cet email est déjà utilisé. Connectez-vous plutôt.')
      else if (msg.toLowerCase().includes('rate limit')) setError('Trop de tentatives. Attendez quelques minutes.')
      else if (msg.toLowerCase().includes('invalid email')) setError('Adresse email invalide.')
      else setError(msg)
      return
    }
    if (!data.user) { setError('Erreur inattendue. Réessayez.'); return }

    setPendingEmail(form.email)
    setResendTimer(60)
    setStep(1)
  }

  // ── Étape 1 : Vérifier OTP ───────────────────────────────────

  const handleVerifyOtp = async () => {
    setError('')
    if (otpCode.replace(/\s/g, '').length !== 8) { setError('Entrez les 8 chiffres du code.'); return }

    setLoading(true)
    const result = await verifyOtp(pendingEmail, otpCode)
    setLoading(false)

    if (!result.success) { setError(result.error || 'Code invalide ou expiré.'); return }
    setStep(2)
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    await supabase.auth.resend({ type: 'signup', email: pendingEmail })
    setResent(true)
    setResendTimer(60)
    setTimeout(() => setResent(false), 4000)
  }

  // ── Soumission finale (étape 5 → selfie) ─────────────────────
  // Chaque étape a déjà sauvegardé ses données au fur et à mesure (voir
  // handleNext, persistDocPatch, persistDiplomas) — il ne reste qu'à
  // rafraîchir le profil local et afficher l'écran de confirmation.

  const handleSubmit = async () => {
    if (!currentUser?.id || !form.documents?.selfiePath) return
    setLoading(true)
    setError('')
    await refreshCurrentUser()
    setLoading(false)
    setSubmitted(true)
  }

  // ── Écran de succès ───────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-yellow-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Dossier soumis !</h1>
          <p className="text-gray-500 mb-3">
            Merci <strong>{form.firstName}</strong> ! Votre dossier est en cours de vérification. Vous serez notifié sous 24-48h.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 mb-6">
            <p className="font-semibold mb-1">En attendant la validation :</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>Votre profil est invisible des recherches</li>
              <li>Complétez votre biographie dans les paramètres</li>
              <li>Choisissez un abonnement pour être prêt</li>
            </ul>
          </div>
          <button onClick={() => router.push('/tableau-de-bord/repetiteur?welcome=1')} className="btn-primary">
            Accéder à mon tableau de bord
          </button>
        </div>
      </div>
    )
  }

  // ── Navigation ────────────────────────────────────────────────

  const canGoBack = step > 0 && step !== 1
  const goBack = () => {
    setError('')
    if (step > 2) setStep(step - 1)
    else if (step === 2) setStep(0) // retour avant OTP = retour au début
  }

  // ── Validations par étape ─────────────────────────────────────

  const canAdvance = (() => {
    if (step === 2) {
      const quartierOk = QUARTIERS_BY_CITY[form.city]?.length > 0 ? !!form.quartier : true
      return !!(form.firstName && form.lastName && form.phone && form.city && form.bio.trim() && quartierOk)
    }
    if (step === 3) return (isPrimaireOnly || form.subjects.length > 0) && form.levels.length > 0 && form.monthlyRate && form.modalities.length > 0
    if (step === 4) {
      const hasId = form.idType === 'cni'
        ? !!(form.documents?.cniRecto && form.documents?.cniVerso)
        : !!form.documents?.passport
      return hasId && diplomasReady
    }
    return true
  })()

  // ── Sauvegarde à chaque étape (survit à un refresh) ───────────
  const handleNext = async () => {
    setError('')
    if (!currentUser?.id) { setStep(s => s + 1); return }
    setStepSaving(true)
    let err = null
    if (step === 2) {
      const r1 = await supabase.from('profiles').update({
        first_name: form.firstName, last_name: form.lastName, phone: form.phone || null,
        city: form.city, quartier: form.quartier || null, avatar_color: form.avatarColor,
      }).eq('id', currentUser.id)
      const r2 = await supabase.from('tutors').update({ bio: form.bio }).eq('id', currentUser.id)
      err = r1.error || r2.error
    } else if (step === 3) {
      const r = await supabase.from('tutors').update({
        subjects: form.subjects, levels: form.levels,
        monthly_rate: parseInt(form.monthlyRate) || 0,
        modalities: form.modalities, availability: form.availability,
      }).eq('id', currentUser.id)
      err = r.error
    } else if (step === 4) {
      const r = await supabase.from('tutors').update({ documents: { ...form.documents, idType: form.idType } }).eq('id', currentUser.id)
      err = r.error
    }
    setStepSaving(false)
    if (err) { setError('Erreur lors de la sauvegarde. Réessayez.'); return }
    setStep(s => s + 1)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => {
              setError('')
              if (step === 0) router.push('/inscription')
              else if (canGoBack) goBack()
            }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Inscription Répétiteur</h1>
            <p className="text-gray-500 text-sm">Étape {step + 1} sur {STEPS.length}</p>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'bg-primary' : 'bg-gray-200'}`} />
              <p className={`text-xs hidden sm:block ${i === step ? 'text-primary font-semibold' : i < step ? 'text-primary/50' : 'text-gray-400'}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="card">

          {/* ── Étape 0 : Compte ──────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-primary-50 rounded-xl flex items-center justify-center">
                  <Mail size={16} className="text-primary" />
                </div>
                <h2 className="font-semibold text-lg text-gray-800">Créer votre compte</h2>
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email *</label>
                <input
                  id="reg-email"
                  type="email"
                  className="input-field"
                  placeholder="votre@email.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="reg-pwd" className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe * <span className="text-gray-400 font-normal">(8 caractères min.)</span></label>
                <div className="relative">
                  <input
                    id="reg-pwd"
                    type={showPwd ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe *</label>
                <div className="relative">
                  <input
                    id="reg-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    autoComplete="new-password"
                    onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
              <button
                onClick={handleCreateAccount}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Créer mon compte et recevoir le code'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Déjà inscrit ? <Link href="/connexion" className="text-primary font-medium hover:underline">Se connecter</Link>
              </p>
            </div>
          )}

          {/* ── Étape 1 : Vérification OTP ────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield size={28} className="text-primary" />
                </div>
                <h2 className="font-semibold text-lg text-gray-800 mb-1">Vérifiez votre email</h2>
                <p className="text-sm text-gray-500">
                  Un code à 8 chiffres a été envoyé à<br />
                  <strong className="text-gray-800">{pendingEmail}</strong>
                </p>
              </div>

              <OtpInput value={otpCode} onChange={setOtpCode} />

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">{error}</p>}
              {resent && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-center">Code renvoyé !</p>}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.replace(/\s/g,'').length < 8}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Vérifier le code'}
              </button>

              <p className="text-center text-sm text-gray-500">
                Pas reçu ?{' '}
                {resendTimer > 0 ? (
                  <span className="text-gray-400">Renvoyer dans {resendTimer}s</span>
                ) : (
                  <button onClick={handleResend} className="text-primary font-medium hover:underline">
                    Renvoyer le code
                  </button>
                )}
              </p>
              <p className="text-center text-xs text-gray-400">
                Mauvaise adresse ?{' '}
                <button onClick={() => { setStep(0); setOtpCode(''); setError('') }} className="text-primary hover:underline">
                  Modifier l'email
                </button>
              </p>
            </div>
          )}

          {/* ── Étape 2 : Informations personnelles ────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-gray-800">Informations personnelles</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-fn" className="block text-sm font-medium text-gray-700 mb-1.5">Prénom *</label>
                  <input id="reg-fn" className="input-field" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Amadou" />
                </div>
                <div>
                  <label htmlFor="reg-ln" className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
                  <input id="reg-ln" className="input-field" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Koné" />
                </div>
              </div>
              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone *</label>
                <input id="reg-phone" type="tel" className="input-field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="07 XX XX XX XX" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville *</label>
                <CityCombobox value={form.city} onChange={v => { set('city', v); set('quartier', '') }} />
              </div>
              {form.city && QUARTIERS_BY_CITY[form.city]?.length > 0 && (
                <div>
                  <label htmlFor="reg-quartier" className="block text-sm font-medium text-gray-700 mb-1.5">Quartier *</label>
                  <select id="reg-quartier" className="input-field" value={form.quartier} onChange={e => set('quartier', e.target.value)}>
                    <option value="">Sélectionner un quartier</option>
                    {QUARTIERS_BY_CITY[form.city].map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="reg-bio" className="block text-sm font-medium text-gray-700 mb-1.5">Biographie *</label>
                <textarea
                  id="reg-bio"
                  className="input-field resize-none h-28"
                  placeholder="Ex : Professeur de Mathématiques depuis 5 ans, diplômé de l'Université Félix Houphouët-Boigny. J'aide mes élèves à progresser grâce à une méthode pratique, avec des exercices adaptés à leur niveau et un suivi régulier des progrès..."
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  maxLength={600}
                />
                <p className="text-xs text-gray-400 mt-1">{form.bio.length}/600</p>
              </div>
            </div>
          )}

          {/* ── Étape 3 : Expertise ────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg text-gray-800">Expertise & disponibilités</h2>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Niveaux *</p>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map(l => (
                    <button key={l} type="button" onClick={() => toggleItem('levels', l)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${form.levels.includes(l) ? 'bg-secondary text-white border-secondary' : 'border-gray-200 text-gray-600 hover:border-secondary'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {isPrimaireOnly ? (
                <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <GraduationCap size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    En tant qu'enseignant du primaire, vous êtes polyvalent : pas besoin de sélectionner de matières, vous couvrez l'ensemble du programme primaire.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Matières enseignées *</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(s => (
                      <button key={s} type="button" onClick={() => toggleItem('subjects', s)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all ${form.subjects.includes(s) ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="reg-rate" className="block text-sm font-medium text-gray-700 mb-1.5">Tarif mensuel (FCFA) *</label>
                <input id="reg-rate" type="number" className="input-field" placeholder="25000" value={form.monthlyRate}
                  onChange={e => set('monthlyRate', e.target.value)} step="1000" min="0" />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Modalités *</p>
                <div className="grid grid-cols-2 gap-2">
                  {MODALITIES.map(m => (
                    <button key={m.id} type="button" onClick={() => toggleItem('modalities', m.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm transition-all text-left ${form.modalities.includes(m.id) ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {MODALITY_ICONS[m.id]}
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Disponibilités</p>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={selectAll} className="text-primary hover:underline">Tout sélectionner</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={clearAll} className="text-gray-400 hover:underline">Tout effacer</button>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="min-w-full text-xs border-separate" style={{ borderSpacing: '2px' }}>
                    <thead>
                      <tr>
                        <th className="w-8" />
                        {SLOTS.map(slot => (
                          <th key={slot} className="px-1 pb-1">
                            <button type="button" onClick={() => toggleColumn(slot)}
                              className="w-full text-gray-500 font-medium hover:text-primary transition-colors text-center leading-tight">
                              {slot}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day}>
                          <td>
                            <button type="button" onClick={() => toggleRow(day)}
                              className="w-8 text-center text-gray-500 font-medium hover:text-primary transition-colors py-1">
                              {DAY_LABELS[day]}
                            </button>
                          </td>
                          {SLOTS.map(slot => {
                            const active = form.availability[day].includes(slot)
                            return (
                              <td key={slot} className="px-0.5">
                                <button type="button" onClick={() => toggleAvailability(day, slot)}
                                  className={`w-full h-8 rounded-lg transition-colors ${active ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-gray-200'}`} />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Étape 4 : Documents ────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg text-gray-800">Pièces justificatives</h2>

              {/* Type pièce d'identité */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Type de pièce d'identité *</p>
                <div className="flex gap-3 mb-3">
                  {['cni', 'passport'].map(type => (
                    <button key={type} type="button" onClick={() => set('idType', type)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.idType === type ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {type === 'cni' ? 'CNI' : 'Passeport'}
                    </button>
                  ))}
                </div>

                {form.idType === 'cni' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">CNI Recto *</p>
                      <FileUploadZone
                        file={form.cniRectoFile}
                        existingPath={form.documents?.cniRectoPath}
                        uploading={uploadingDocs.cniRecto}
                        onFile={f => handleIdFile('cniRecto', f)}
                        inputRef={cniRectoRef}
                        label="Charger le recto"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">CNI Verso *</p>
                      <FileUploadZone
                        file={form.cniVersoFile}
                        existingPath={form.documents?.cniVersoPath}
                        uploading={uploadingDocs.cniVerso}
                        onFile={f => handleIdFile('cniVerso', f)}
                        inputRef={cniVersoRef}
                        label="Charger le verso"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Page photo du passeport *</p>
                    <FileUploadZone
                      file={form.passportFile}
                      existingPath={form.documents?.passportPath}
                      uploading={uploadingDocs.passport}
                      onFile={f => handleIdFile('passport', f)}
                      inputRef={passportRef}
                      label="Charger la page photo"
                    />
                  </div>
                )}
              </div>

              {/* Diplômes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Diplômes *</p>
                  <button type="button" onClick={() => set('diplomas', [...form.diplomas, { name: '', file: null, path: null, uploading: false }])}
                    className="text-xs font-semibold text-primary bg-primary-50 hover:bg-primary-100 flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors">
                    <Plus size={13} /> Ajouter un diplôme
                  </button>
                </div>
                <div className="space-y-3">
                  {form.diplomas.map((d, i) => {
                    const hasContent = !!d.file || !!d.path
                    const partialError = (d.name.trim() && !hasContent) || (!d.name.trim() && hasContent)
                    const removeDiploma = async () => {
                      const next = form.diplomas.filter((_, idx) => idx !== i)
                      set('diplomas', next.length > 0 ? next : [{ name: '', file: null, path: null, uploading: false }])
                      await persistDiplomas()
                    }
                    const clearFile = async () => {
                      const next = [...form.diplomas]
                      next[i] = { ...next[i], file: null, path: null }
                      set('diplomas', next)
                      await persistDiplomas()
                    }
                    return (
                      <div key={i} className={`space-y-2 p-3 rounded-xl border ${partialError ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          <input
                            className={`input-field text-sm flex-1 uppercase ${partialError ? 'border-orange-300' : ''}`}
                            placeholder={`Intitulé diplôme ${i + 1} (ex: Licence Mathématiques)`}
                            value={d.name}
                            onChange={e => {
                              const next = [...form.diplomas]
                              next[i] = { ...next[i], name: e.target.value.toUpperCase() }
                              set('diplomas', next)
                            }}
                          />
                          {(d.name || hasContent || form.diplomas.length > 1) && (
                            <button type="button" onClick={removeDiploma} aria-label="Supprimer ce diplôme"
                              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <X size={15} />
                            </button>
                          )}
                        </div>
                        {d.name.trim() && (
                          <>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              className="hidden"
                              id={`diploma-file-${i}`}
                              onChange={e => handleDiplomaFile(i, e.target.files?.[0] || null)}
                            />
                            {d.uploading ? (
                              <div className="w-full border-2 border-dashed border-primary/40 bg-primary-50/40 rounded-xl p-2.5 flex items-center gap-2 text-xs text-gray-500">
                                <RefreshCw size={14} className="text-primary animate-spin flex-shrink-0" /> Envoi en cours…
                              </div>
                            ) : hasContent ? (
                              <div className="w-full border-2 border-dashed border-green-400 bg-green-50 rounded-xl p-2.5 flex items-center gap-2 text-xs text-green-700">
                                <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                                <button type="button" onClick={() => document.getElementById(`diploma-file-${i}`)?.click()} className="flex-1 text-left truncate hover:underline">
                                  {d.file ? d.file.name : 'Fichier déjà envoyé'}
                                </button>
                                <button type="button" onClick={clearFile} aria-label="Supprimer le fichier"
                                  className="flex-shrink-0 text-green-600 hover:text-red-500 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => document.getElementById(`diploma-file-${i}`)?.click()}
                                className="w-full border-2 border-dashed rounded-xl p-2.5 flex items-center gap-2 text-xs transition-all border-gray-300 hover:border-primary text-gray-500">
                                <Upload size={14} /> Fichier du diplôme *
                              </button>
                            )}
                          </>
                        )}
                        {partialError && (
                          <p className="text-xs text-orange-600">L'intitulé et le fichier sont tous les deux requis.</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!diplomasReady && form.diplomas.every(d => !d.name && !d.file && !d.path) && (
                  <p className="text-xs text-gray-400 mt-1">Ajoutez au moins un diplôme avec son fichier.</p>
                )}
              </div>
            </div>
          )}

          {/* ── Étape 5 : Selfie ───────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-lg text-gray-800 mb-1">Selfie avec un justificatif d'identité</h2>
                <p className="text-sm text-gray-500">Tenez votre pièce d'identité bien visible à côté de votre visage.</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                {form.selfieDataUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <img src={form.selfieDataUrl} alt="selfie" className="w-56 h-44 object-cover rounded-xl border-2 border-green-300" />
                      {selfieUploading && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                          <RefreshCw size={22} className="text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    {selfieUploading ? (
                      <p className="text-xs text-gray-400">Envoi du selfie en cours…</p>
                    ) : (
                      <button type="button" onClick={() => { set('selfieDataUrl', null); startCamera() }}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                        <RefreshCw size={14} /> Reprendre la photo
                      </button>
                    )}
                  </div>
                ) : cameraActive ? (
                  <div className="flex flex-col items-center gap-4">
                    <video ref={videoRef} autoPlay playsInline className="w-full max-w-xs rounded-xl" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-3">
                      <button type="button" onClick={capturePhoto} className="btn-primary px-6">Capturer</button>
                      <button type="button" onClick={stopCamera} className="btn-outline px-4">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                      <Camera size={28} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-400 text-center max-w-xs">
                      Activez la caméra et prenez un selfie en tenant votre pièce d'identité visible.
                    </p>
                    <button type="button" onClick={startCamera}
                      className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                      <Camera size={16} /> Activer la caméra
                    </button>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={loading || selfieUploading || !form.documents?.selfiePath}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Envoi en cours…</>
                  : 'Soumettre mon dossier'
                }
              </button>
              {!form.documents?.selfiePath && !selfieUploading && (
                <p className="text-center text-xs text-gray-400">Le selfie est requis pour compléter l'inscription.</p>
              )}
            </div>
          )}

          {/* Bouton Suivant (étapes 2, 3, 4) */}
          {step >= 2 && step <= 4 && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{error}</p>}
              <button
                onClick={handleNext}
                disabled={!canAdvance || stepSaving}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stepSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Suivant →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
