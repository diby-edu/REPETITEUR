'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import Avatar from '../components/common/Avatar'
import { StatusBadge } from '../components/common/Badge'
import { Calendar, Clock, MapPin, CheckCircle, XCircle, Star, ChevronRight, MessageCircle } from 'lucide-react'
import { formatDateShort, formatTime, getLocationLabel } from '../utils/helpers'

const TABS = ['À venir', 'En attente', 'Terminées', 'Annulées']

export default function BookingPage() {
  const { currentUser } = useAuth()
  const { getUserBookings, updateBookingStatus, getTutor, getParent, loadUserBookings } = useApp()
  const [activeTab, setActiveTab] = useState('À venir')
  const [cancelModal, setCancelModal] = useState(null)
  const [parentCache, setParentCache] = useState({})

  useEffect(() => {
    if (currentUser?.id) loadUserBookings(currentUser.id, currentUser.role)
  }, [currentUser?.id])

  const allBookings = getUserBookings(currentUser.id, currentUser.role)

  // Précharger les profils parents pour les tuteurs
  useEffect(() => {
    if (currentUser?.role !== 'tutor') return
    const ids = [...new Set(allBookings.map(b => b.parentId))]
    ids.forEach(async (pid) => {
      if (!parentCache[pid]) {
        const profile = await getParent(pid)
        if (profile) setParentCache(prev => ({ ...prev, [pid]: profile }))
      }
    })
  }, [allBookings.length, currentUser?.role])

  const byTab = {
    'À venir': allBookings.filter(b => b.status === 'confirmed'),
    'En attente': allBookings.filter(b => b.status === 'pending'),
    'Terminées': allBookings.filter(b => b.status === 'completed'),
    'Annulées': allBookings.filter(b => b.status === 'cancelled' || b.status === 'rejected'),
  }

  const displayed = byTab[activeTab] || []

  const getOther = (booking) => {
    if (currentUser.role === 'tutor') return parentCache[booking.parentId] || null
    return getTutor(booking.tutorId)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">
          Mes réservations
        </h1>

        {/* Cancel modal */}
        {cancelModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <h3 className="font-semibold text-gray-900 mb-2">Annuler la séance ?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Êtes-vous sûr de vouloir annuler cette séance ? Le répétiteur sera notifié.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setCancelModal(null)} className="btn-outline flex-1">Non, garder</button>
                <button
                  onClick={() => {
                    updateBookingStatus(cancelModal, 'cancelled')
                    setCancelModal(null)
                  }}
                  className="flex-1 bg-red-500 text-white font-semibold px-4 py-3 rounded-full hover:bg-red-600 transition-colors"
                >
                  Oui, annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab}
              {byTab[tab].length > 0 && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {byTab[tab].length}
                </span>
              )}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="card text-center py-16">
            <Calendar size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Aucune réservation</p>
            {activeTab === 'À venir' && currentUser.role === 'parent' && (
              <Link href="/recherche" className="btn-primary mt-4 inline-block text-sm">
                Trouver un répétiteur
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(booking => {
              const other = getOther(booking)
              const isTutor = currentUser.role === 'tutor'

              return (
                <div key={booking.id} className="card">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar user={other} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{other?.firstName} {other?.lastName}</p>
                          <p className="text-sm text-primary font-medium">{booking.subject}</p>
                        </div>
                        <StatusBadge status={booking.status} />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={15} className="text-gray-400" />
                      {formatDateShort(booking.date)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={15} className="text-gray-400" />
                      {booking.time} ({booking.duration} min)
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 col-span-2">
                      <MapPin size={15} className="text-gray-400" />
                      {getLocationLabel(booking.location)}
                    </div>
                  </div>

                  {booking.notes && (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3 mb-4 italic">
                      "{booking.notes}"
                    </p>
                  )}

                  {booking.cancellationReason && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 mb-4">
                      Motif d'annulation : {booking.cancellationReason}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                    {/* Tutor actions for pending bookings */}
                    {isTutor && booking.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white text-sm font-semibold rounded-full hover:bg-secondary-600 transition-colors"
                        >
                          <CheckCircle size={15} /> Accepter
                        </button>
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'rejected')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors"
                        >
                          <XCircle size={15} /> Refuser
                        </button>
                      </>
                    )}

                    {/* Mark as completed */}
                    {isTutor && booking.status === 'confirmed' && (
                      <button
                        onClick={() => updateBookingStatus(booking.id, 'completed')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-full hover:bg-green-600 transition-colors"
                      >
                        <CheckCircle size={15} /> Marquer comme terminée
                      </button>
                    )}

                    {/* Cancel */}
                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                      <button
                        onClick={() => setCancelModal(booking.id)}
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors"
                      >
                        <XCircle size={15} /> Annuler
                      </button>
                    )}

                    {/* Leave review */}
                    {!isTutor && booking.status === 'completed' && !booking.reviewLeft && (
                      <Link
                        href={`/repetiteur/${booking.tutorId}`}
                        className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white text-sm font-semibold rounded-full hover:bg-accent-500 transition-colors"
                      >
                        <Star size={15} /> Laisser un avis
                      </Link>
                    )}

                    {booking.reviewLeft && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Star size={14} className="text-accent fill-accent" /> Avis laissé
                      </span>
                    )}

                    {/* Message */}
                    <Link
                      href={`/messagerie`}
                      className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-full hover:bg-gray-50 transition-colors ml-auto"
                    >
                      <MessageCircle size={15} /> Message
                    </Link>
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
