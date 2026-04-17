'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/internal-theme-provider'
import * as React from 'react'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full border border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white"
        aria-hidden
        disabled
      >
        <Sun className="h-4 w-4 opacity-50" />
      </Button>
    )
  }

  const isDark = theme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 rounded-full border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:shadow-none dark:hover:bg-white/10"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
