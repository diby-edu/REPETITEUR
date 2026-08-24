'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

// Un répétiteur dont l'abonnement PAYANT a expiré (statut 'expired' ou
// date de fin dépassée). Les comptes 'gratuit'/jamais abonnés ne sont pas
// concernés (ils ne sont simplement pas visibles en recherche).
function isTutorSubExpired(user) {
  if (user?.role !== 'tutor') return false
  const sub = user.subscription || {}
  if (!sub.plan || sub.plan === 'gratuit') return false
  if (sub.status === 'expired') return true
  if (sub.endDate && new Date(sub.endDate) < new Date(new Date().toDateString())) return true
  return false
}

export default function ProtectedRoute({ children, allowedRoles, gateExpiredTutor = false }) {
  const { currentUser, isAuthenticated } = useAuth()
  const router = useRouter()

  const roleDenied = allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)
  const subExpired = gateExpiredTutor && isTutorSubExpired(currentUser)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/connexion')
    } else if (roleDenied) {
      router.replace('/')
    } else if (subExpired) {
      // Abonnement expiré → accès restreint : seul /abonnement (+ notifications,
      // messagerie, déconnexion) reste ouvert ; les pages « de travail » redirigent.
      router.replace('/abonnement')
    }
  }, [isAuthenticated, currentUser?.role, roleDenied, subExpired])

  if (!isAuthenticated) return null
  if (roleDenied) return null
  if (subExpired) return null
  return children
}
