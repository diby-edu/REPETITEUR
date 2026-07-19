'use client'
import { usePathname } from 'next/navigation'
import { AuthProvider } from '../context/AuthContext'
import { AppProvider } from '../context/AppContext'
import { ChatBubbleProvider } from '../context/ChatBubbleContext'
import Navbar from './common/Navbar'
import Footer from './common/Footer'
import Toast from './common/Toast'
import ChatBubble from './chat/ChatBubble'
import { useApp } from '../context/AppContext'

const DASHBOARD_PREFIXES = ['/tableau-de-bord', '/admin']

function ToastWrapper() {
  const { toast } = useApp()
  if (!toast) return null
  return <Toast message={toast.message} type={toast.type} key={toast.id} />
}

function Shell({ children }) {
  const pathname = usePathname()
  const isDashboard = DASHBOARD_PREFIXES.some(p => pathname?.startsWith(p))

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
