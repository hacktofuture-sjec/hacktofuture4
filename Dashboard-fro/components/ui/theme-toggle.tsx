'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/internal-theme-provider'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9 rounded-xl bg-gray-100 dark:bg-white/5 backdrop-blur-sm hover:bg-gray-200 dark:hover:bg-white/20 transition-all z-50"
      onClick={handleThemeToggle}
      title="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-gray-900 dark:text-white" />
      ) : (
        <Moon className="h-4 w-4 text-gray-900 dark:text-white" />
      )}
    </Button>
  )
}