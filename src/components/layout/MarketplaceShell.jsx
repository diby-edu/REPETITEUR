'use client'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from './DashboardLayout'

// Enveloppe les pages « marketplace » (recherche, profil répétiteur) :
// - connecté  → shell dashboard (sidebar gauche + icônes en haut à droite)
// - visiteur  → contenu nu (le ClientLayout fournit la Navbar publique + footer)
// L'auth est résolue avant le rendu (AuthProvider bloque derrière un spinner),
// donc currentUser est fiable dès le 1er rendu : pas de flash.
export default function MarketplaceShell({ children }) {
  const { currentUser } = useAuth()
  if (currentUser) return <DashboardLayout>{children}</DashboardLayout>
  return <>{children}</>
}
