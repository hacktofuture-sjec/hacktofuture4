import { useState, useCallback, useEffect } from 'react'

export interface Message {
  id: string
  conversationId: string
  userId: string
  username: string
  content: string
  timestamp: Date
  avatar?: string
  edited?: boolean
  deletedAt?: Date
}

export interface Conversation {
  id: string
  name: string
  type: 'dm' | 'group'
  participants: Array<{ id: string; username: string; avatar?: string }>
  lastMessage?: Message
  unreadCount: number
  createdAt: Date
  updatedAt: Date
}

// In-memory storage
const conversations = new Map<string, Conversation>()
const messages = new Map<string, Message[]>()
const typingUsers = new Map<string, Set<string>>()

// Initialize demo conversations
function initializeDemoConversations() {
  if (conversations.size === 0) {
    const conv1: Conversation = {
      id: 'conv-1',
      name: 'System Alert Bot',
      type: 'dm',
      participants: [
        { id: 'user-2', username: 'System', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=system' }
      ],
      unreadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    conversations.set('conv-1', conv1)

    const conv2: Conversation = {
      id: 'conv-2',
      name: 'Engineering Team',
      type: 'group',
      participants: [
        { id: 'user-3', username: 'Alice', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice' },
        { id: 'user-4', username: 'Bob', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob' }
      ],
      unreadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    conversations.set('conv-2', conv2)

    // Demo messages
    messages.set('conv-1', [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        userId: 'user-2',
        username: 'System',
        content: 'Welcome to MicroChat! Monitoring service is online.',
        timestamp: new Date(Date.now() - 3600000),
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=system',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        userId: 'user-2',
        username: 'System',
        content: 'All microservices are operational. No incidents detected.',
        timestamp: new Date(Date.now() - 1800000),
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=system',
      },
    ])

    messages.set('conv-2', [
      {
        id: 'msg-3',
        conversationId: 'conv-2',
        userId: 'user-3',
        username: 'Alice',
        content: 'The dashboard is looking great! Love the new monitoring features.',
        timestamp: new Date(Date.now() - 7200000),
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
      },
      {
        id: 'msg-4',
        conversationId: 'conv-2',
        userId: 'user-4',
        username: 'Bob',
        content: 'Thanks! Self-healing is working perfectly.',
        timestamp: new Date(Date.now() - 3600000),
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
      },
    ])
  }
}

export function useChat(userId: string) {
  const [chatConversations, setChatConversations] = useState<Conversation[]>([])
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [typingState, setTypingState] = useState<Set<string>>(new Set())

  // Initialize
  useEffect(() => {
    initializeDemoConversations()
    const convList = Array.from(conversations.values())
    setChatConversations(convList)
    if (convList.length > 0) {
      setActiveConversationId(convList[0].id)
    }
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      const convMessages = messages.get(activeConversationId) || []
      setChatMessages(convMessages)
      
      // Clear typing indicator
      setTypingState(new Set())
      typingUsers.delete(activeConversationId)
    }
  }, [activeConversationId])

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConversationId || !content.trim()) return

    const message: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId,
      userId,
      username: 'Demo User', // This would come from useAuth
      content,
      timestamp: new Date(),
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
    }

    // Add to messages
    const convMessages = messages.get(activeConversationId) || []
    convMessages.push(message)
    messages.set(activeConversationId, convMessages)
    setChatMessages([...convMessages])

    // Update conversation lastMessage
    const conv = conversations.get(activeConversationId)
    if (conv) {
      conv.lastMessage = message
      conv.updatedAt = new Date()
      conversations.set(activeConversationId, conv)
      setChatConversations(Array.from(conversations.values()))
    }
  }, [activeConversationId, userId])

  const createConversation = useCallback(async (name: string, type: 'dm' | 'group', participantIds: string[]) => {
    const conversationId = `conv-${Date.now()}`
    const newConv: Conversation = {
      id: conversationId,
      name,
      type,
      participants: participantIds.map(id => ({
        id,
        username: id === 'user-2' ? 'System' : `User ${id}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`
      })),
      unreadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    conversations.set(conversationId, newConv)
    messages.set(conversationId, [])
    setChatConversations(Array.from(conversations.values()))
    setActiveConversationId(conversationId)
    return newConv
  }, [])

  const deleteMessage = useCallback((messageId: string) => {
    if (!activeConversationId) return
    
    const convMessages = messages.get(activeConversationId) || []
    const msgIndex = convMessages.findIndex(m => m.id === messageId)
    if (msgIndex >= 0) {
      convMessages[msgIndex] = {
        ...convMessages[msgIndex],
        deletedAt: new Date(),
        content: '(message deleted)',
      }
      messages.set(activeConversationId, convMessages)
      setChatMessages([...convMessages])
    }
  }, [activeConversationId])

  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (!activeConversationId) return
    
    const convMessages = messages.get(activeConversationId) || []
    const msg = convMessages.find(m => m.id === messageId)
    if (msg) {
      msg.content = newContent
      msg.edited = true
      messages.set(activeConversationId, convMessages)
      setChatMessages([...convMessages])
    }
  }, [activeConversationId])

  const setUserTyping = useCallback((username: string) => {
    const updated = new Set(typingState)
    updated.add(username)
    setTypingState(updated)

    // Auto-clear after 3 seconds
    setTimeout(() => {
      setTypingState(prev => {
        const newSet = new Set(prev)
        newSet.delete(username)
        return newSet
      })
    }, 3000)
  }, [typingState])

  return {
    conversations: chatConversations,
    messages: chatMessages,
    activeConversationId,
    typingState,
    setActiveConversationId,
    sendMessage,
    createConversation,
    deleteMessage,
    editMessage,
    setUserTyping,
  }
}
