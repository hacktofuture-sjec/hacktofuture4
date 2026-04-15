'use client'

import { Message } from '@/hooks/useChat'
import { MoreVertical, Trash2, Edit2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InternalGlassPanel } from '@/components/ui/gradient-background-4'

interface MessageItemProps {
  message: Message
  onDelete: () => void
  onEdit: (content: string) => void
  isEditing: boolean
  editingContent: string
  onEditChange: (content: string) => void
  onEditSubmit: (content: string) => void
}

export default function MessageItem({
  message,
  onDelete,
  onEdit,
  isEditing,
  editingContent,
  onEditChange,
  onEditSubmit,
}: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const isDeleted = message.deletedAt !== undefined

  return (
    <div className="flex gap-3 group">
      <img
        src={message.avatar || '/avatar.jpg'}
        alt={message.username}
        className="w-8 h-8 rounded-full flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{message.username}</span>
          <span className="text-xs text-gray-500 dark:text-white/50">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.edited && !isDeleted && (
            <span className="text-xs text-gray-500 dark:text-white/50">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editingContent}
              onChange={(e) => onEditChange(e.target.value)}
              className="border border-gray-200 bg-white text-sm text-gray-900 dark:border-white/10 dark:bg-[#0B1220] dark:text-white"
              autoFocus
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEditSubmit(editingContent)}
              className="flex-shrink-0"
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit('')}
              className="flex-shrink-0"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p
            className={`text-sm ${
              isDeleted ? 'italic text-gray-400 dark:text-white/45' : 'text-gray-800 dark:text-white/85'
            }`}
          >
            {message.content}
          </p>
        )}
      </div>

      {/* Message Actions */}
      {!isDeleted && !isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <InternalGlassPanel
                density="none"
                className="absolute right-0 top-full z-20 mt-1 min-w-max rounded-xl p-1 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.65)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onEdit(message.content)
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-gray-900 dark:text-white hover:bg-white/10"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDelete()
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </InternalGlassPanel>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
