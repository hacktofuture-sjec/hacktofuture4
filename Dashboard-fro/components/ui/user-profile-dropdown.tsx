'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { User, Settings, LogOut, UserCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

interface UserProfileDropdownProps {
  user: {
    id: string
    username: string
    email: string
    avatar?: string
  }
}

export function UserProfileDropdown({ user }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { logout } = useAuth()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 320 // 320px width - right align
      })
    }
    setIsOpen(!isOpen)
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  return (
    <>
      {/* Trigger */}
      <Button
        variant="ghost"
        size="icon"
        ref={triggerRef}
        onClick={handleToggle}
        className="relative h-10 w-10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10"
        title="Profile"
      >
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent p-0.5">
          <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
      </Button>

      {/* Portal Dropdown */}
      {isOpen && createPortal(
        <div
          className="fixed z-[9999] w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-lg transition-all duration-200 ease-out dark:border-white/10 dark:bg-[#0B1220]/95 dark:text-white dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] dark:backdrop-blur-xl"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {/* User Info Header */}
          <div className="border-b border-gray-200 p-4 dark:border-white/[0.1]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={user.username ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}` : '/avatar.jpg'}
                  alt={user.username}
                  className="h-12 w-12 rounded-full border-2 border-gray-200 dark:border-white/[0.2]"
                />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{user.username}</p>
                <p className="truncate text-xs font-medium text-gray-600 dark:text-white/70">{user.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400 font-medium">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <button
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <UserCircle className="h-4 w-4 text-gray-500 group-hover:text-gray-900 dark:text-white/60 dark:group-hover:text-white" />
              <span>Profile</span>
            </button>
            
            <button
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="h-4 w-4 text-gray-500 group-hover:text-gray-900 dark:text-white/60 dark:group-hover:text-white" />
              <span>Settings</span>
            </button>
            
            <div className="my-2 border-t border-gray-200 dark:border-white/[0.1]" />
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 text-left group"
            >
              <LogOut className="h-4 w-4 text-red-400/60 group-hover:text-red-300" />
              <span>Logout</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
