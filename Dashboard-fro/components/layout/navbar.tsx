'use client'

import { Bell } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { UserProfileDropdown } from '@/components/ui/user-profile-dropdown'
import { useAuth } from '@/hooks/useAuth'

export default function Navbar() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-20 w-full border-b border-gray-200 bg-white/95 dark:border-white/10 dark:bg-black/70 dark:backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-full items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-gray-900 transition-colors duration-200 dark:text-white"
        >
          Dashboard
        </Link>

        <div className="min-w-0 max-w-md flex-1">
          <Input
            type="search"
            placeholder="Search commands, metrics, services..."
            className="h-10 w-full rounded-xl border border-gray-200 bg-white text-gray-900 shadow-none placeholder:text-gray-500 focus-visible:border-blue-500/40 focus-visible:ring-blue-500/20 dark:border-white/10 dark:bg-[#0B1220] dark:text-white dark:placeholder:text-white/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            title="Notifications"
          >
            <Bell className="h-4 w-4 text-gray-800 dark:text-white" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </Button>

          {user && <UserProfileDropdown user={user} />}
        </div>
      </div>
    </header>
  )
}
