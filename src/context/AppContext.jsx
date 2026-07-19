import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { filterPhoneAndEmail } from '../utils/helpers'

const AppContext = createContext(null)

// ── Mappers DB → JS ──────────────────────────────────────────

function mapTutor(profile, tutor) {
  return {
    id: profile.id,
    role: 'tutor',
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    quartier: profile.quartier,
    avatarColor: profile.avatar_color,
    joinDate: profile.join_date,
    bio: tutor.bio,
    subjects: tutor.subjects || [],
    levels: tutor.levels || [],
    monthlyRate: tutor.monthly_rate,
    modalities: tutor.modalities || [],
    availability: tutor.availability || {},
    verificationStatus: tutor.verification_status,
    rejectionReason: tutor.rejection_reason,
    documents: tutor.documents || {},
    subscription: {
      plan: tutor.subscription_plan,
      startDate: tutor.subscription_start,
      endDate: tutor.subscription_end,
      status: tutor.subscription_status,
    },
    rating: parseFloat(tutor.rating) || 0,
    reviewCount: tutor.review_count || 0,
    sessionCount: tutor.session_count || 0,
    profileViews: tutor.profile_views || 0,
    monthlyRequests: tutor.monthly_requests || 0,
    isActive: tutor.is_active,
    suspended: tutor.suspended,
  }
}

function mapConversation(row) {
  return {
    id: row.id,
    participants: [row.participant_1, row.participant_2],
    lastMessage: row.last_message_content ? {
      content: row.last_message_content,
      timestamp: row.last_message_at,
      senderId: row.last_message_sender,
    } : null,
    unreadCount: {
      [row.participant_1]: row.unread_count_1,
      [row.participant_2]: row.unread_count_2,
    },
    messages: [],
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    content: row.content,
    timestamp: row.created_at,
    read: row.read,
  }
}

function mapBooking(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    tutorId: row.tutor_id,
    subject: row.subject,
    date: row.date,
    time: row.time,
    duration: row.duration,
    location: row.location,
    notes: row.notes,
    status: row.status,
    reviewLeft: row.review_left,
    createdAt: row.created_at,
  }
}

function mapReview(row) {
  return {
    id: row.id,
    tutorId: row.tutor_id,
    parentId: row.parent_id,
    bookingId: row.booking_id,
    parentName: row.parent_name,
    rating: row.rating,
    comment: row.comment,
    tutorResponse: row.tutor_response,
    tutorResponseDate: row.tutor_response_date,
    date: row.date,
  }
}

function mapNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.read,
    link: row.link,
    createdAt: row.created_at,
  }
}

function mapEngagement(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    tutorId: row.tutor_id,
    subject: row.subject,
    monthlyRate: row.monthly_rate,
    notes: row.notes,
    schedule: row.schedule || [],
    proposedSchedule: row.proposed_schedule,
    scheduleProposedBy: row.schedule_proposed_by,
    scheduleStatus: row.schedule_status,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSession(row) {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    durationMinutes: row.duration_minutes,
    parentReport: row.parent_report,
    lateMinutes: row.late_minutes,
    reportedAt: row.reported_at,
    sessionRating: row.session_rating,
    sessionComment: row.session_comment,
    createdAt: row.created_at,
  }
}

function mapPayment(row) {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amount: row.amount,
    paymentMethod: row.payment_method,
    parentWantsContinue: row.parent_wants_continue,
    parentDeclaredAt: row.parent_declared_at,
    tutorWantsContinue: row.tutor_wants_continue,
    tutorConfirmedAt: row.tutor_confirmed_at,
    status: row.status,
    createdAt: row.created_at,
  }
}

