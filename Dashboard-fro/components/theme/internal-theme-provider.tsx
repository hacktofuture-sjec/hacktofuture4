'use client'

import * as React from 'react'

/** Storage key for internal (protected) routes only — homepage/auth ignore this. */
export const INTERNAL_THEME_STORAGE_KEY = 'internal-ui-theme'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
})

export function useTheme() {
  return React.useContext(ThemeContext)
}

/**
 * Lightweight theme provider that mirrors next-themes behaviour for
 * attribute="class" + defaultTheme="dark" WITHOUT injecting a `<script>` tag.
 * This eliminates the React console warning about script tags in components.
 */
export function InternalThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    try {
      const stored = localStorage.getItem(INTERNAL_THEME_STORAGE_KEY)
      return stored === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  // Apply the class to <html> whenever the theme changes.
  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    root.style.colorScheme = theme
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(INTERNAL_THEME_STORAGE_KEY, next)
    } catch {
      // localStorage may be unavailable
    }
  }, [])

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
