'use client'

interface TypingIndicatorProps {
  users: string[]
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null

  const displayText = users.length === 1
    ? `${users[0]} is typing...`
    : `${users.length} people are typing...`

  return (
    <div className="flex gap-3 text-gray-600 dark:text-white/60">
      <div className="flex gap-1">
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '150ms' }} />
        <div className="h-2 w-2 animate-bounce rounded-full bg-white/50" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm">{displayText}</span>
    </div>
  )
}
