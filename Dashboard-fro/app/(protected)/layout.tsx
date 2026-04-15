'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/layout/navbar'
import Sidebar from '@/components/layout/sidebar'
import { InternalThemeProvider } from '@/components/theme/internal-theme-provider'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated, user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, router])

  return (
    <InternalThemeProvider>
      {isLoading || !isAuthenticated || !user ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 text-slate-900 dark:bg-gradient-to-b dark:from-black dark:to-[#020617] dark:text-white">
          <div className="text-center">
            <div className="mb-4 animate-pulse text-slate-800 dark:text-white">Loading...</div>
            <p className="text-slate-600 dark:text-white/60">Redirecting...</p>
          </div>
        </div>
      ) : (
        <div className="dashboard-shell relative z-0 min-h-screen w-full text-foreground">
          <div className="relative z-10 flex w-full">
            <Sidebar />
            <main className="ml-64 flex-1">
              <div className="sticky top-0 z-30">
                <Navbar />
              </div>
              <div className="relative z-10 min-h-screen px-4 py-4 md:px-6 md:py-6">{children}</div>
            </main>
          </div>
        </div>
      )}
    </InternalThemeProvider>
  )
}
