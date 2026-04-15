'use client'

import { Conversation } from '@/hooks/useChat'
import { Users } from 'lucide-react'

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelectConversation: (id: string) => void
}

export default function ConversationList({
  conversations,
  activeId,
  onSelectConversation,
}: ConversationListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.length === 0 ? (
        <div className="p-4 text-center text-gray-600 dark:text-white/60">
          No conversations yet
        </div>
      ) : (
        <div className="space-y-1 p-2">
          {conversations.map((conv) => {
            const isActive = conv.id === activeId
            const lastMessage = conv.lastMessage
            const preview = lastMessage ? lastMessage.content : 'No messages yet'

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full rounded-lg p-3 text-left transition-colors ${
                  isActive
                    ? 'border border-primary/30 bg-primary/20 text-gray-900 dark:text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent p-0.5 flex-shrink-0">
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                      {conv.type === 'group' ? (
                        <Users className="h-5 w-5 text-primary" />
                      ) : (
                        <img
                          src={conv.participants[0]?.avatar || '/avatar.jpg'}
                          alt={conv.participants[0]?.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{conv.name}</h3>
                      {conv.unreadCount > 0 && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-600 dark:text-white/55">
                      {preview}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
