'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { isRegistrationComplete, registrationResumePath } from '../utils/helpers'

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

export default function ProtectedRoute({ children, allowedRoles, gateExpiredTutor = false, allowIncomplete = false }) {
  const { currentUser, isAuthenticated } = useAuth()
  const router = useRouter()

  const roleDenied = allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)
  // Inscription pas finie → renvoyer la terminer (avant tout accès à l'app).
  // `allowIncomplete` exempte la page qui SERT à compléter (sinon boucle de redirection).
  const incomplete = !allowIncomplete && currentUser && currentUser.role !== 'admin' && !isRegistrationComplete(currentUser)
  const subExpired = gateExpiredTutor && isTutorSubExpired(currentUser)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/connexion')
    } else if (roleDenied) {
      router.replace('/')
    } else if (incomplete) {
      router.replace(registrationResumePath(currentUser))
    } else if (subExpired) {
      // Abonnement expiré → accès restreint : seul /abonnement (+ notifications,
      // messagerie, déconnexion) reste ouvert ; les pages « de travail » redirigent.
      router.replace('/abonnement')
    }
  }, [isAuthenticated, currentUser?.role, roleDenied, incomplete, subExpired])

  if (!isAuthenticated) return null
  if (roleDenied) return null
  if (incomplete) return null
  if (subExpired) return null
  return children
}
