'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { MessageCircle, Heart, Settings, Bell } from 'lucide-react'
import DashboardSidebar from './DashboardSidebar'

function TopIconBtn({ href, icon: Icon, badge, title }) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link
      href={href}
      title={title}
      className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
        active ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
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
  const {
    getUnreadNotifCount, getUserConversations,
    loadUserConversations, loadUserNotifications,
  } = useApp()

  const role   = currentUser?.role
  const userId = currentUser?.id

  useEffect(() => {
    if (!userId) return
    loadUserConversations(userId)
    loadUserNotifications(userId)
  }, [userId])

  const conversations   = getUserConversations(userId)
  const unreadMessages  = conversations.reduce((s, c) => s + (c.unreadCount?.[userId] || 0), 0)
  const unreadNotifs    = getUnreadNotifCount(userId)

  const TOP_ICONS = {
    tutor: [
      { href: '/messagerie',    icon: MessageCircle, badge: unreadMessages, title: 'Messages' },
      { href: '/parametres',    icon: Settings,      badge: 0,              title: 'Paramètres' },
      { href: '/notifications', icon: Bell,          badge: unreadNotifs,   title: 'Notifications' },
    ],
    parent: [
      { href: '/messagerie',    icon: MessageCircle, badge: unreadMessages, title: 'Messages' },
      { href: '/favoris',       icon: Heart,         badge: 0,              title: 'Favoris' },
      { href: '/notifications', icon: Bell,          badge: unreadNotifs,   title: 'Notifications' },
    ],
    admin: [
      { href: '/parametres',    icon: Settings, badge: 0,            title: 'Paramètres' },
      { href: '/notifications', icon: Bell,     badge: unreadNotifs, title: 'Notifications' },
    ],
  }

  const icons = TOP_ICONS[role] || []

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 flex-shrink-0 flex items-center justify-end gap-1 px-4 border-b border-gray-100 bg-white">
          {icons.map(item => (
            <TopIconBtn key={item.href} {...item} />
          ))}
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
