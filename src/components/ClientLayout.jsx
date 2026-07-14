'use client'
import { AuthProvider } from '../context/AuthContext'
import { AppProvider } from '../context/AppContext'
import Navbar from './common/Navbar'
import Footer from './common/Footer'
import Toast from './common/Toast'
import { useApp } from '../context/AppContext'

function ToastWrapper() {
  const { toast } = useApp()
  if (!toast) return null
  return <Toast message={toast.message} type={toast.type} key={toast.id} />
}

export default function ClientLayout({ children }) {
  return (
    <AuthProvider>
      <AppProvider>
        <div className="min-h-screen bg-surface flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <ToastWrapper />
        </div>
      </AppProvider>
    </AuthProvider>
  )
}
