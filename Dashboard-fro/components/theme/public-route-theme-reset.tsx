'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Homepage and auth must not keep internal dashboard theme classes on <html>.
 * next-themes only mounts inside protected layout; when leaving internal routes,
 * strip theme classes so marketing/auth pages render as designed.
 */
export function PublicRouteThemeReset() {
  const pathname = usePathname()

  useEffect(() => {
    const p = pathname ?? ''
    const isPublic =
      p === '/' ||
      p.startsWith('/auth') ||
      p === '/login' ||
      p === '/sign-in' ||
      p === '/sign-up'

    if (isPublic) {
      document.documentElement.classList.remove('dark', 'light')
    }
  }, [pathname])

  return null
}
