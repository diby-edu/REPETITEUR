'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { Bell, MessageCircle, Calendar, ShieldCheck, Star, Zap, CreditCard, X } from 'lucide-react'
import { timeAgo } from '../utils/helpers'

const typeConfig = {
  new_message: { icon: <MessageCircle size={18} />, color: 'bg-blue-50 text-blue-500' },
  booking_request: { icon: <Calendar size={18} />, color: 'bg-primary-50 text-primary' },
  booking_confirmed: { icon: <Calendar size={18} />, color: 'bg-green-50 text-green-500' },
  verification: { icon: <ShieldCheck size={18} />, color: 'bg-secondary-50 text-secondary' },
  verification_request: { icon: <ShieldCheck size={18} />, color: 'bg-yellow-50 text-yellow-500' },
  new_review: { icon: <Star size={18} />, color: 'bg-accent-50 text-accent' },
  review_invite: { icon: <Star size={18} />, color: 'bg-accent-50 text-accent' },
  pending: { icon: <Zap size={18} />, color: 'bg-gray-50 text-gray-400' },
  new_user: { icon: <Bell size={18} />, color: 'bg-purple-50 text-purple-500' },
  subscription: { icon: <CreditCard size={18} />, color: 'bg-primary-50 text-primary' },
}

export default function NotificationsPage() {
  const { currentUser } = useAuth()
  const { getUserNotifications, markNotificationsRead, deleteNotification, loadUserNotifications } = useApp()

  useEffect(() => {
    if (currentUser?.id) loadUserNotifications(currentUser.id)
  }, [currentUser?.id])

  const notifications = getUserNotifications(currentUser.id)

  useEffect(() => {
    const timer = setTimeout(() => markNotificationsRead(currentUser.id), 2000)
    return () => clearTimeout(timer)
  }, [currentUser.id, markNotificationsRead])

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Bell size={24} className="text-primary" />
            Notifications
          </h1>
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="text-sm text-gray-500">
              {notifications.filter(n => !n.read).length} non lue{notifications.filter(n => !n.read).length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="card text-center py-16">
            <Bell size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Aucune notification</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(notif => {
              const config = typeConfig[notif.type] || typeConfig.pending
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                    notif.read ? 'bg-white border-gray-100' : 'bg-primary-50/50 border-primary-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    {config.icon}
                  </div>
                  <Link href={notif.link || '#'} className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${notif.read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{notif.message}</p>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!notif.read && <div className="w-2 h-2 bg-primary rounded-full" />}
                    <button
                      onClick={() => deleteNotification(notif.id, currentUser.id)}
                      className="p-1 text-gray-300 hover:text-gray-500 transition-colors rounded-lg hover:bg-gray-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
