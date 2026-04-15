'use client'

import { useEffect, useRef, useState } from 'react'
import { SplineScene } from '@/components/home/SplineScene'

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0))
  return t * t * (3 - 2 * t)
}

type StickySplineHeroProps = {
  scene: string
  scrollVh?: number
}

export function StickySplineHero({ scene, scrollVh = 380 }: StickySplineHeroProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const tick = () => {
      const rect = host.getBoundingClientRect()
      const viewport = window.innerHeight
      const total = Math.max(1, rect.height - viewport)
      const raw = clamp01(-rect.top / total)

      // Reserve a small end hold so the final state settles
      // before moving to the next section.
      const holdStart = 0.92
      const playable = raw < holdStart ? raw / holdStart : 1
      const eased = smoothstep(0, 1, playable)

      if (Math.abs(eased - progressRef.current) > 0.0012) {
        progressRef.current = eased
        setProgress(eased)
      }

      rafRef.current = window.requestAnimationFrame(tick)
    }

    rafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const blocks = [
    {
      key: 'stable',
      start: 0,
      end: 0.2,
      kicker: 'System stable',
      title: 'Agentic Self-Healing Cloud Platform',
      body: 'A live intelligent infrastructure surface where service state, anomalies, and recovery orchestration are continuously visualized.',
      align: 'center',
    },
    {
      key: 'anomaly',
      start: 0.2,
      end: 0.5,
      kicker: 'Anomaly phase',
      title: 'Signal drift detected. Containment is immediate.',
      body: 'The network sphere enters controlled tension while the platform isolates causal deviations.',
      align: 'left',
    },
    {
      key: 'analysis',
      start: 0.5,
      end: 0.75,
      kicker: 'Analysis / expansion',
      title: 'Dependencies expand to expose root cause.',
      body: 'Internal topology unfolds in a precise radial reveal, turning complexity into actionable state.',
      align: 'right',
    },
    {
      key: 'resolution',
      start: 0.75,
      end: 1,
      kicker: 'Resolution',
      title: 'Reformed, optimized, and stable again.',
      body: 'Services converge to a refined equilibrium with clear, verified remediation outcomes.',
      align: 'center',
    },
  ] as const

  return (
    <section
      ref={hostRef}
      className="relative"
      style={{
        height: `${scrollVh}vh`,
        background: 'linear-gradient(180deg, #050505 0%, #030712 100%)',
      }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <div className="absolute inset-0">
          <SplineScene scene={scene} className="h-full w-full" />
        </div>

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(900px_560px_at_50%_36%,rgba(14,165,233,0.12),transparent_62%)]" />
          <div className="absolute inset-x-0 bottom-[-18%] h-[56%] bg-[radial-gradient(760px_380px_at_50%_0%,rgba(29,78,216,0.11),transparent_66%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/22" />
        </div>

        <div className="absolute inset-0 mx-auto flex h-full w-full max-w-7xl px-6">
          <div className="relative h-full w-full">
            {blocks.map((b) => {
              const span = Math.max(1e-6, b.end - b.start)
              const edge = span * 0.12
              const fadeIn = smoothstep(b.start - edge, b.start + edge, progress)
              const fadeOut = 1 - smoothstep(b.end - edge, b.end + edge, progress)
              const opacity = clamp01(Math.min(fadeIn, fadeOut))
              const y = (1 - opacity) * 14
              const blur = (1 - opacity) * 7

              const alignClass =
                b.align === 'left'
                  ? 'left-0 items-start text-left'
                  : b.align === 'right'
                    ? 'right-0 items-end text-right'
                    : 'left-1/2 -translate-x-1/2 items-center text-center'

              return (
                <div
                  key={b.key}
                  className={`absolute top-[20%] flex w-full max-w-[56rem] flex-col gap-4 ${alignClass}`}
                  style={{
                    opacity,
                    transform: `translateY(${y}px) ${b.align === 'center' ? 'translateX(-50%)' : ''}`.trim(),
                    filter: `blur(${blur}px)`,
                    transition: 'opacity 140ms linear',
                  }}
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 backdrop-blur-md">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9]" />
                    <span className="text-xs tracking-wide text-white/70">{b.kicker}</span>
                  </div>

                  <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.03] tracking-[-0.03em] text-white sm:text-[4.2rem]">
                    <span className="bg-gradient-to-b from-white via-white to-[#BFE8FF] bg-clip-text text-transparent">
                      {b.title}
                    </span>
                  </h1>

                  <p className="max-w-[44rem] text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
                    {b.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-white/60 backdrop-blur-md">
            Scroll to evolve system state
          </div>
        </div>
      </div>
    </section>
  )
}

