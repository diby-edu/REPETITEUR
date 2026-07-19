'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useChatBubble } from '../context/ChatBubbleContext'
import Avatar from '../components/common/Avatar'
import TutorCard from '../components/common/TutorCard'
import { StatusBadge } from '../components/common/Badge'
import {
  Calendar, MessageCircle, Heart, Star, ChevronRight,
  BookOpen, Search, Clock, CheckCircle
} from 'lucide-react'
import { formatDateShort } from '../utils/helpers'

export default function ParentDashboardPage() {
  const { currentUser } = useAuth()
  const {
    getUserConversations, getUserBookings,
    loadUserConversations, loadUserBookings, loadUserFavorites, getUserFavorites,
    loadUserNotifications, subscribeToNotifications, getTutor,
  } = useApp()

  const { openChat } = useChatBubble()
  const parent = currentUser

  useEffect(() => {
    if (parent?.id) {
      loadUserConversations(parent.id)
      loadUserBookings(parent.id, 'parent')
      loadUserFavorites(parent.id)
      loadUserNotifications(parent.id)
      return subscribeToNotifications(parent.id)
    }
  }, [parent?.id])

  const conversations = getUserConversations(parent.id)
  const bookings = getUserBookings(parent.id, 'parent')

  const upcomingBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending')
  const pastBookings = bookings.filter(b => b.status === 'completed').slice(0, 3)
  const favoriteTutors = getUserFavorites(parent.id)
  const unreadMessages = conversations.reduce((s, c) => s + (c.unreadCount?.[parent.id] || 0), 0)

  const stats = [
    { label: 'Répétiteurs contactés', value: conversations.length, icon: <MessageCircle size={20} />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Séances à venir', value: upcomingBookings.length, icon: <Calendar size={20} />, color: 'bg-primary-50 text-primary' },
    { label: 'Séances complétées', value: pastBookings.length, icon: <CheckCircle size={20} />, color: 'bg-green-50 text-green-600' },
    { label: 'Répétiteurs favoris', value: favoriteTutors.length, icon: <Heart size={20} />, color: 'bg-red-50 text-red-500' },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Avatar user={parent} size="lg" />
            <div>
              <h1 className="font-display text-2xl font-bold text-gray-900">
                Bonjour, {parent.firstName} !
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">Espace parent</p>
            </div>
          </div>
          <Link href="/recherche" className="btn-primary flex items-center gap-2">
            <Search size={18} />
            Trouver un répétiteur
          </Link>
        </div>

        {/* Unread messages alert */}
        {unreadMessages > 0 && (
          <div className="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl p-4 mb-5">
            <MessageCircle size={20} className="text-primary" />
            <p className="text-sm font-medium text-primary-700 flex-1">
              {unreadMessages} nouveau{unreadMessages > 1 ? 'x' : ''} message{unreadMessages > 1 ? 's' : ''}
            </p>
            <button onClick={() => openChat()} className="text-xs text-primary font-semibold bg-white px-3 py-1.5 rounded-lg border border-primary/20">
              Voir
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div key={i} className="card">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Upcoming sessions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                Séances à venir
              </h2>
              <Link href="/reservations" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Toutes <ChevronRight size={12} />
              </Link>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucune séance prévue</p>
                <Link href="/recherche" className="text-xs text-primary font-medium mt-2 block hover:underline">
                  Trouver un répétiteur →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map(b => {
                  const t = getTutor(b.tutorId)
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Avatar user={t} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{t?.firstName} {t?.lastName}</p>
                        <p className="text-xs text-gray-500">{b.subject} — {formatDateShort(b.date)} à {b.time}</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent messages */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" />
                Messages récents
              </h2>
              <button onClick={() => openChat()} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Voir tout <ChevronRight size={12} />
              </button>
            </div>
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucune conversation</p>
                <Link href="/recherche" className="text-xs text-primary font-medium mt-2 block hover:underline">
                  Contacter un répétiteur →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 3).map(conv => {
                  const tutorId = conv.participants.find(p => p !== parent.id)
                  const t = getTutor(tutorId)
                  const unreadInConv = conv.unreadCount[parent.id] || 0
                  return (
                    <button
                      key={conv.id}
                      onClick={() => openChat(conv.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left ${unreadInConv ? 'bg-primary-50' : ''}`}
                    >
                      <Avatar user={t} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${unreadInConv ? 'font-semibold' : 'font-medium'} text-gray-800`}>
                          {t?.firstName} {t?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{conv.lastMessage?.content}</p>
                      </div>
                      {unreadInConv > 0 && (
                        <span className="w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {unreadInConv}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Past sessions */}
          {pastBookings.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock size={18} className="text-gray-400" />
                  Séances passées
                </h2>
              </div>
              <div className="space-y-3">
                {pastBookings.map(b => {
                  const t = getTutor(b.tutorId)
                  return (
                    <div key={b.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Avatar user={t} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{t?.firstName} {t?.lastName}</p>
                        <p className="text-xs text-gray-500">{b.subject} — {formatDateShort(b.date)}</p>
                      </div>
                      {b.reviewLeft ? (
                        <span className="text-xs text-gray-400 flex items-center gap-1"><Star size={12} className="text-accent fill-accent" />Avis laissé</span>
                      ) : (
                        <Link href={`/repetiteur/${b.tutorId}`} className="text-xs text-primary font-medium bg-primary-50 px-2 py-1 rounded-lg hover:bg-primary-100">
                          Laisser un avis
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Favorite tutors */}
          {favoriteTutors.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Heart size={18} className="text-red-400" />
                  Répétiteurs favoris
                </h2>
              </div>
              <div className="space-y-2">
                {favoriteTutors.map(t => (
                  <TutorCard key={t.id} tutor={t} compact />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA for no bookings */}
        {upcomingBookings.length === 0 && pastBookings.length === 0 && (
          <div className="mt-6 card text-center bg-gradient-to-br from-primary-50 to-secondary-50 border-primary-100">
            <BookOpen size={48} className="text-primary mx-auto mb-4 opacity-80" />
            <h3 className="font-display font-semibold text-xl text-gray-800 mb-2">Commencez dès aujourd'hui !</h3>
            <p className="text-gray-500 text-sm mb-5">Trouvez le répétiteur idéal pour votre enfant parmi nos {500}+ professeurs vérifiés.</p>
            <Link href="/recherche" className="btn-primary inline-flex items-center gap-2">
              <Search size={18} />
              Trouver un répétiteur
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