// ── Provider ─────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [tutors, setTutors] = useState([])
  const [conversations, setConversations] = useState([])
  const [bookings, setBookings] = useState([])
  const [reviews, setReviews] = useState([])
  const [notifications, setNotifications] = useState({})
  const [favorites, setFavorites] = useState({})
  const [profiles, setProfiles] = useState({})
  const [engagements, setEngagements] = useState([])
  const [sessions, setSessions] = useState({})    // keyed by engagementId
  const [payments, setPayments] = useState({})    // keyed by engagementId
  const [toast, setToast] = useState(null)
  const notifChannelRef = useRef(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── TUTEURS ─────────────────────────────────────────────────

  const reloadTutors = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, tutors(*)')
      .eq('role', 'tutor')
      .not('tutors', 'is', null)

    if (error) { console.error('loadTutors:', error); return }
    setTutors(data.map(p => mapTutor(p, p.tutors)))
  }, [])

  useEffect(() => { reloadTutors() }, [reloadTutors])

  const getTutor = (id) => tutors.find(t => t.id === id)
  const getActiveTutors = () => tutors.filter(t => t.isActive && t.verificationStatus === 'verified')
  const getPendingTutors = () => tutors.filter(t => t.verificationStatus === 'pending')

  const validateTutor = useCallback(async (tutorId, decision, reason = '') => {
    const verified = decision === 'verified'
    const tutor = tutors.find(t => t.id === tutorId)
    const isActive = verified && tutor?.subscription?.status === 'active' && tutor?.subscription?.plan !== 'gratuit'

    const { error } = await supabase.from('tutors').update({
      verification_status: decision,
      rejection_reason: verified ? null : reason,
      is_active: isActive,
    }).eq('id', tutorId)

    if (error) { showToast('Erreur lors de la validation.', 'error'); return }
    setTutors(prev => prev.map(t => t.id !== tutorId ? t : {
      ...t, verificationStatus: decision, rejectionReason: verified ? undefined : reason, isActive,
    }))
    showToast(verified ? 'Répétiteur validé !' : 'Dossier rejeté.')
  }, [tutors, showToast])

  const updateTutorSubscription = useCallback(async (tutorId, plan) => {
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1)
    const startDate = new Date().toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    const tutor = tutors.find(t => t.id === tutorId)
    const isActive = tutor?.verificationStatus === 'verified' && plan !== 'gratuit'

    const { error } = await supabase.from('tutors').update({
      subscription_plan: plan,
      subscription_start: startDate,
      subscription_end: endDateStr,
      subscription_status: 'active',
      is_active: isActive,
    }).eq('id', tutorId)

    if (error) { showToast('Erreur abonnement.', 'error'); return }
    setTutors(prev => prev.map(t => t.id !== tutorId ? t : {
      ...t, subscription: { plan, startDate, endDate: endDateStr, status: 'active' }, isActive,
    }))
    showToast(`Abonnement ${plan} activé !`)
  }, [tutors, showToast])

  const suspendTutor = useCallback(async (tutorId) => {
    const { error } = await supabase.from('tutors').update({ is_active: false, suspended: true }).eq('id', tutorId)
    if (error) { showToast('Erreur.', 'error'); return }
    setTutors(prev => prev.map(t => t.id !== tutorId ? t : { ...t, isActive: false, suspended: true }))
    showToast('Compte suspendu.')
  }, [showToast])

  const updateTutorAvailability = useCallback(async (tutorId, availability) => {
    const { error } = await supabase.from('tutors').update({ availability }).eq('id', tutorId)
    if (error) { showToast('Erreur.', 'error'); return }
    setTutors(prev => prev.map(t => t.id !== tutorId ? t : { ...t, availability }))
    showToast('Disponibilités mises à jour !')
  }, [showToast])

  // ── CONVERSATIONS & MESSAGES ────────────────────────────────

  const loadUserConversations = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('last_message_at', { ascending: false })

    if (error) { console.error('loadConversations:', error); return }
    setConversations(data.map(mapConversation))
  }, [])

  const getConversation = (id) => conversations.find(c => c.id === id)
  const getUserConversations = (userId) => conversations.filter(c => c.participants.includes(userId))

  const getOrCreateConversation = useCallback(async (userId1, userId2) => {
    const existing = conversations.find(
      c => c.participants.includes(userId1) && c.participants.includes(userId2)
    )
    if (existing) return existing

    const [p1, p2] = [userId1, userId2].sort()
    const { data, error } = await supabase
      .from('conversations')
      .upsert({ participant_1: p1, participant_2: p2 }, { onConflict: 'participant_1,participant_2' })
      .select()
      .single()

    if (error) { console.error('getOrCreateConversation:', error); return null }
    const conv = mapConversation(data)
    setConversations(prev => prev.find(c => c.id === conv.id) ? prev : [conv, ...prev])
    return conv
  }, [conversations])

  const loadMessages = useCallback(async (convId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (error) { console.error('loadMessages:', error); return [] }
    const msgs = data.map(mapMessage)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: msgs } : c))
    return msgs
  }, [])

  const sendMessage = useCallback(async (convId, senderId, content) => {
    const filtered = filterPhoneAndEmail(content)

    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({ conversation_id: convId, sender_id: senderId, content: filtered })
      .select()
      .single()

    if (msgErr) { console.error('sendMessage:', msgErr); return null }

    const conv = conversations.find(c => c.id === convId)
    const receiverId = conv?.participants.find(p => p !== senderId)
    const currentUnread = conv?.unreadCount?.[receiverId] || 0

    const updatePayload = {
      last_message_content: filtered,
      last_message_at: msg.created_at,
      last_message_sender: senderId,
    }
    if (receiverId === conv?.participants[0]) {
      updatePayload.unread_count_1 = currentUnread + 1
    } else {
      updatePayload.unread_count_2 = currentUnread + 1
    }

    await supabase.from('conversations').update(updatePayload).eq('id', convId)

    const newMsg = mapMessage(msg)
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c
      return {
        ...c,
        messages: [...c.messages, newMsg],
        lastMessage: { content: filtered, timestamp: msg.created_at, senderId },
        unreadCount: { ...c.unreadCount, [receiverId]: currentUnread + 1 },
      }
    }))
    return newMsg
  }, [conversations])

  const markConversationRead = useCallback(async (convId, userId) => {
    const conv = conversations.find(c => c.id === convId)
    if (!conv) return

    const isP1 = conv.participants[0] === userId
    await supabase.from('conversations').update(isP1 ? { unread_count_1: 0 } : { unread_count_2: 0 }).eq('id', convId)
    await supabase.from('messages').update({ read: true }).eq('conversation_id', convId).neq('sender_id', userId)

    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c
      return {
        ...c,
        messages: c.messages.map(m => ({ ...m, read: true })),
        unreadCount: { ...c.unreadCount, [userId]: 0 },
      }
    }))
  }, [conversations])

  // ── RÉSERVATIONS (legacy — gardé pour compatibilité) ────────

  const loadUserBookings = useCallback(async (userId, role) => {
    const column = role === 'tutor' ? 'tutor_id' : 'parent_id'
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq(column, userId)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadBookings:', error); return }
    setBookings(data.map(mapBooking))
  }, [])

  const getUserBookings = (userId, role) => {
    if (role === 'tutor') return bookings.filter(b => b.tutorId === userId)
    if (role === 'parent') return bookings.filter(b => b.parentId === userId)
    return bookings
  }

  const createBooking = useCallback(async (bookingData) => {
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        parent_id: bookingData.parentId,
        tutor_id: bookingData.tutorId,
        subject: bookingData.subject,
        date: bookingData.date,
        time: bookingData.time,
        duration: bookingData.duration,
        location: bookingData.location,
        notes: bookingData.notes || '',
      })
      .select()
      .single()

    if (error) { showToast('Erreur lors de la réservation.', 'error'); return null }
    const booking = mapBooking(data)
    setBookings(prev => [booking, ...prev])
    showToast('Demande de séance envoyée !')
    return booking
  }, [showToast])

  const updateBookingStatus = useCallback(async (bookingId, status, extra = {}) => {
    const { error } = await supabase.from('bookings').update({ status, ...extra }).eq('id', bookingId)
    if (error) { showToast('Erreur.', 'error'); return }
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status, ...extra } : b))
    const msgs = {
      confirmed: 'Séance confirmée !', rejected: 'Séance refusée.',
      cancelled: 'Séance annulée.', completed: 'Séance marquée comme terminée.',
    }
    showToast(msgs[status] || 'Statut mis à jour.')
  }, [showToast])

  // ── AVIS ────────────────────────────────────────────────────

  const loadTutorReviews = useCallback(async (tutorId) => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('tutor_id', tutorId)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadReviews:', error); return [] }
    const mapped = data.map(mapReview)
    setReviews(prev => [...prev.filter(r => r.tutorId !== tutorId), ...mapped])
    return mapped
  }, [])

  const getTutorReviews = (tutorId) => reviews.filter(r => r.tutorId === tutorId)

  const addReview = useCallback(async (reviewData) => {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        tutor_id: reviewData.tutorId,
        parent_id: reviewData.parentId,
        booking_id: reviewData.bookingId || null,
        parent_name: reviewData.parentName,
        rating: reviewData.rating,
        comment: reviewData.comment,
      })
      .select()
      .single()

    if (error) { showToast('Erreur lors de la publication.', 'error'); return null }

    const review = mapReview(data)
    setReviews(prev => [review, ...prev])

    const tutorReviews = [...reviews.filter(r => r.tutorId === reviewData.tutorId), review]
    const avg = tutorReviews.reduce((s, r) => s + r.rating, 0) / tutorReviews.length
    const newRating = Math.round(avg * 10) / 10

    await supabase.from('tutors').update({
      rating: newRating, review_count: tutorReviews.length,
    }).eq('id', reviewData.tutorId)

    setTutors(prev => prev.map(t => t.id !== reviewData.tutorId ? t : {
      ...t, rating: newRating, reviewCount: tutorReviews.length,
    }))

    if (reviewData.bookingId) {
      await supabase.from('bookings').update({ review_left: true }).eq('id', reviewData.bookingId)
      setBookings(prev => prev.map(b => b.id === reviewData.bookingId ? { ...b, reviewLeft: true } : b))
    }

    showToast('Avis publié !')
    return review
  }, [reviews, showToast])

  const addTutorResponse = useCallback(async (reviewId, response) => {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('reviews').update({
      tutor_response: response, tutor_response_date: today,
    }).eq('id', reviewId)

    if (error) { showToast('Erreur.', 'error'); return }
    setReviews(prev => prev.map(r =>
      r.id === reviewId ? { ...r, tutorResponse: response, tutorResponseDate: today } : r
    ))
    showToast('Réponse publiée !')
  }, [showToast])

  // ── NOTIFICATIONS ───────────────────────────────────────────

  const loadUserNotifications = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadNotifications:', error); return }
    setNotifications(prev => ({ ...prev, [userId]: data.map(mapNotification) }))
  }, [])

  const getUserNotifications = (userId) => notifications[userId] || []
  const getUnreadNotifCount = (userId) => (notifications[userId] || []).filter(n => !n.read).length

  const markNotificationsRead = useCallback(async (userId) => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifications(prev => ({
      ...prev,
      [userId]: (prev[userId] || []).map(n => ({ ...n, read: true })),
    }))
  }, [])

  const deleteNotification = useCallback(async (notifId, userId) => {
    await supabase.from('notifications').delete().eq('id', notifId)
    setNotifications(prev => ({
      ...prev,
      [userId]: (prev[userId] || []).filter(n => n.id !== notifId),
    }))
  }, [])

  const subscribeToNotifications = useCallback((userId) => {
    if (notifChannelRef.current) supabase.removeChannel(notifChannelRef.current)
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const newNotif = mapNotification(payload.new)
        setNotifications(prev => ({
          ...prev,
          [userId]: [newNotif, ...(prev[userId] || [])],
        }))
      })
      .subscribe()
    notifChannelRef.current = channel
    return () => supabase.removeChannel(channel)
  }, [])

  // ── FAVORIS ─────────────────────────────────────────────────

  const loadUserFavorites = useCallback(async (userId) => {
    const { data, error } = await supabase.from('favorites').select('tutor_id').eq('parent_id', userId)
    if (error) { console.error('loadFavorites:', error); return }
    setFavorites(prev => ({ ...prev, [userId]: data.map(f => f.tutor_id) }))
  }, [])

  const toggleFavorite = useCallback(async (userId, tutorId) => {
    const userFavs = favorites[userId] || []
    const isFav = userFavs.includes(tutorId)
    if (isFav) {
      await supabase.from('favorites').delete().eq('parent_id', userId).eq('tutor_id', tutorId)
      setFavorites(prev => ({ ...prev, [userId]: userFavs.filter(id => id !== tutorId) }))
    } else {
      await supabase.from('favorites').insert({ parent_id: userId, tutor_id: tutorId })
      setFavorites(prev => ({ ...prev, [userId]: [...userFavs, tutorId] }))
    }
  }, [favorites])

  const getUserFavorites = (userId) => tutors.filter(t => (favorites[userId] || []).includes(t.id))
  const isFavorite = (userId, tutorId) => (favorites[userId] || []).includes(tutorId)

  // ── PROFILS (parents/autres) ────────────────────────────────

  const getParent = async (id) => {
    if (profiles[id]) return profiles[id]
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) {
      const profile = {
        id: data.id, firstName: data.first_name, lastName: data.last_name,
        email: data.email, avatarColor: data.avatar_color,
      }
      setProfiles(prev => ({ ...prev, [id]: profile }))
      return profile
    }
    return null
  }

  // ── ENGAGEMENTS ─────────────────────────────────────────────

  const loadUserEngagements = useCallback(async (userId, role) => {
    const column = role === 'tutor' ? 'tutor_id' : 'parent_id'
    const { data, error } = await supabase
      .from('engagements')
      .select('*')
      .eq(column, userId)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadEngagements:', error); return }
    setEngagements(data.map(mapEngagement))
  }, [])

  const getUserEngagements = (userId, role) => {
    if (role === 'tutor') return engagements.filter(e => e.tutorId === userId)
    if (role === 'parent') return engagements.filter(e => e.parentId === userId)
    return engagements
  }

  const createEngagement = useCallback(async (data) => {
    const startDate = data.startDate || new Date().toISOString().split('T')[0]
    const endDate = data.endDate || (() => {
      const d = new Date(startDate)
      d.setDate(d.getDate() + 30)
      return d.toISOString().split('T')[0]
    })()

    const { data: row, error } = await supabase
      .from('engagements')
      .insert({
        parent_id: data.parentId,
        tutor_id: data.tutorId,
        subject: data.subject,
        monthly_rate: data.monthlyRate,
        notes: data.notes || null,
        schedule: data.schedule || [],
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single()

    if (error) { showToast('Erreur lors de la création du contrat.', 'error'); return null }
    const engagement = mapEngagement(row)
    setEngagements(prev => [engagement, ...prev])
    showToast('Contrat proposé au répétiteur !')
    return engagement
  }, [showToast])

  // Répétiteur accepte ou refuse un engagement proposé
  const respondToEngagement = useCallback(async (engagementId, accept) => {
    const newStatus = accept ? 'active' : 'ended'
    const { error } = await supabase
      .from('engagements')
      .update({ status: newStatus })
      .eq('id', engagementId)

    if (error) { showToast('Erreur.', 'error'); return }
    setEngagements(prev => prev.map(e => e.id !== engagementId ? e : { ...e, status: newStatus }))
    showToast(accept ? 'Contrat accepté ! Les séances sont planifiées.' : 'Contrat refusé.')
  }, [showToast])

  // Propose une modification de planning (parent ou répétiteur)
  const proposeScheduleChange = useCallback(async (engagementId, newSchedule, proposedBy) => {
    const { error } = await supabase.from('engagements').update({
      proposed_schedule: newSchedule,
      schedule_proposed_by: proposedBy,
      schedule_status: 'pending',
    }).eq('id', engagementId)

    if (error) { showToast('Erreur.', 'error'); return }
    setEngagements(prev => prev.map(e => e.id !== engagementId ? e : {
      ...e, proposedSchedule: newSchedule, scheduleProposedBy: proposedBy, scheduleStatus: 'pending',
    }))
    showToast('Modification de planning envoyée !')
  }, [showToast])

  // L'autre partie accepte ou refuse la modification
  const respondToScheduleChange = useCallback(async (engagementId, accept) => {
    const engagement = engagements.find(e => e.id === engagementId)
    if (!engagement) return

    const updateData = accept
      ? { schedule: engagement.proposedSchedule, proposed_schedule: null, schedule_proposed_by: null, schedule_status: 'accepted' }
      : { schedule_status: 'rejected' }

    const { error } = await supabase.from('engagements').update(updateData).eq('id', engagementId)
    if (error) { showToast('Erreur.', 'error'); return }

    setEngagements(prev => prev.map(e => e.id !== engagementId ? e : {
      ...e,
      ...(accept ? { schedule: engagement.proposedSchedule, proposedSchedule: null, scheduleProposedBy: null } : {}),
      scheduleStatus: accept ? 'accepted' : 'rejected',
    }))
    showToast(accept ? 'Planning mis à jour !' : 'Modification refusée.')
  }, [engagements, showToast])

  // ── SÉANCES ─────────────────────────────────────────────────

  const loadEngagementSessions = useCallback(async (engagementId) => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('scheduled_date', { ascending: true })

    if (error) { console.error('loadSessions:', error); return [] }
    const mapped = data.map(mapSession)
    setSessions(prev => ({ ...prev, [engagementId]: mapped }))
    return mapped
  }, [])

  // Charge toutes les séances de l'utilisateur (pour l'emploi du temps hebdo)
  const loadAllUserSessions = useCallback(async (userId, role) => {
    const column = role === 'tutor' ? 'tutor_id' : 'parent_id'
    // Étape 1 : récupérer les IDs des engagements de l'utilisateur
    const { data: engData } = await supabase
      .from('engagements')
      .select('id')
      .eq(column, userId)
      .in('status', ['active', 'ended'])

    if (!engData || engData.length === 0) return
    const engIds = engData.map(e => e.id)

    // Étape 2 : récupérer toutes les séances de ces engagements
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .in('engagement_id', engIds)
      .order('scheduled_date', { ascending: false })

    if (error) { console.error('loadAllSessions:', error); return }
    const byEngagement = {}
    data.forEach(row => {
      const engId = row.engagement_id
      if (!byEngagement[engId]) byEngagement[engId] = []
      byEngagement[engId].push(mapSession(row))
    })
    setSessions(prev => ({ ...prev, ...byEngagement }))
  }, [])

  const getEngagementSessions = (engagementId) => sessions[engagementId] || []

  // Récupère toutes les séances de l'utilisateur à plat (pour l'emploi du temps)
  const getAllUserSessions = (userId, role) => {
    const userEngagements = engagements.filter(e =>
      role === 'tutor' ? e.tutorId === userId : e.parentId === userId
    )
    return userEngagements.flatMap(e => sessions[e.id] || [])
  }

  // Parent marque la présence d'une séance (+ note optionnelle)
  const reportSession = useCallback(async (sessionId, engagementId, report, lateMinutes, rating, comment) => {
    const updateData = {
      parent_report: report,
      reported_at: new Date().toISOString(),
      late_minutes: report === 'late' ? (lateMinutes || null) : null,
      session_rating: rating || null,
      session_comment: comment || null,
    }

    const { error } = await supabase.from('sessions').update(updateData).eq('id', sessionId)
    if (error) { showToast('Erreur.', 'error'); return }

    setSessions(prev => ({
      ...prev,
      [engagementId]: (prev[engagementId] || []).map(s =>
        s.id !== sessionId ? s : {
          ...s,
          parentReport: report,
          lateMinutes: updateData.late_minutes,
          reportedAt: updateData.reported_at,
          sessionRating: rating || null,
          sessionComment: comment || null,
        }
      ),
    }))

    // Mettre à jour la note globale du répétiteur depuis la vue tutor_ratings
    if (rating) {
      const engagement = engagements.find(e => e.id === engagementId)
      if (engagement) {
        const { data: ratingData } = await supabase
          .from('tutor_ratings')
          .select('average_rating, total_sessions_rated')
          .eq('tutor_id', engagement.tutorId)
          .single()

        if (ratingData) {
          await supabase.from('tutors').update({
            rating: ratingData.average_rating,
            review_count: ratingData.total_sessions_rated,
          }).eq('id', engagement.tutorId)

          setTutors(prev => prev.map(t => t.id !== engagement.tutorId ? t : {
            ...t,
            rating: parseFloat(ratingData.average_rating),
            reviewCount: ratingData.total_sessions_rated,
          }))
        }
      }
    }

    showToast('Séance enregistrée !')
  }, [engagements, showToast])

  // ── PAIEMENTS ────────────────────────────────────────────────

  const loadEngagementPayments = useCallback(async (engagementId) => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadPayments:', error); return [] }
    const mapped = data.map(mapPayment)
    setPayments(prev => ({ ...prev, [engagementId]: mapped }))
    return mapped
  }, [])

  const getEngagementPayments = (engagementId) => payments[engagementId] || []

  // Parent déclare avoir payé et indique s'il veut continuer
  const declarePayment = useCallback(async (engagementId, data) => {
    const engagement = engagements.find(e => e.id === engagementId)
    if (!engagement) return null

    const { data: row, error } = await supabase
      .from('payments')
      .insert({
        engagement_id: engagementId,
        period_start: engagement.startDate,
        period_end: engagement.endDate,
        amount: data.amount,
        payment_method: data.paymentMethod,
        parent_wants_continue: data.wantsContinue,
        parent_declared_at: new Date().toISOString(),
        status: 'parent_declared',
      })
      .select()
      .single()

    if (error) { showToast('Erreur.', 'error'); return null }
    const payment = mapPayment(row)
    setPayments(prev => ({ ...prev, [engagementId]: [payment, ...(prev[engagementId] || [])] }))
    showToast('Paiement déclaré ! Le répétiteur doit confirmer.')
    return payment
  }, [engagements, showToast])

  // Répétiteur confirme la réception et indique s'il veut continuer
  const confirmPayment = useCallback(async (paymentId, engagementId, tutorWantsContinue) => {
    const { error } = await supabase
      .from('payments')
      .update({
        tutor_wants_continue: tutorWantsContinue,
        tutor_confirmed_at: new Date().toISOString(),
        status: 'confirmed',
      })
      .eq('id', paymentId)

    if (error) { showToast('Erreur.', 'error'); return }

    setPayments(prev => ({
      ...prev,
      [engagementId]: (prev[engagementId] || []).map(p =>
        p.id !== paymentId ? p : {
          ...p,
          tutorWantsContinue,
          tutorConfirmedAt: new Date().toISOString(),
          status: 'confirmed',
        }
      ),
    }))

    // Le trigger DB renouvelle ou termine l'engagement — on recharge après un court délai
    setTimeout(async () => {
      const { data } = await supabase.from('engagements').select('*').eq('id', engagementId).single()
      if (data) setEngagements(prev => prev.map(e => e.id !== engagementId ? e : mapEngagement(data)))
    }, 800)

    showToast(tutorWantsContinue ? 'Paiement confirmé !' : 'Paiement confirmé. Le contrat prend fin.')
  }, [showToast])

  // ── MAINTENANCE (à appeler au login depuis chaque dashboard) ─

  const runMaintenanceTasks = useCallback(async () => {
    await supabase.rpc('expire_ended_engagements')
    await supabase.rpc('check_expiring_engagements')
  }, [])

  // ── CONTEXT VALUE ────────────────────────────────────────────

  return (
    <AppContext.Provider value={{
      // État
      tutors, conversations, bookings, reviews, notifications, engagements, toast,

      // Tuteurs
      getTutor, getActiveTutors, getPendingTutors, reloadTutors,
      validateTutor, updateTutorSubscription, suspendTutor, updateTutorAvailability,

      // Conversations & messages
      getConversation, getUserConversations, getOrCreateConversation,
      loadMessages, sendMessage, markConversationRead, loadUserConversations,

      // Bookings (legacy)
      loadUserBookings, getUserBookings, createBooking, updateBookingStatus,

      // Avis
      loadTutorReviews, getTutorReviews, addReview, addTutorResponse,

      // Notifications
      loadUserNotifications, getUserNotifications, getUnreadNotifCount,
      markNotificationsRead, deleteNotification, subscribeToNotifications,

      // Favoris
      loadUserFavorites, toggleFavorite, getUserFavorites, isFavorite,

      // Profils
      getParent,

      // Engagements
      loadUserEngagements, getUserEngagements,
      createEngagement, respondToEngagement,
      proposeScheduleChange, respondToScheduleChange,

      // Séances
      loadEngagementSessions, loadAllUserSessions,
      getEngagementSessions, getAllUserSessions, reportSession,

      // Paiements
      loadEngagementPayments, getEngagementPayments,
      declarePayment, confirmPayment,

      // Maintenance
      runMaintenanceTasks,

      // UI
      showToast,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
