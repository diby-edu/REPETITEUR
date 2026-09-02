'use client'
import { usePathname } from 'next/navigation'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { AppProvider } from '../context/AppContext'
import { ChatBubbleProvider } from '../context/ChatBubbleContext'
import Navbar from './common/Navbar'
import Footer from './common/Footer'
import Toast from './common/Toast'
import ChatBubble from './chat/ChatBubble'
import { useApp } from '../context/AppContext'

const DASHBOARD_PREFIXES = [
  '/tableau-de-bord', '/admin',
  '/messagerie', '/reservations', '/favoris',
  '/notifications', '/parametres', '/abonnement', '/recruter',
]

// Pages « marketplace » : shell dashboard quand l'utilisateur est connecté,
// Navbar publique sinon (elles restent accessibles aux visiteurs).
const MARKETPLACE_PREFIXES = ['/recherche', '/repetiteur']

function ToastWrapper() {
  const { toast } = useApp()
  if (!toast) return null
  return <Toast message={toast.message} type={toast.type} key={toast.id} />
}

function Shell({ children }) {
  const pathname = usePathname()
  const { currentUser } = useAuth()
  const isDashboard =
    DASHBOARD_PREFIXES.some(p => pathname?.startsWith(p)) ||
    (!!currentUser && MARKETPLACE_PREFIXES.some(p => pathname?.startsWith(p)))

  // Écran de choix de profil : plein écran, sans Navbar/Footer (il gère son propre
  // en-tête + lien « Se connecter »). Les sous-pages /inscription/* gardent la Navbar.
  if (pathname === '/inscription') {
    return (<div className="font-sans">{children}<ToastWrapper /></div>)
  }

  if (isDashboard) {
    return (
      <div className="font-sans">
        {children}
        <ToastWrapper />
        <ChatBubble />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ToastWrapper />
      <ChatBubble />
    </div>
  )
}

export default function ClientLayout({ children }) {
  return (
    <AuthProvider>
      <AppProvider>
        <ChatBubbleProvider>
          <Shell>{children}</Shell>
        </ChatBubbleProvider>
      </AppProvider>
    </AuthProvider>
  )
}
