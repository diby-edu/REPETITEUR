export function formatFCFA(amount) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(timestamp) {
  if (!timestamp) return ''
  const now = new Date()
  const past = new Date(timestamp)
  const diff = now - past
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  if (hours < 24) return `il y a ${hours}h`
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  return formatDateShort(timestamp)
}

export function getInitials(firstName, lastName) {
  const f = (firstName || '').charAt(0).toUpperCase()
  const l = (lastName || '').charAt(0).toUpperCase()
  return f + l
}

export function getFullName(user) {
  if (!user) return ''
  return `${user.firstName} ${user.lastName}`
}

export function getSubscriptionDaysLeft(endDate) {
  if (!endDate) return 0
  const end = new Date(endDate)
  const now = new Date()
  const diff = end - now
  return Math.max(0, Math.ceil(diff / 86400000))
}

export function filterPhoneAndEmail(text) {
  let filtered = text
  // Emails standards
  filtered = filtered.replace(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    '[email masqué]'
  )
  // Emails obfusqués : "nom (at) gmail (point) com" — parenthèses/crochets requis
  // pour éviter les faux positifs sur du texte normal.
  filtered = filtered.replace(
    /[a-zA-Z0-9._%+\-]{2,}\s*[\(\[]\s*(?:@|at|arobase)\s*[\)\]]\s*[a-zA-Z0-9.\-]{2,}\s*[\(\[]\s*(?:\.|point|dot)\s*[\)\]]\s*[a-zA-Z]{2,}/gi,
    '[email masqué]'
  )
  // Numéros de téléphone (avec ou sans séparateurs)
  filtered = filtered.replace(/(\+?\d[\d\s\-.()]{6,}\d)/g, '[numéro masqué]')
  // Longues séquences de chiffres collés (8+)
  filtered = filtered.replace(/\b\d{8,}\b/g, '[numéro masqué]')
  return filtered
}

// Répétiteur « réactif » : assez de données + taux élevé + réponse rapide.
// stats = { responded, responseRate (0-1), avgHours }
export const isFastResponder = (stats) =>
  !!stats && (stats.responded || 0) >= 3 && (stats.responseRate || 0) >= 0.8 &&
  stats.avgHours != null && stats.avgHours <= 24

// Abonnement payant actif (Standard/Premium en cours).
export const hasActivePaidSub = (t) =>
  t?.subscription?.status === 'active' &&
  !!t?.subscription?.plan && t.subscription.plan !== 'gratuit'

// V1 « seed-then-gate » : un répétiteur est VISIBLE (recherche + listes) s'il est
// vérifié, non suspendu, ET (fondateur OU abonné payant actif). La recrutabilité
// (bouton « Je recrute ») reste, elle, `vérifié && !suspendu` — un profil atteint
// par lien direct reste recrutable même s'il n'apparaît pas dans les recherches.
export const isTutorVisible = (t) =>
  t?.verificationStatus === 'verified' && !t?.suspended &&
  (t?.isFounder || hasActivePaidSub(t))

// Inscription terminée ? Un utilisateur connecté mais dont l'inscription n'est
// PAS finie (répétiteur sans KYC, parent sans identité) doit être renvoyé finir
// avant d'accéder à l'app. Distingue « incomplet » de « complet en attente de vérif ».
export function isRegistrationComplete(user) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'parent') {
    return !!(user.firstName && user.lastName && user.city)
  }
  if (user.role === 'tutor') {
    // Déjà passé par la revue admin (vérifié ou rejeté) → forcément past-inscription.
    // Protège les tuteurs existants (même sans photo) contre un blocage à tort.
    if (user.verificationStatus === 'verified' || user.verificationStatus === 'rejected') return true
    const docs = user.documents || {}
    const basic = !!(user.firstName && user.lastName && user.phone && user.city && user.bio?.trim() && user.avatarUrl)
    const primaireOnly = user.levels?.length === 1 && user.levels[0] === 'Primaire'
    const expertise = (user.levels?.length > 0) && (primaireOnly || user.subjects?.length > 0) &&
      user.monthlyRate > 0 && (user.modalities?.length > 0)
    const hasId = docs.idType === 'cni' ? !!(docs.cniRecto && docs.cniVerso)
      : docs.idType === 'passport' ? !!docs.passport : false
    const hasDocuments = hasId && (docs.diplomes?.length > 0)
    const hasSelfie = !!docs.selfiePath
    return basic && expertise && hasDocuments && hasSelfie
  }
  return true
}

