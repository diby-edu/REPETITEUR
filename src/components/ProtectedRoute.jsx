'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/connexion')
    } else if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
      router.replace('/')
    }
  }, [isAuthenticated, currentUser?.role])

  if (!isAuthenticated) return null
  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) return null
  return children
}
