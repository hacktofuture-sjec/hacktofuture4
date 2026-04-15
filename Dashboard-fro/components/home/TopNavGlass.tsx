'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

export function TopNavGlass() {
  const { isAuthenticated } = useAuth()
  const [t, setT] = useState(0)

  useEffect(() => {
    let raf: number | null = null
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = null
        const p = clamp01((window.scrollY - 10) / 220)
        setT(p)
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div
        className="pointer-events-auto mx-auto flex h-14 max-w-7xl items-center justify-between px-6"
        style={{
          background: `rgba(5, 9, 19, ${0.1 + t * 0.28})`,
          backdropFilter: `blur(${8 + t * 8}px)`,
          WebkitBackdropFilter: `blur(${8 + t * 8}px)`,
          borderBottom: `1px solid rgba(255,255,255,${0.06 + t * 0.08})`,
          transition: 'background 200ms ease, border-color 200ms ease, backdrop-filter 200ms ease',
        }}
      >
        <Link href="/" className="group flex items-center gap-2">
          <span className="text-sm font-semibold tracking-[-0.02em] text-white">
            AetherMesh
          </span>
          <span className="hidden text-xs text-white/50 sm:inline">
            Self-healing cloud
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex">
            <Link className="transition hover:text-white" href="#platform">
              Platform
            </Link>
            <Link className="transition hover:text-white" href="#capabilities">
              Capabilities
            </Link>
            <Link className="transition hover:text-white" href="#security">
              Security
            </Link>
          </nav>

          <div className="hidden items-center gap-4 text-sm md:flex">
            <Link className="text-white/75 transition hover:text-white" href="/auth">
              Sign in
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-white/18 px-3 py-1.5 text-white/85 transition hover:border-white/28 hover:text-white"
              href="/auth"
            >
              Sign up
            </Link>
          </div>

          <Link
            href={isAuthenticated ? "/dashboard" : "/auth"}
            className="inline-flex items-center justify-center rounded-full border border-[#2563EB]/55 px-4 py-2 text-sm font-medium text-white/90 transition hover:border-[#3B82F6] hover:text-white"
          >
            {isAuthenticated ? "Go to Dashboard" : "Request access"}
          </Link>
        </div>
      </div>
    </div>
  )
}

