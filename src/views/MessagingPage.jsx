'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/common/Avatar'
import { Send, MessageCircle, ArrowLeft, Shield } from 'lucide-react'
import { timeAgo, formatTime, filterPhoneAndEmail } from '../utils/helpers'

export default function MessagingPage() {
  const { convId } = useParams()
  const { currentUser } = useAuth()
  const {
    getUserConversations, getConversation, sendMessage,
    markConversationRead, getTutor, loadUserConversations, loadMessages,
  } = useApp()
  const router = useRouter()
  const [activeConvId, setActiveConvId] = useState(convId || null)
  const [message, setMessage] = useState('')
  const [warning, setWarning] = useState(false)
  const [otherUserCache, setOtherUserCache] = useState({})
  const messagesEndRef = useRef(null)

  // Charger les conversations au montage
  useEffect(() => {
    if (currentUser?.id) loadUserConversations(currentUser.id)
  }, [currentUser?.id, loadUserConversations])

  useEffect(() => {
    if (convId) setActiveConvId(convId)
  }, [convId])

  // Charger les messages et marquer comme lu quand on ouvre une conv
  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
      markConversationRead(activeConvId, currentUser.id)
    }
  }, [activeConvId])

  // Scroll vers le bas quand les messages changent
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [getConversation(activeConvId)?.messages?.length])

  // Realtime : écouter les nouveaux messages
  useEffect(() => {
    if (!activeConvId) return
    const channel = supabase
      .channel(`messages:${activeConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConvId}`,
      }, (payload) => {
        const newMsg = {
          id: payload.new.id,
          senderId: payload.new.sender_id,
          content: payload.new.content,
          timestamp: payload.new.created_at,
          read: payload.new.read,
        }
        // N'ajouter que si ce n'est pas le propre message de l'utilisateur (déjà ajouté optimistiquement)
        if (newMsg.senderId !== currentUser.id) {
          useApp_addMessage(activeConvId, newMsg)
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [activeConvId, currentUser.id])

  // Helper pour injecter un message reçu via Realtime dans le state
  const useApp_addMessage = useCallback((convId, msg) => {
    // On utilise le setter via une ref de conversations (workaround context)
    // En pratique, on recharge les messages
    loadMessages(convId)
  }, [loadMessages])

  const userConversations = getUserConversations(currentUser.id)
  const activeConv = activeConvId ? getConversation(activeConvId) : null

  // Récupérer l'autre utilisateur (depuis tutors ou via fetch profil)
  const getOtherUser = useCallback(async (conv) => {
    const otherId = conv?.participants.find(p => p !== currentUser.id)
    if (!otherId) return null
    if (otherUserCache[otherId]) return otherUserCache[otherId]

    const tutor = getTutor(otherId)
    if (tutor) {
      setOtherUserCache(prev => ({ ...prev, [otherId]: tutor }))
      return tutor
    }

    // Charger depuis DB si pas dans les tuteurs
    const { data } = await supabase.from('profiles').select('*').eq('id', otherId).single()
    if (data) {
      const profile = {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role,
        city: data.city,
        avatarColor: data.avatar_color,
      }
      setOtherUserCache(prev => ({ ...prev, [otherId]: profile }))
      return profile
    }
    return null
  }, [currentUser.id, getTutor, otherUserCache])

  // Charger les autres utilisateurs au montage
  useEffect(() => {
    userConversations.forEach(conv => getOtherUser(conv))
  }, [userConversations.length])

  const otherUser = activeConv ? otherUserCache[activeConv.participants.find(p => p !== currentUser.id)] : null

  const handleSend = async (e) => {
    e.preventDefault()
    if (!message.trim() || !activeConvId) return

    const filtered = filterPhoneAndEmail(message)
    if (filtered !== message) {
      setWarning(true)
      setTimeout(() => setWarning(false), 4000)
    }

    await sendMessage(activeConvId, currentUser.id, message)
    setMessage('')
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-surface">
      <div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full px-0 sm:px-6 py-0 sm:py-6">
        <div className="flex flex-1 overflow-hidden sm:rounded-2xl sm:border sm:border-gray-100 sm:shadow-card bg-white">
          {/* Conversation list */}
          <div className={`w-full sm:w-72 border-r border-gray-100 flex flex-col ${activeConvId ? 'hidden sm:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" />
                Messages
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {userConversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageCircle size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucune conversation</p>
                </div>
              ) : (
                userConversations.map(conv => {
                  const other = otherUserCache[conv.participants.find(p => p !== currentUser.id)]
                  const unread = conv.unreadCount?.[currentUser.id] || 0
                  const isActive = conv.id === activeConvId
                  return (
                    <button
                      key={conv.id}
                      onClick={() => { setActiveConvId(conv.id); router.replace(`/messagerie/${conv.id}`) }}
                      className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${isActive ? 'bg-primary-50 border-l-2 border-l-primary' : ''}`}
                    >
                      <Avatar user={other} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className={`text-sm ${unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'} truncate`}>
                            {other?.firstName} {other?.lastName}
                          </p>
                          {conv.lastMessage && (
                            <p className="text-xs text-gray-400 flex-shrink-0 ml-1">
                              {timeAgo(conv.lastMessage.timestamp)}
                            </p>
                          )}
                        </div>
                        <p className={`text-xs ${unread ? 'text-gray-700 font-medium' : 'text-gray-400'} truncate mt-0.5`}>
                          {conv.lastMessage?.content || 'Démarrer la conversation'}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {unread}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col ${activeConvId ? 'flex' : 'hidden sm:flex'}`}>
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle size={64} className="text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">Sélectionnez une conversation</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                  <button onClick={() => setActiveConvId(null)} className="sm:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={20} />
                  </button>
                  <Avatar user={otherUser} size="md" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{otherUser?.firstName} {otherUser?.lastName}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {otherUser?.role === 'tutor' ? `Répétiteur — ${otherUser?.city}` : 'Parent'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                  <Shield size={13} className="text-blue-500 flex-shrink-0" />
                  <p className="text-xs text-blue-700">Les numéros de téléphone et emails sont automatiquement masqués.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {(activeConv.messages || []).map(msg => {
                    const isMe = msg.senderId === currentUser.id
                    const sender = isMe ? currentUser : otherUser
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isMe && <Avatar user={sender} size="xs" />}
                        <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMe ? 'bg-primary text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                          }`}>
                            {msg.content}
                          </div>
                          <p className="text-xs text-gray-400 px-1">{formatTime(msg.timestamp)}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {warning && (
                  <div className="mx-4 mb-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-center gap-2">
                    <Shield size={16} />
                    Certaines informations de contact ont été masquées dans votre message.
                  </div>
                )}

                <div className="p-4 border-t border-gray-100">
                  <form onSubmit={handleSend} className="flex items-end gap-3">
                    <textarea
                      className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 max-h-32"
                      placeholder="Écrivez votre message..."
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                    />
                    <button
                      type="submit"
                      disabled={!message.trim()}
                      className="w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-600 transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
