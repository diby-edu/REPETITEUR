'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SUBJECTS, LEVELS } from '../data/constants'
import CityCombobox from '../components/common/CityCombobox'
import { CheckCircle, ChevronLeft, Mail, Shield } from 'lucide-react'

const steps = ['Informations personnelles', 'Préférences', 'Confirmation']

// ── OTP Input 8 cases (4+4) ───────────────────────────────────────

function OtpInput({ value, onChange }) {
  const refs = useRef([])
  const len = 8
  const chars = value.padEnd(len, ' ').split('').slice(0, len)

  const update = (i, char) => {
    const next = [...chars]
    next[i] = char
    onChange(next.join('').replace(/\s+/g, ''))
  }

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 justify-center"
      onPaste={e => {
        e.preventDefault()
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, len)
        onChange(text)
        refs.current[Math.min(text.length, len - 1)]?.focus()
      }}
    >
      {chars.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5 sm:gap-2">
          <input
            ref={el => { refs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={c}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(-1)
              update(i, v)
              if (v && i < len - 1) refs.current[i + 1]?.focus()
            }}
            onKeyDown={e => {
              if (e.key === 'Backspace') {
                if (!c && i > 0) { update(i - 1, ''); refs.current[i - 1]?.focus() }
                else update(i, '')
              }
            }}
            className="w-9 h-12 sm:w-10 sm:h-13 text-center text-lg font-bold border-2 rounded-xl outline-none focus:border-secondary transition-colors bg-white text-gray-900"
          />
          {i === 3 && <div className="w-3 h-0.5 bg-gray-300 rounded flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────

export default function RegisterParentPage() {
  const { register, verifyOtp } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [showOtp, setShowOtp] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [resendTimer, setResendTimer] = useState(60)
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    city: '', childLevel: '', searchedSubjects: [],
    openToContact: true, password: '',
  })

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const toggleSubject = (s) => {
    set('searchedSubjects', form.searchedSubjects.includes(s)
      ? form.searchedSubjects.filter(x => x !== s)
      : [...form.searchedSubjects, s])
  }

  // Timer de renvoi OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendTimer])

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const result = await register({
      email: form.email,
      password: form.password,
      role: 'parent',
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      city: form.city,
      avatarColor: '#16A085',
      subjectsNeeded: form.searchedSubjects,
      childLevel: form.childLevel,
      openToContact: form.openToContact,
    })
    setLoading(false)
    if (!result.success) {
      setError(result.error || 'Erreur lors de la création du compte.')
      return
    }
    if (result.emailConfirmation) {
      setShowOtp(true)
      setResendTimer(60)
      return
    }
    setSubmitted(true)
  }

  const handleVerifyOtp = async () => {
    setError('')
    if (otpCode.replace(/\s/g, '').length !== 8) { setError('Entrez les 8 chiffres du code.'); return }
    setLoading(true)
    const result = await verifyOtp(form.email, otpCode)
    setLoading(false)
    if (!result.success) { setError(result.error || 'Code invalide ou expiré.'); return }
    setSubmitted(true)
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setError('')
    setResent(false)
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: form.email })
    if (err) { setError('Impossible de renvoyer le code.'); return }
    setOtpCode('')
    setResent(true)
    setResendTimer(60)
  }

  // ── Écran OTP ─────────────────────────────────────────────────

  if (showOtp) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="w-16 h-16 bg-secondary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-secondary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-gray-900 mb-1">Vérifiez votre email</h1>
            <p className="text-sm text-gray-500 mb-6">
              Un code à 8 chiffres a été envoyé à<br />
              <strong className="text-gray-800">{form.email}</strong>
            </p>

            <OtpInput value={otpCode} onChange={setOtpCode} />

            <div className="mt-6 space-y-3">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
              {resent && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 py-2">Code renvoyé !</p>}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.replace(/\s/g, '').length < 8}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Vérifier le code'}
              </button>

              <p className="text-sm text-gray-500">
                Pas reçu ?{' '}
                {resendTimer > 0
                  ? <span className="text-gray-400">Renvoyer dans {resendTimer}s</span>
                  : <button onClick={handleResend} className="text-secondary font-medium hover:underline">Renvoyer</button>
                }
              </p>
              <p className="text-sm text-gray-400">
                Mauvaise adresse ?{' '}
                <button onClick={() => { setShowOtp(false); setStep(0); setOtpCode('') }} className="text-secondary font-medium hover:underline">
                  Modifier l'email
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Écran de succès ────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Compte créé !</h1>
          <p className="text-gray-500 mb-6">
            Bienvenue sur MonRépétiteur, <strong>{form.firstName}</strong> ! Votre compte parent est actif.
          </p>
          <button onClick={() => router.push('/tableau-de-bord/parent')} className="btn-secondary">
            Accéder à mon tableau de bord
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => step === 0 ? router.push('/inscription') : setStep(step - 1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Inscription Parent</h1>
            <p className="text-gray-500 text-sm">Étape {step + 1} sur {steps.length}</p>
          </div>
        </div>

        {/* Progress — cliquable pour les étapes déjà visitées */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`flex-1 flex flex-col gap-1 text-left ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? 'bg-secondary' : 'bg-gray-200'}`} />
              <p className={`text-xs ${i === step ? 'text-secondary font-semibold' : i < step ? 'text-secondary/60 hover:text-secondary' : 'text-gray-400'}`}>{s}</p>
            </button>
          ))}
        </div>

        <div className="card">
          {/* Step 1: Infos personnelles */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom *</label>
                  <input className="input-field" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Aminata" />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ville *</label>
                <CityCombobox value={form.city} onChange={city => set('city', city)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe *</label>
                <input type="password" className="input-field" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!form.firstName || !form.lastName || !form.email || !form.city}
                className="btn-secondary w-full disabled:opacity-50"
              >
                Continuer
              </button>
            </div>
          )}

          {/* Step 2: Préférences */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Niveau scolaire de votre enfant *</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEVELS.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => set('childLevel', l)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        form.childLevel === l
                          ? 'border-secondary bg-secondary-50 text-secondary'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Matières recherchées (optionnel)</label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        form.searchedSubjects.includes(s)
                          ? 'bg-secondary border-secondary text-white'
                          : 'border-gray-200 text-gray-600 hover:border-secondary hover:text-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.openToContact}
                    onChange={e => set('openToContact', e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-secondary flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Accepter d'être contacté par des répétiteurs</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Les répétiteurs correspondant à votre profil pourront vous envoyer un message en premier. Vous restez libre d'accepter ou d'ignorer.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(0)} className="btn-outline flex-1">Retour</button>
                <button onClick={() => setStep(2)} disabled={!form.childLevel} className="btn-secondary flex-1 disabled:opacity-50">
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-secondary-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-800">Récapitulatif</h3>
                {[
                  ['Nom complet', `${form.firstName} ${form.lastName}`],
                  ['Email', form.email],
                  ['Téléphone', form.phone || '—'],
                  ['Ville', form.city],
                  ['Niveau de l\'enfant', form.childLevel],
                  ['Matières recherchées', form.searchedSubjects.join(', ') || 'Non spécifié'],
                  ['Ouvert aux contacts répétiteurs', form.openToContact ? 'Oui' : 'Non'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                En créant votre compte, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
              </p>
              {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-outline flex-1" disabled={loading}>Retour</button>
                <button onClick={handleSubmit} disabled={loading} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Créer mon compte'}
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
