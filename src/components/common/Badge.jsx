import { CheckCircle, Star, Clock, XCircle, AlertCircle, ShieldCheck } from 'lucide-react'

export function VerifiedBadge({ size = 'sm' }) {
  const textSize = size === 'xs' ? 'text-xs' : 'text-xs'
  return (
    <span className={`badge-verified ${textSize}`}>
      <ShieldCheck size={12} />
      Vérifié
    </span>
  )
}

export function PremiumBadge() {
  return (
    <span className="badge-premium">
      <Star size={12} />
      Premium
    </span>
  )
}

export function PendingBadge() {
  return (
    <span className="badge-pending">
      <Clock size={12} />
      En attente
    </span>
  )
}

export function RejectedBadge() {
  return (
    <span className="badge-rejected">
      <XCircle size={12} />
      Rejeté
    </span>
  )
}

export function InactiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full">
      <AlertCircle size={12} />
      Inactif
    </span>
  )
}

export function StatusBadge({ status }) {
  const configs = {
    verified: { label: 'Vérifié', icon: <ShieldCheck size={12} />, cls: 'badge-verified' },
    pending: { label: 'En attente', icon: <Clock size={12} />, cls: 'badge-pending' },
    rejected: { label: 'Rejeté', icon: <XCircle size={12} />, cls: 'badge-rejected' },
    active: { label: 'Actif', icon: <CheckCircle size={12} />, cls: 'bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1' },
    expired: { label: 'Expiré', icon: <AlertCircle size={12} />, cls: 'bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1' },
    confirmed: { label: 'Confirmée', icon: <CheckCircle size={12} />, cls: 'bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1' },
    completed: { label: 'Terminée', icon: <CheckCircle size={12} />, cls: 'bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1' },
    cancelled: { label: 'Annulée', icon: <XCircle size={12} />, cls: 'bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1' },
    pending_booking: { label: 'En attente', icon: <Clock size={12} />, cls: 'badge-pending' },
  }
  const cfg = configs[status] || configs.pending
  return (
    <span className={cfg.cls}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}
