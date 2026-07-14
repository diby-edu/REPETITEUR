'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, LEVELS, CITIES, QUARTIERS_BY_CITY } from '../data/constants'
import { MODALITIES } from '../utils/helpers'
import { CheckCircle, ChevronLeft, Upload, Clock, Info, Home, Building2, Users, Wifi, FileText } from 'lucide-react'

const MODALITY_ICONS = {
  domicile_parent: <Home size={18} />,
  domicile_repetiteur: <Building2 size={18} />,
  lieu_neutre: <Users size={18} />,
  en_ligne: <Wifi size={18} />,
}

const steps = ['Informations', 'Expertise', 'Documents', 'Confirmation']

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const HOURS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
const DAY_LABELS = { lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim' }

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
    city: '', quartier: '', bio: '',
    subjects: [], levels: [], monthlyRate: '', modalities: [],
    availability: { lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [], dimanche: [] },
    cniFile: null, diplomaFile: null,
  })
  const cniInputRef = useRef(null)
  const diplomaInputRef = useRef(null)

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const toggleItem = (key, item) => {
    set(key, form[key].includes(item) ? form[key].filter(x => x !== item) : [...form[key], item])
  }

  const toggleAvailability = (day, hour) => {
    const current = form.availability[day]
    const updated = current.includes(hour) ? current.filter(h => h !== hour) : [...current, hour]
    set('availability', { ...form.availability, [day]: updated })
  }

  const quartiers = form.city ? (QUARTIERS_BY_CITY[form.city] || []) : []

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    // 1. Créer le compte
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
    const documents = { cni: false, diplomes: [] }

    // 2. Uploader CNI
    if (form.cniFile) {
      const ext = form.cniFile.name.split('.').pop()
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(`${userId}/cni.${ext}`, form.cniFile, { upsert: true })
      if (!uploadErr) documents.cni = true
    }

    // 3. Uploader diplôme
    if (form.diplomaFile) {
      const ext = form.diplomaFile.name.split('.').pop()
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(`${userId}/diplome.${ext}`, form.diplomaFile, { upsert: true })
      if (!uploadErr) documents.diplomes = [form.diplomaFile.name]
    }

    // 4. Mettre à jour les documents en DB
    await supabase.from('tutors').update({ documents }).eq('id', userId)

    setLoading(false)
    setSubmitted(true)
  }

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
            Merci <strong>{form.firstName}</strong> ! Votre dossier est en cours de vérification par notre équipe. Vous serez notifié sous 24-48h.
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

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/inscription" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Inscription Répétiteur</h1>
            <p className="text-gray-500 text-sm">Étape {step + 1} sur {steps.length}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col gap-1">
              <div className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? 'bg-primary' : 'bg-gray-200'}`} />
              <p className={`text-xs ${i === step ? 'text-primary font-semibold' : 'text-gray-400'} hidden sm:block`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="card">
          {/* Step 1: Personal info */}
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
                  <select className="input-field" value={form.city} onChange={e => { set('city', e.target.value); set('quartier', '') }}>
                    <option value="">Ville</option>
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Quartier *</label>
                  <select className="input-field" value={form.quartier} onChange={e => set('quartier', e.target.value)} disabled={!quartiers.length}>
                    <option value="">Quartier</option>
                    {quartiers.map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
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
                disabled={!form.firstName || !form.lastName || !form.email || !form.city || !form.bio}
                className="btn-primary w-full disabled:opacity-50"
              >
                Continuer
              </button>
            </div>
          )}

          {/* Step 2: Expertise */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tarif horaire (FCFA) *</label>
                <input type="number" className="input-field" value={form.monthlyRate} onChange={e => set('monthlyRate', e.target.value)} placeholder="Ex: 30000" min="5000" max="200000" step="1000" />
                <p className="text-xs text-gray-400 mt-1">Tarif recommandé : 15 000 – 80 000 FCFA/mois</p>
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
                <p className="text-xs text-gray-400 mt-2">Sélectionnez toutes les modalités que vous acceptez</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <span className="flex items-center gap-2"><Clock size={16} />Disponibilités</span>
                </label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left text-gray-500 font-medium py-1 pr-2 w-10"></th>
                        {HOURS.slice(0, 8).map(h => (
                          <th key={h} className="text-gray-400 font-normal py-1 px-0.5 text-center">{h.slice(0, 2)}h</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr key={day}>
                          <td className="text-gray-600 font-medium py-1 pr-2">{DAY_LABELS[day]}</td>
                          {HOURS.slice(0, 8).map(h => (
                            <td key={h} className="py-1 px-0.5">
                              <button
                                type="button"
                                onClick={() => toggleAvailability(day, h)}
                                className={`w-7 h-7 rounded-lg transition-colors ${form.availability[day].includes(h) ? 'bg-primary' : 'bg-gray-100 hover:bg-gray-200'}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-2">Cliquez sur les cases pour indiquer vos créneaux disponibles (orange = disponible)</p>
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

          {/* Step 3: Documents */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg text-gray-800">Documents de vérification</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Ces documents permettent de vérifier votre identité et vos qualifications. Votre profil sera validé sous 24-48h après soumission.
                </p>
              </div>

              {/* CNI */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pièce d'identité (CNI / Passeport) *</label>
                <input
                  ref={cniInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={e => set('cniFile', e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => cniInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 transition-all cursor-pointer ${
                    form.cniFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'
                  }`}
                >
                  {form.cniFile ? (
                    <>
                      <FileText size={32} className="text-green-500" />
                      <span className="text-sm font-medium text-green-700">{form.cniFile.name}</span>
                      <span className="text-xs text-gray-400">Cliquez pour changer</span>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">Cliquez pour sélectionner votre CNI</span>
                      <span className="text-xs text-gray-400">JPG, PNG ou PDF — max 5 Mo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Diplomas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Diplôme(s) *</label>
                <input
                  ref={diplomaInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={e => set('diplomaFile', e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => diplomaInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 transition-all cursor-pointer ${
                    form.diplomaFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'
                  }`}
                >
                  {form.diplomaFile ? (
                    <>
                      <FileText size={32} className="text-green-500" />
                      <span className="text-sm font-medium text-green-700">{form.diplomaFile.name}</span>
                      <span className="text-xs text-gray-400">Cliquez pour changer</span>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">Cliquez pour sélectionner votre diplôme</span>
                      <span className="text-xs text-gray-400">JPG, PNG ou PDF — max 5 Mo</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-outline flex-1">Retour</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!form.cniFile || !form.diplomaFile}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-gray-800">Récapitulatif</h2>
              <div className="bg-primary-50 rounded-xl p-4 space-y-2">
                {[
                  ['Nom', `${form.firstName} ${form.lastName}`],
                  ['Ville', `${form.quartier ? form.quartier + ', ' : ''}${form.city}`],
                  ['Matières', form.subjects.join(', ')],
                  ['Niveaux', form.levels.join(', ')],
                  ['Tarif mensuel', `${parseInt(form.monthlyRate || 0).toLocaleString('fr-FR')} FCFA/mois`],
                  ['Modalités', form.modalities.map(m => ({ domicile_parent: 'Dom. parent', domicile_repetiteur: 'Dom. répétiteur', lieu_neutre: 'Lieu neutre', en_ligne: 'En ligne' })[m]).join(', ')],
                  ['Documents', `${form.cniFile?.name || '—'} + ${form.diplomaFile?.name || '—'}`],
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
                <button onClick={() => setStep(2)} className="btn-outline flex-1" disabled={loading}>Retour</button>
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
