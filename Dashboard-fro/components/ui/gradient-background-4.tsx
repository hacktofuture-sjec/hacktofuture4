'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Subtle internal gradient for dark DevOps panels: black / deep navy base
 * with a soft blue bloom toward the top center. Intended as `absolute inset-0 z-0`
 * behind card content (never full-page).
 */
export function GradientBackground4({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-0 hidden overflow-hidden rounded-[inherit] dark:block',
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#030711] to-[#0B1220]/92" />
      <div
        className="absolute left-1/2 top-[-18%] h-[min(78%,26rem)] w-[min(130%,52rem)] -translate-x-1/2 opacity-[0.95]"
        style={{
          background:
            'radial-gradient(ellipse 72% 58% at 50% 32%, rgba(37,99,235,0.26) 0%, rgba(30,58,138,0.1) 42%, transparent 70%)',
          filter: 'blur(44px)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 110% 65% at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 52%)',
        }}
      />
    </div>
  )
}

export type InternalGlassPanelDensity = 'comfortable' | 'compact' | 'none'

export type InternalGlassPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  density?: InternalGlassPanelDensity
  as?: 'div' | 'section' | 'article'
}

const padding: Record<InternalGlassPanelDensity, string> = {
  comfortable: 'p-6',
  compact: 'p-4',
  none: 'p-0',
}

/**
 * Premium internal card: glass + dark blue gradient layer (protected routes only).
 * Structure: gradient (z-0) + content shell (z-10, relative).
 */
export function InternalGlassPanel({
  children,
  className,
  density = 'comfortable',
  as: Comp = 'div',
  ...rest
}: InternalGlassPanelProps) {
  const pad = padding[density]
  return (
    <Comp
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm',
        'dark:border-white/10 dark:bg-[#0B1220]/50 dark:shadow-[0_8px_32px_rgba(0,0,0,0.65)] dark:backdrop-blur-xl',
        pad,
        className,
      )}
      {...rest}
    >
      <GradientBackground4 />
      <div className="relative z-10 min-h-0">{children}</div>
    </Comp>
  )
}
