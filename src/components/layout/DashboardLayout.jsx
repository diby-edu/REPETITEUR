'use client'
import { useState, useEffect, useContext, createContext, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { MessageCircle, Heart, Settings, Bell } from 'lucide-react'
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
        <DashboardSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 flex-shrink-0 flex items-center justify-between gap-3 px-6 border-b border-gray-100 bg-white">
            <div className="flex-1 flex items-center">{slot}</div>
            <div className="flex items-center gap-0.5">
              {icons.map(item => <TopIconBtn key={item.href + item.title} {...item} />)}
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
