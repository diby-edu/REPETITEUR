'use client'
import { createContext, useContext, useState, useCallback } from 'react'

const ChatBubbleContext = createContext(null)

export function ChatBubbleProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeConvId, setActiveConvId] = useState(null)

  // Ouvre la bulle, optionnellement sur une conversation précise
  const openChat = useCallback((convId = null) => {
    setActiveConvId(convId)
    setIsOpen(true)
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
    setActiveConvId(null)
  }, [])

  return (
    <ChatBubbleContext.Provider value={{ isOpen, setIsOpen, activeConvId, setActiveConvId, openChat, closeChat }}>
      {children}
    </ChatBubbleContext.Provider>
  )
}

export function useChatBubble() {
  const ctx = useContext(ChatBubbleContext)
  if (!ctx) throw new Error('useChatBubble must be used within ChatBubbleProvider')
  return ctx
}
