'use client'
import { useState, useEffect, useContext, createContext, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { MessageCircle, Heart, Settings, Bell, Menu, Search } from 'lucide-react'
import DashboardSidebar from './DashboardSidebar'

// Pages inject their action button here via useHeaderSlot()
const HeaderCtx = createContext({ setSlot: () => {} })
export function useHeaderSlot() { return useContext(HeaderCtx) }

function TopIconBtn({ href, icon: Icon, badge, title }) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link href={href} title={title}
      className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-primary/50 hover:bg-primary/10 hover:text-primary'
      }`}
    >
      <Icon size={18} />
      {badge > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}

export default function DashboardLayout({ children }) {
  const { currentUser } = useAuth()
  const { getUnreadNotifCount, getUserConversations, loadUserConversations, loadUserNotifications } = useApp()
  const role   = currentUser?.role
  const userId = currentUser?.id
  const [slot, setSlot] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const ctx = useMemo(() => ({ setSlot }), [])

  useEffect(() => {
    if (!userId) return
    loadUserConversations(userId)
    loadUserNotifications(userId)
  }, [userId])

  const conversations  = getUserConversations(userId)
  const unreadMessages = conversations.reduce((s, c) => s + (c.unreadCount?.[userId] || 0), 0)
  const unreadNotifs   = getUnreadNotifCount(userId)

  const TOP_ICONS = {
    tutor: [
      { href: '/messagerie',    icon: MessageCircle, badge: unreadMessages, title: 'Messages' },
      { href: '/parametres',    icon: Settings,      badge: 0,              title: 'Paramètres' },
      { href: '/notifications', icon: Bell,          badge: unreadNotifs,   title: 'Notifications' },
    ],
    parent: [
      { href: '/messagerie',    icon: MessageCircle, badge: unreadMessages, title: 'Messages' },
      { href: '/favoris',       icon: Heart,         badge: 0,              title: 'Favoris' },
      { href: '/parametres',    icon: Settings,      badge: 0,              title: 'Paramètres' },
      { href: '/notifications', icon: Bell,          badge: unreadNotifs,   title: 'Notifications' },
    ],
    admin: [
      { href: '/parametres',    icon: Settings, badge: 0,            title: 'Paramètres' },
      { href: '/notifications', icon: Bell,     badge: unreadNotifs, title: 'Notifications' },
    ],
  }
  const icons = TOP_ICONS[role] || []

  return (
    <HeaderCtx.Provider value={ctx}>
      <div className="flex h-screen overflow-hidden bg-surface">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Fermer le menu"
            className="fixed inset-0 z-40 bg-black/40 md:hidden w-full cursor-default"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Suspense fallback={<div className="hidden md:block w-60 flex-shrink-0" style={{ background: 'linear-gradient(180deg,#1B4332 0%,#2D6A4F 100%)' }} />}>
          <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </Suspense>
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="h-14 flex-shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu size={20} />
              </button>
              <div className="flex-1 min-w-0">{slot}</div>
            </div>
            <div className="flex items-center gap-2">
              {role === 'parent' && (
                <Link
                  href="/recherche"
                  className="flex items-center gap-2 bg-primary text-white text-sm font-semibold rounded-xl px-3 sm:px-3.5 py-2 hover:bg-primary-600 transition-colors flex-shrink-0"
                  title="Trouver un répétiteur"
                >
                  <Search size={15} />
                  <span className="hidden sm:inline">Trouver un répétiteur</span>
                </Link>
              )}
              <div className="flex items-center gap-0.5">
                {icons.map(item => <TopIconBtn key={item.href + item.title} {...item} />)}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </HeaderCtx.Provider>
  )
}
