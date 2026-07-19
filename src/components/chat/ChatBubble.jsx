'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useChatBubble } from '../../context/ChatBubbleContext'
import { supabase } from '../../lib/supabase'
import Avatar from '../common/Avatar'
import { MessageCircle, X, ChevronLeft, Send, Shield } from 'lucide-react'
import { filterPhoneAndEmail, timeAgo } from '../../utils/helpers'

export default function ChatBubble() {
  const { currentUser, isAuthenticated } = useAuth()
  const {
    getUserConversations, getConversation, sendMessage,
    markConversationRead, getTutor, loadUserConversations, loadMessages,
  } = useApp()
  const { isOpen, setIsOpen, activeConvId, setActiveConvId, closeChat } = useChatBubble()

  const [inputValue, setInputValue] = useState('')
  const [warning, setWarning] = useState(false)
  const [otherUserCache, setOtherUserCache] = useState({})
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Valeurs dérivées — null-safe pour fonctionner avant et après connexion
  const conversations = isAuthenticated && currentUser
    ? getUserConversations(currentUser.id)
    : []
  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unreadCount?.[currentUser?.id] || 0), 0
  )
  const activeConv = activeConvId ? getConversation(activeConvId) : null
  const messages = activeConv?.messages || []
  const otherUser = activeConv
    ? otherUserCache[activeConv.participants?.find(p => p !== currentUser?.id)]
    : null

  // ── Tous les hooks AVANT le return conditionnel ───────────────

  const resolveOtherUser = useCallback(async (conv) => {
    if (!currentUser?.id) return
    const otherId = conv?.participants?.find(p => p !== currentUser.id)
    if (!otherId || otherUserCache[otherId]) return
    const tutor = getTutor(otherId)
    if (tutor) { setOtherUserCache(prev => ({ ...prev, [otherId]: tutor })); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, avatar_color')
      .eq('id', otherId)
      .single()
    if (data) {
      setOtherUserCache(prev => ({
        ...prev,
        [otherId]: {
          id: data.id, firstName: data.first_name, lastName: data.last_name,
          role: data.role, avatarColor: data.avatar_color,
        },
      }))
    }
  }, [currentUser?.id, getTutor, otherUserCache])

  useEffect(() => {
    if (isOpen && currentUser?.id) loadUserConversations(currentUser.id)
  }, [isOpen, currentUser?.id, loadUserConversations])

  useEffect(() => {
    if (activeConvId && isOpen && currentUser?.id) {
      loadMessages(activeConvId)
      markConversationRead(activeConvId, currentUser.id)
    }
  }, [activeConvId, isOpen, currentUser?.id])

  useEffect(() => {
    if (!activeConvId || !isOpen) return
    const channel = supabase
      .channel(`bubble-msg:${activeConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConvId}`,
      }, () => { loadMessages(activeConvId) })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeConvId, isOpen])

  useEffect(() => {
    if (isOpen && activeConvId) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }
  }, [messages.length, activeConvId, isOpen])

  useEffect(() => {
    if (isOpen && activeConvId) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [activeConvId, isOpen])

  useEffect(() => {
    conversations.forEach(conv => resolveOtherUser(conv))
  }, [conversations.length])

  // ── Guard — pas de bulle si non connecté (après tous les hooks) ─
  if (!isAuthenticated || !currentUser) return null

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!inputValue.trim() || !activeConvId) return
    const filtered = filterPhoneAndEmail(inputValue)
    if (filtered !== inputValue) {
      setWarning(true)
      setTimeout(() => setWarning(false), 4000)
    }
    await sendMessage(activeConvId, currentUser.id, inputValue)
    setInputValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">

      {/* ── Panneau ouvert ── */}
      {isOpen && (
        <div
          className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden pointer-events-auto"
          style={{ height: 440 }}
        >
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center gap-2 flex-shrink-0">
            {activeConvId ? (
              <button
                onClick={() => { setActiveConvId(null); setInputValue('') }}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            ) : null}

            <div className="flex-1 flex items-center gap-2 min-w-0">
              {activeConvId && otherUser ? (
                <>
                  <Avatar user={otherUser} size="xs" />
                  <p className="text-white font-semibold text-sm truncate">
                    {otherUser.firstName} {otherUser.lastName?.[0]}.
                  </p>
                </>
              ) : (
                <>
                  <MessageCircle size={16} className="text-white flex-shrink-0" />
                  <p className="text-white font-semibold text-sm">Messages</p>
                  {totalUnread > 0 && (
                    <span className="bg-white text-primary text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {totalUnread}
                    </span>
                  )}
                </>
              )}
            </div>

            <button
              onClick={closeChat}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Liste des conversations ── */}
          {!activeConvId && (
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageCircle size={36} className="text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">Aucune conversation</p>
                  <p className="text-xs text-gray-300 mt-1">Contactez un parent ou un répétiteur pour démarrer</p>
                </div>
              ) : (
                conversations.map(conv => {
                  const otherId = conv.participants?.find(p => p !== currentUser.id)
                  const other = otherUserCache[otherId]
                  const unread = conv.unreadCount?.[currentUser.id] || 0
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left"
                    >
                      <Avatar user={other} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-1">
                          <p className={`text-sm truncate ${unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {other ? `${other.firstName} ${other.lastName}` : '…'}
                          </p>
                          {conv.lastMessage && (
                            <p className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.lastMessage.timestamp)}</p>
                          )}
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${unread ? 'font-medium text-gray-700' : 'text-gray-400'}`}>
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
          )}

          {/* ── Zone messages ── */}
          {activeConvId && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-8">Démarrez la conversation</p>
                )}
                {messages.map(msg => {
                  const isMe = msg.senderId === currentUser.id
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                        isMe
                          ? 'bg-primary text-white rounded-br-none'
                          : 'bg-gray-100 text-gray-800 rounded-bl-none'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {warning && (
                <div className="mx-3 mb-1 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                  <Shield size={13} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs text-orange-700">Coordonnées détectées et filtrées.</p>
                </div>
              )}

              <div className="px-3 py-2.5 border-t border-gray-100 flex-shrink-0">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-primary focus:bg-white transition-colors"
                    placeholder="Message…"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-primary-600 transition-colors flex-shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Bouton flottant ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-primary-600 transition-all hover:scale-105 active:scale-95 relative pointer-events-auto"
        aria-label="Ouvrir les messages"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 leading-none">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  )
}