// Où renvoyer un utilisateur pour TERMINER son inscription.
//  • répétiteur → le flux d'inscription (reprend le KYC multi-étapes)
//  • parent     → ses réglages (il ne manque que nom/ville → il complète + enregistre)
export const registrationResumePath = (user) =>
  user?.role === 'tutor' ? '/inscription/repetiteur' : '/parametres'

export function getStatusLabel(status) {
  const labels = {
    pending: 'En attente',
    verified: 'Vérifié',
    rejected: 'Rejeté',
    active: 'Actif',
    expired: 'Expiré',
    confirmed: 'Confirmée',
    completed: 'Terminée',
    cancelled: 'Annulée',
    gratuit: 'Gratuit',
    standard: 'Standard',
    premium: 'Premium',
  }
  return labels[status] || status
}

export function getVerificationStatusColor(status) {
  const colors = {
    pending: 'yellow',
    verified: 'green',
    rejected: 'red',
  }
  return colors[status] || 'gray'
}

export function getBookingStatusColor(status) {
  const colors = {
    pending: 'yellow',
    confirmed: 'blue',
    completed: 'green',
    cancelled: 'red',
    rejected: 'red',
  }
  return colors[status] || 'gray'
}

export function getDayLabel(day) {
  const labels = {
    lundi: 'Lundi',
    mardi: 'Mardi',
    mercredi: 'Mercredi',
    jeudi: 'Jeudi',
    vendredi: 'Vendredi',
    samedi: 'Samedi',
    dimanche: 'Dimanche',
  }
  return labels[day] || day
}

export const MODALITIES = [
  { id: 'domicile_parent', label: 'Domicile du parent', desc: 'Je me déplace chez l\'élève' },
  { id: 'domicile_repetiteur', label: 'Domicile du répétiteur', desc: 'L\'élève vient chez moi' },
  { id: 'lieu_neutre', label: 'Lieu neutre', desc: 'Bibliothèque, école, espace d\'étude, café...' },
  { id: 'en_ligne', label: 'En ligne', desc: 'Cours à distance par visioconférence' },
]

export function getLocationLabel(location) {
  const labels = {
    domicile_parent: 'Domicile du parent',
    domicile_repetiteur: 'Domicile du répétiteur',
    lieu_neutre: 'Lieu neutre',
    en_ligne: 'En ligne',
  }
  return labels[location] || location
}

export function getRatingColor(rating) {
  if (rating >= 4.5) return 'text-green-600'
  if (rating >= 4.0) return 'text-primary'
  if (rating >= 3.0) return 'text-yellow-600'
  return 'text-red-500'
}

export function truncate(text, maxLength = 120) {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength).trimEnd() + '...'
}

// Décompose le dossier d'un répétiteur en items individuellement révisables
// (pièce d'identité, selfie, chaque diplôme) pour l'affichage du statut
// détaillé et de la barre de progression d'approbation.
export function getDocumentApprovalProgress(documents, isVerified = false) {
  const docs = documents || {}
  const isPassport = docs.idType === 'passport'
  const idSubmitted = isPassport ? !!docs.passport : !!(docs.cniRecto && docs.cniVerso)
  const diplomas = docs.diplomes || []
  // Un profil « vérifié » implique que ses pièces sont acceptées : on force
  // l'affichage « approuvé » (évite l'incohérence Vérifié + pièce « En attente »).
  const st = (raw) => (isVerified ? 'approved' : (raw || 'pending'))

  const items = []
  if (idSubmitted) {
    items.push({
      key: 'id', label: isPassport ? 'Passeport' : 'CNI (recto + verso)',
      status: st(docs.idReview?.status), reason: docs.idReview?.reason,
    })
  }
  if (docs.selfiePath) {
    items.push({ key: 'selfie', label: 'Selfie avec pièce', status: st(docs.selfieReview?.status), reason: docs.selfieReview?.reason })
  }
  diplomas.forEach((d, i) => {
    if (d.path) items.push({ key: `diploma-${i}`, label: d.name || `Diplôme ${i + 1}`, status: st(d.review?.status), reason: d.review?.reason })
  })

  const total = items.length
  const approved = items.filter(i => i.status === 'approved').length
  const rejected = items.filter(i => i.status === 'rejected').length
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0

  return { items, total, approved, rejected, pct }
}
