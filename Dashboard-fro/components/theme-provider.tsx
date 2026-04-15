'use client'

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props} attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">{children}</NextThemesProvider>
}
