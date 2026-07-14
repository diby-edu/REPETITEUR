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
  { id: 'domicile_parent', label: 'Domicile du parent', desc: 'Le répétiteur se déplace chez vous' },
  { id: 'domicile_repetiteur', label: 'Domicile du répétiteur', desc: 'Vous amenez votre enfant chez le répétiteur' },
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
