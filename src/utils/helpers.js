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
  // Remove phone numbers
  let filtered = text.replace(
    /(\+?\d[\d\s\-().]{7,}\d)/g,
    '[numéro masqué]'
  )
  // Remove emails
  filtered = filtered.replace(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    '[email masqué]'
  )
  return filtered
}

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
export function getDocumentApprovalProgress(documents) {
  const docs = documents || {}
  const isPassport = docs.idType === 'passport'
  const idSubmitted = isPassport ? !!docs.passport : !!(docs.cniRecto && docs.cniVerso)
  const diplomas = docs.diplomes || []

  const items = []
  if (idSubmitted) {
    items.push({
      key: 'id', label: isPassport ? 'Passeport' : 'CNI (recto + verso)',
      status: docs.idReview?.status || 'pending', reason: docs.idReview?.reason,
    })
  }
  if (docs.selfiePath) {
    items.push({ key: 'selfie', label: 'Selfie avec pièce', status: docs.selfieReview?.status || 'pending', reason: docs.selfieReview?.reason })
  }
  diplomas.forEach((d, i) => {
    if (d.path) items.push({ key: `diploma-${i}`, label: d.name || `Diplôme ${i + 1}`, status: d.review?.status || 'pending', reason: d.review?.reason })
  })

  const total = items.length
  const approved = items.filter(i => i.status === 'approved').length
  const rejected = items.filter(i => i.status === 'rejected').length
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0

  return { items, total, approved, rejected, pct }
}
