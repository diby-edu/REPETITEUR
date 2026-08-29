'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/layout/DashboardLayout'
import { GraduationCap, ChevronLeft, Plus, X, CheckCircle, MapPin, Users } from 'lucide-react'
import { formatFCFA, filterPhoneAndEmail } from '../utils/helpers'

// Défini au niveau module (référence stable) pour éviter le remount du sous-arbre
// à chaque rendu — sinon les champs du formulaire perdraient le focus à la frappe.
function RecruitShell({ children }) {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">{children}</div>
    </DashboardLayout>
  )
}

export default function RecruitPage() {
  const { id } = useParams()
  const router = useRouter()
  const { getTutor, createEngagement, levelPackages, showToast, tutors } = useApp()
  const { currentUser } = useAuth()

  const [children, setChildren] = useState([{ label: '', levelKey: '' }])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState({ open: false, count: 0 })

  const tutor = getTutor(id)

  useEffect(() => {
    if (currentUser && currentUser.role !== 'parent') router.replace('/tableau-de-bord/repetiteur')
  }, [currentUser, router])

  const addChild = () => setChildren(c => [...c, { label: '', levelKey: '' }])
  const removeChild = (i) => setChildren(c => c.length > 1 ? c.filter((_, idx) => idx !== i) : c)
  const setChild = (i, patch) => setChildren(c => c.map((ch, idx) => idx === i ? { ...ch, ...patch } : ch))

  const initials = `${tutor?.firstName?.[0] || ''}${tutor?.lastName?.[0] || ''}`.toUpperCase()
  const offers = tutor?.offers || []
  const total = children.reduce((s, ch) => {
    const o = offers.find(off => off.levelKey === ch.levelKey)
    return s + (o?.monthlyPrice || 0)
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const valid = children.filter(c => c.levelKey)
    if (valid.length === 0) { showToast('Indiquez au moins la classe d\'un enfant.', 'error'); return }
    if (message && filterPhoneAndEmail(message) !== message) {
      showToast('Vous ne pouvez pas partager vos coordonnées avant le contrat.', 'error'); return
    }
    setSubmitting(true)
    let ok = 0
    for (const ch of valid) {
      const offer = offers.find(o => o.levelKey === ch.levelKey)
      if (!offer) continue
      const eng = await createEngagement({
        parentId: currentUser.id,
        tutorId: tutor.id,
        levelKey: offer.levelKey,
        subjects: offer.subjects,
        monthlyRate: offer.monthlyPrice,
        childLabel: ch.label?.trim() || null,
        notes: message?.trim() || null,
        silent: true,
      })
      if (eng) ok++
    }
    setSubmitting(false)
    if (ok > 0) { setSubmitted({ open: true, count: ok }); showToast(`Demande envoyée pour ${ok} enfant${ok > 1 ? 's' : ''} !`) }
    else showToast('Erreur lors de l\'envoi de la demande.', 'error')
  }

  // ── États d'erreur ─────────────────────────────────────────
  if (!tutor) {
    return (
      <RecruitShell>
        {tutors.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Chargement…</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">Répétiteur introuvable</p>
            <Link href="/recherche" className="btn-primary mt-4 inline-block">Retour à la recherche</Link>
          </div>
        )}
      </RecruitShell>
    )
  }

  const recruitable = tutor.verificationStatus === 'verified' && !tutor.suspended

  if (!recruitable || offers.length === 0) {
    return (
      <RecruitShell>
        <Link href={`/repetiteur/${tutor.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft size={18} /> Retour au profil
        </Link>
        <div className="card text-center py-12">
          <Users size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {offers.length === 0 ? "Ce répétiteur n'a pas encore défini de tarif." : "Ce répétiteur n'est pas disponible actuellement."}
          </p>
        </div>
      </RecruitShell>
    )
  }

  // ── Succès ─────────────────────────────────────────────────
  if (submitted.open) {
    return (
      <RecruitShell>
        <div className="card text-center py-12 max-w-lg mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="font-display text-xl font-bold text-gray-900">Demande envoyée !</h1>
          <p className="text-gray-500 text-sm mt-2">
            Votre demande pour {submitted.count} enfant{submitted.count > 1 ? 's' : ''} a été transmise à {tutor.firstName} {tutor.lastName}.
            La messagerie s'ouvrira dès qu'il·elle accepte. Vous réglez à la fin de chaque mois.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
            <Link href="/reservations" className="btn-primary text-sm">Voir mes demandes</Link>
            <Link href="/recherche" className="btn-outline text-sm">Continuer à chercher</Link>
          </div>
        </div>
      </RecruitShell>
    )
  }

  // ── Formulaire ─────────────────────────────────────────────
  return (
    <RecruitShell>
      <Link href={`/repetiteur/${tutor.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft size={18} /> Retour au profil
      </Link>

      {/* En-tête répétiteur */}
      <div className="card flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0">
          {tutor.avatarUrl
            ? <img src={tutor.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center font-display font-bold text-white text-lg"
                   style={{ background: `linear-gradient(140deg, ${tutor.avatarColor || '#2D6A4F'}, rgba(0,0,0,.25))` }}>{initials}</div>}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold text-gray-900 truncate">Je recrute {tutor.firstName} {tutor.lastName}</h1>
          <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><MapPin size={12} />{tutor.quartier}, {tutor.city}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Enfants */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <GraduationCap size={18} className="text-primary" /> Le·s enfant·s à encadrer
            </h2>
            <span className="text-xs text-gray-400">{children.length} enfant{children.length > 1 ? 's' : ''}</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Ajoutez un bloc par enfant. Chaque enfant donne lieu à un contrat distinct, au tarif de sa classe.</p>

          <div className="space-y-3">
            {children.map((ch, i) => {
              const offer = offers.find(o => o.levelKey === ch.levelKey)
              return (
                <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Enfant {i + 1}</span>
                    {children.length > 1 && (
                      <button type="button" onClick={() => removeChild(i)} className="text-gray-300 hover:text-red-500" title="Retirer cet enfant"><X size={16} /></button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <input
                      className="input-field text-sm py-2.5"
                      placeholder="Prénom ou surnom de l'enfant (ex. Junior)"
                      value={ch.label}
                      onChange={e => setChild(i, { label: e.target.value })}
                    />
                    <select
                      className="input-field text-sm py-2.5"
                      value={ch.levelKey}
                      onChange={e => setChild(i, { levelKey: e.target.value })}
                    >
                      <option value="">Choisir la classe de l'enfant</option>
                      {offers.map(o => {
                        const pkg = levelPackages.find(p => p.levelKey === o.levelKey)
                        return <option key={o.levelKey} value={o.levelKey}>{(pkg?.label || o.levelKey)} — {formatFCFA(o.monthlyPrice)}/mois</option>
                      })}
                    </select>
                  </div>
                  {offer && <p className="text-[11px] text-primary font-semibold mt-2">Tarif : {formatFCFA(offer.monthlyPrice)}/mois</p>}
                </div>
              )
            })}
          </div>

          <button type="button" onClick={addChild} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline mt-3">
            <Plus size={16} /> Ajouter un autre enfant
          </button>
        </div>

        {/* Message */}
        <div className="card">
          <label className="block font-semibold text-gray-900 mb-1.5">Message au répétiteur</label>
          <p className="text-xs text-gray-500 mb-2">Présentez-vous et décrivez vos attentes (niveau, objectifs, disponibilités…).</p>
          <textarea
            className="input-field h-32 resize-none text-sm"
            placeholder="Ex : Bonjour, je cherche un professeur sérieux pour mon fils en 6ᵉ, surtout en maths. Il est disponible les soirs de semaine.  ⚠️ Ne partagez pas vos coordonnées (téléphone, email) : c'est interdit tant que le contrat n'est pas accepté."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        {/* Récap + envoi */}
        <div className="card flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-gray-500">Total mensuel estimé</p>
            <p className="font-display text-xl font-extrabold text-primary">{formatFCFA(total)}<span className="text-xs font-normal text-gray-400">/mois</span></p>
            <p className="text-[11px] text-gray-400 mt-0.5">Le répétiteur doit accepter. La messagerie s'ouvre après acceptation. Vous réglez à la fin de chaque mois.</p>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto whitespace-nowrap disabled:opacity-60">
            {submitting ? 'Envoi…' : '🎯 Envoyer ma demande'}
          </button>
        </div>
      </form>
    </RecruitShell>
  )
}
