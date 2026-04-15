'use client'

import { useState, useRef, useEffect } from 'react'
import { Message, Conversation } from '@/hooks/useChat'
import MessageItem from './MessageItem'
import TypingIndicator from './TypingIndicator'
import { Send, Paperclip, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'

interface ChatWindowProps {
  conversation: Conversation
  messages: Message[]
  onSendMessage: (content: string) => Promise<void>
  onDeleteMessage: (messageId: string) => void
  onEditMessage: (messageId: string, content: string) => void
  typingUsers: Set<string>
  onSetTyping: (username: string) => void
}

export default function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  typingUsers,
  onSetTyping,
}: ChatWindowProps) {
  const [messageInput, setMessageInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!messageInput.trim() || loading) return

    setLoading(true)
    try {
      await onSendMessage(messageInput)
      setMessageInput('')
    } finally {
      setLoading(false)
    }
  }

  const handleEditMessage = (messageId: string, content: string) => {
    onEditMessage(messageId, content)
    setEditingId(null)
    setEditingContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-gray-900 dark:bg-black/40 dark:text-white">
      {/* Header */}
      <InternalGlassPanel
        density="none"
        className="flex h-16 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 border-b border-gray-200 px-6 dark:border-white/10"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{conversation.name}</h2>
          <p className="text-xs text-gray-600 dark:text-white/60">
            {conversation.type === 'group'
              ? `${conversation.participants.length} members`
              : 'Direct message'}
          </p>
        </div>
      </InternalGlassPanel>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-600 dark:text-white/60">
              <p className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">No messages yet</p>
              <p>Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onDelete={() => onDeleteMessage(message.id)}
              onEdit={(content) => setEditingId(message.id)}
              isEditing={editingId === message.id}
              editingContent={editingContent}
              onEditChange={setEditingContent}
              onEditSubmit={(content) => handleEditMessage(message.id, content)}
            />
          ))
        )}
        {typingUsers.size > 0 && <TypingIndicator users={Array.from(typingUsers)} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InternalGlassPanel
        density="none"
        className="flex h-20 items-end gap-3 rounded-none border-x-0 border-b-0 border-t border-gray-200 p-4 dark:border-white/10"
      >
        <Button variant="ghost" size="icon" className="shrink-0 text-gray-800 hover:bg-gray-200 dark:text-white dark:hover:bg-white/10">
          <Paperclip className="h-5 w-5" />
        </Button>

        <div className="flex-1 flex flex-col gap-2">
          <Input
            value={messageInput}
            onChange={(e) => {
              setMessageInput(e.target.value)
              onSetTyping('Demo User')
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={loading}
            className="resize-none border border-gray-200 bg-white text-gray-900 placeholder:text-gray-500 dark:border-white/10 dark:bg-[#0B1220] dark:text-white dark:placeholder:text-white/40"
          />
        </div>

        <Button variant="ghost" size="icon" className="shrink-0 text-gray-800 hover:bg-gray-200 dark:text-white dark:hover:bg-white/10">
          <Smile className="h-5 w-5" />
        </Button>

        <Button
          onClick={handleSendMessage}
          disabled={!messageInput.trim() || loading}
          size="icon"
          className="shrink-0 bg-primary hover:bg-primary/90"
        >
          <Send className="h-5 w-5" />
        </Button>
      </InternalGlassPanel>
    </div>
  )
}
